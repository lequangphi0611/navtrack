"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";
// Trigger tự động chốt Snapshot{period: MANUAL} sau mỗi giao dịch (docs/domain/06-snapshots.md
// "Khi nào lưu snapshot") — snapshots feature không phụ thuộc ngược vào holdings/actions.ts
// (chỉ holdings/queries.ts, xem features/snapshots/actions.ts) nên import chiều này không tạo vòng.
import { freezeManualSnapshot } from "@/features/snapshots/actions";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { computeCashflowAmount } from "@/lib/cost-basis";
import type { CashflowInputWithEvent } from "@/lib/cost-basis";
import { logger } from "@/lib/logger";
import { PENDING_EVENT_CREATED_AT } from "@/lib/position-trail";
import { revalidateHoldingDependentRoutes } from "@/lib/revalidate-holding-routes";
import { ROUTES } from "@/lib/routes";

import {
  deleteCashflowRow,
  findPositionSourceByCashflow,
  findPositionSourceById,
  findPositionSourceBySymbol,
  insertCashflow,
  insertHolding,
  isHoldingOwnedByUser,
  persistPosition,
  runInTransaction,
  updateCashflowRow,
  upsertNavOverride,
} from "./repository";
import {
  addTransactionSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";
import type { NavOverrideFormState } from "./types";

// Gọi sau MỖI action ghi cashflow (mua/bán/sửa/xoá) — hiệu ứng phụ, KHÔNG làm fail action
// chính nếu freeze lỗi: giao dịch vẫn phải báo thành công cho user, tách lỗi freeze khỏi
// lỗi giao dịch (docs/rules/error-handling.md "cô lập lỗi", cùng triết lý với job Python).
async function triggerManualSnapshot(
  actionName: string,
  holdingId: string,
): Promise<void> {
  const freezeResult = await freezeManualSnapshot();
  if (!freezeResult.ok) {
    logger.warn(
      { error: freezeResult.error, holdingId, action: actionName },
      "freezeManualSnapshot after transaction failed",
    );
  }
}

export async function createHolding(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const parsed = newHoldingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const {
    symbol,
    type,
    unit,
    name,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = parsed.data;

  try {
    const result = await runInTransaction(
      async (tx) => {
        const existing = await findPositionSourceBySymbol(
          { userId, symbol, type },
          tx,
        );

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: PENDING_EVENT_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [...(existing?.cashflows ?? []), candidate],
          existing?.dividends ?? [],
        );
        if (position.wentNegative) {
          return {
            ok: false as const,
            error: "Bán vượt quá số lượng đang giữ",
          };
        }

        const amount = computeCashflowAmount({
          type: cashflowType,
          quantity: candidate.quantity,
          pricePerUnit: candidate.pricePerUnit,
          feeAmount: new Decimal(feeAmount),
          taxAmount: new Decimal(taxAmount),
        });

        // Mua trùng mã đang giữ tự gộp vào Holding đã có, không tạo bản ghi thứ hai
        // (docs/domain/02-transactions-and-cost-basis.md).
        const holdingId =
          existing?.id ??
          (await insertHolding({ userId, symbol, type, unit, name }, tx)).id;

        const cashflow = await insertCashflow(
          {
            holdingId,
            type: cashflowType,
            date,
            quantity,
            pricePerUnit,
            amount: amount.toString(),
            feeAmount,
            taxAmount,
            note,
          },
          tx,
        );

        await persistPosition(holdingId, position, tx);

        return {
          ok: true as const,
          holdingId,
          cashflowId: cashflow.id,
        };
      },
      // Serializable — cùng lý do với addTransaction: đọc cashflows để derive vị thế
      // rồi ghi persistPosition phải atomic với đọc, kể cả khi merge vào holding đã có
      // (không có unique constraint nào bảo vệ đường ghi này).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    await triggerManualSnapshot("createHolding", result.holdingId);

    revalidateHoldingDependentRoutes(result.holdingId);
    return {
      ok: true,
      data: { holdingId: result.holdingId, cashflowId: result.cashflowId },
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        // Hai request tạo đồng thời cùng (userId, symbol, type) — request thua
        // trong đua tranh gặp lỗi ràng buộc unique, không phải bug.
        logger.warn(
          { symbol, type },
          "createHolding race on unique constraint",
        );
        return {
          ok: false,
          error: "Có giao dịch trùng đang được xử lý, vui lòng thử lại",
        };
      }
      if (err.code === "P2034") {
        // Serializable — request thua trong đua tranh gặp serialization conflict,
        // cùng lý do với addTransaction/updateTransaction/deleteTransaction.
        logger.warn({ symbol, type }, "createHolding race, ask to retry");
        return {
          ok: false,
          error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
        };
      }
    }
    logger.error({ err, symbol, type }, "createHolding failed");
    throw err;
  }
}

export async function addTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const parsed = addTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const {
    holdingId,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = parsed.data;

  try {
    const result = await runInTransaction(
      async (tx) => {
        const source = await findPositionSourceById(holdingId, userId, tx);
        if (!source) {
          return { ok: false as const, error: "Không tìm thấy danh mục" };
        }

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: PENDING_EVENT_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [...source.cashflows, candidate],
          source.dividends,
        );
        if (position.wentNegative) {
          return {
            ok: false as const,
            error: "Bán vượt quá số lượng đang giữ tại thời điểm bán",
          };
        }

        const amount = computeCashflowAmount({
          type: cashflowType,
          quantity: candidate.quantity,
          pricePerUnit: candidate.pricePerUnit,
          feeAmount: new Decimal(feeAmount),
          taxAmount: new Decimal(taxAmount),
        });

        const cashflow = await insertCashflow(
          {
            holdingId,
            type: cashflowType,
            date,
            quantity,
            pricePerUnit,
            amount: amount.toString(),
            feeAmount,
            taxAmount,
            note,
          },
          tx,
        );

        await persistPosition(holdingId, position, tx);

        return { ok: true as const, cashflowId: cashflow.id };
      },
      // Serializable — đọc cashflows để derive vị thế rồi ghi phải cùng transaction,
      // tránh hai request đồng thời cùng thấy vị thế cũ rồi cùng bán vượt (docs/rules/data-prisma.md).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    await triggerManualSnapshot("addTransaction", holdingId);

    revalidateHoldingDependentRoutes(holdingId);
    return { ok: true, data: { holdingId, cashflowId: result.cashflowId } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      logger.warn({ holdingId }, "addTransaction race, ask to retry");
      return {
        ok: false,
        error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
      };
    }
    logger.error({ err, holdingId }, "addTransaction failed");
    throw err;
  }
}

export async function updateTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const {
    cashflowId,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = parsed.data;

  try {
    const result = await runInTransaction(
      async (tx) => {
        const source = await findPositionSourceByCashflow(
          cashflowId,
          userId,
          tx,
        );
        if (!source) {
          return { ok: false as const, error: "Không tìm thấy giao dịch" };
        }

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: PENDING_EVENT_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [...source.cashflows.filter((cf) => cf.id !== cashflowId), candidate],
          source.dividends,
        );
        if (position.wentNegative) {
          return {
            ok: false as const,
            error:
              "Không thể sửa — số lượng sẽ âm tại một thời điểm trong lịch sử",
          };
        }

        const amount = computeCashflowAmount({
          type: cashflowType,
          quantity: candidate.quantity,
          pricePerUnit: candidate.pricePerUnit,
          feeAmount: new Decimal(feeAmount),
          taxAmount: new Decimal(taxAmount),
        });

        await updateCashflowRow(
          cashflowId,
          {
            type: cashflowType,
            date,
            quantity,
            pricePerUnit,
            amount: amount.toString(),
            feeAmount,
            taxAmount,
            note,
          },
          tx,
        );

        await persistPosition(source.holdingId, position, tx);

        return { ok: true as const, holdingId: source.holdingId };
      },
      // Serializable — cùng lý do với addTransaction: đọc lịch sử cashflow để
      // derive vị thế rồi ghi phải atomic với đọc.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    await triggerManualSnapshot("updateTransaction", result.holdingId);

    revalidateHoldingDependentRoutes(result.holdingId);
    // cashflowId đã có sẵn từ input (parsed.data) — không cần query lại.
    return { ok: true, data: { holdingId: result.holdingId, cashflowId } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      logger.warn({ cashflowId }, "updateTransaction race, ask to retry");
      return {
        ok: false,
        error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
      };
    }
    logger.error({ err, cashflowId }, "updateTransaction failed");
    throw err;
  }
}

export async function deleteTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string }>> {
  const parsed = deleteTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const { cashflowId } = parsed.data;

  try {
    const result = await runInTransaction(
      async (tx) => {
        const source = await findPositionSourceByCashflow(
          cashflowId,
          userId,
          tx,
        );
        if (!source) {
          return { ok: false as const, error: "Không tìm thấy giao dịch" };
        }

        const remaining = source.cashflows.filter((cf) => cf.id !== cashflowId);

        const position = derivePosition(remaining, source.dividends);
        if (position.wentNegative) {
          return {
            ok: false as const,
            error:
              "Không thể xóa — có giao dịch bán sau đó phụ thuộc vào số lượng này",
          };
        }

        await deleteCashflowRow(cashflowId, tx);

        await persistPosition(source.holdingId, position, tx);

        return { ok: true as const, holdingId: source.holdingId };
      },
      // Serializable — cùng lý do với addTransaction/updateTransaction.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    // Xoá vẫn kích hoạt trigger tự động (docs/domain/06-snapshots.md áp dụng cho cả 4
    // action) — chỉ riêng banner UI (TransactionSnapshotBanner) không hiện cho ca xoá
    // (không điều hướng đi đâu, không có cashflowId để gắn vào query string).
    await triggerManualSnapshot("deleteTransaction", result.holdingId);

    revalidateHoldingDependentRoutes(result.holdingId);
    return { ok: true, data: { holdingId: result.holdingId } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      logger.warn({ cashflowId }, "deleteTransaction race, ask to retry");
      return {
        ok: false,
        error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
      };
    }
    logger.error({ err, cashflowId }, "deleteTransaction failed");
    throw err;
  }
}

// Chữ ký khớp useActionState ((prevState, formData) => Promise<State>) — truyền
// thẳng làm prop `action` cho NavOverrideForm (Presentational, không tự bridge
// FormData như TransactionForm), giống cách settings/page.tsx truyền onSignOut
// là hàm "use server" trực tiếp. Cho phép nhập tay mọi AssetType (docs/domain/04
// -pricing-and-valuation.md: STOCK/FUND vẫn cho sửa tay khi cần, GOLD/BOND chỉ
// là loại mặc định dùng nhập tay) — không giới hạn cứng theo type ở đây.
export async function saveNavOverride(
  _prevState: NavOverrideFormState,
  formData: FormData,
): Promise<NavOverrideFormState> {
  const parsed = navOverrideSchema.safeParse({
    holdingId: formData.get("holdingId"),
    price: formData.get("price"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };

  const { holdingId, price, date } = parsed.data;

  if (!(await isHoldingOwnedByUser(holdingId, session.user.id))) {
    return { ok: false, error: "Không tìm thấy vị thế" };
  }

  try {
    // upsert theo unique (holdingId, date) — atomic ở tầng DB, không cần
    // $transaction/Serializable như các action cashflow: không có bất biến
    // derive (kiểu derivePosition) cần bảo vệ TOCTOU ở đây.
    await upsertNavOverride(holdingId, date, price);
  } catch (err) {
    logger.error({ err, holdingId }, "saveNavOverride failed");
    return { ok: false, error: "Không lưu được giá. Thử lại sau ít phút." };
  }

  revalidateHoldingDependentRoutes(holdingId);
  redirect(ROUTES.holdingDetail(holdingId));
}
