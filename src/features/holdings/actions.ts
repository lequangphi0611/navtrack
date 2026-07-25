"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";
import type { Cashflow, Dividend } from "@prisma/client";
// Trigger tự động chốt Snapshot{period: MANUAL} sau mỗi giao dịch (docs/domain/06-snapshots.md
// "Khi nào lưu snapshot") — snapshots feature không phụ thuộc ngược vào holdings/actions.ts
// (chỉ holdings/queries.ts, xem features/snapshots/actions.ts) nên import chiều này không tạo vòng.
import { freezeManualSnapshot } from "@/features/snapshots/actions";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { computeCashflowAmount } from "@/lib/cost-basis";
import type {
  CashflowInputWithEvent,
  StockDividendInput,
} from "@/lib/cost-basis";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { revalidateHoldingDependentRoutes } from "@/lib/revalidate-holding-routes";
import { ROUTES } from "@/lib/routes";

import {
  addTransactionSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";
import type { NavOverrideFormState } from "./types";

function toCashflowInput(
  cf: Pick<
    Cashflow,
    | "id"
    | "type"
    | "date"
    | "createdAt"
    | "quantity"
    | "pricePerUnit"
    | "feeAmount"
  >,
): CashflowInputWithEvent {
  return {
    id: cf.id,
    type: cf.type,
    date: cf.date,
    createdAt: cf.createdAt,
    quantity: new Decimal(cf.quantity.toString()),
    pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    feeAmount: new Decimal(cf.feeAmount.toString()),
  };
}

function toStockDividendInput(
  dividend: Pick<Dividend, "id" | "date" | "createdAt" | "stockQuantity">,
): StockDividendInput {
  return {
    id: dividend.id,
    date: dividend.date,
    createdAt: dividend.createdAt,
    // Chỉ gọi hàm này với dividend đã lọc type === "STOCK" -> stockQuantity luôn có giá trị.
    quantity: new Decimal(dividend.stockQuantity!.toString()),
  };
}

// createdAt xa nhất có thể cho giao dịch ĐANG XỬ LÝ (chưa tồn tại trong DB) —
// cùng pattern PROBE_CREATED_AT (features/dividends/actions.ts): đảm bảo giao
// dịch mới LUÔN được coi là sự kiện GẦN NHẤT trong ngày khi trùng ngày với
// cashflow/dividend đã ghi trước đó, khớp trực giác "vừa nhập thì tính sau
// cùng" — không phụ thuộc độ trễ giữa lúc query chạy và lúc validate.
const CANDIDATE_CREATED_AT = new Date(8640000000000000);

// Ghi lại materialized cache vị thế lên Holding từ kết quả derivePosition đã tính sẵn.
// Gọi trong CÙNG transaction với mọi thay đổi cashflow — giữ cache luôn khớp nguồn sự thật
// (Cashflow), không bao giờ cập nhật cộng/trừ tay (docs/domain/02-transactions-and-cost-basis.md).
async function persistPosition(
  tx: Prisma.TransactionClient,
  holdingId: string,
  position: { quantity: Decimal; avgCost: Decimal },
): Promise<void> {
  await tx.holding.update({
    where: { id: holdingId },
    data: {
      quantity: position.quantity.toString(),
      avgCost: position.avgCost.toString(),
    },
  });
}

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
    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.holding.findUnique({
          where: { userId_symbol_type: { userId, symbol, type } },
          select: {
            id: true,
            cashflows: {
              select: {
                id: true,
                type: true,
                date: true,
                createdAt: true,
                quantity: true,
                pricePerUnit: true,
                feeAmount: true,
              },
              // Khớp thứ tự tie-break của migration backfill (date, createdAt, id) —
              // derivePosition() sort theo (date, createdAt, id) qua
              // buildQuantityTimeline(), orderBy này chỉ để nhất quán hiển thị debug,
              // không phải nguồn tie-break duy nhất.
              orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            },
            // Issue #59: SL đang giữ phải gồm cả cổ tức cổ phiếu, không chỉ Cashflow —
            // nếu không, wentNegative có thể báo "bán vượt" SAI cho lệnh bán hợp lệ
            // (SL bán nằm trong phần cổ tức cổ phiếu đã nhận), và cache ghi đè mất
            // phần cổ tức cổ phiếu đã cộng trước đó.
            dividends: {
              where: { type: "STOCK" },
              select: {
                id: true,
                date: true,
                createdAt: true,
                stockQuantity: true,
              },
            },
          },
        });

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: CANDIDATE_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [...(existing?.cashflows.map(toCashflowInput) ?? []), candidate],
          existing?.dividends.map(toStockDividendInput) ?? [],
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
        const holding =
          existing ??
          (await tx.holding.create({
            data: { userId, symbol, type, unit, name },
          }));

        const cashflow = await tx.cashflow.create({
          data: {
            holdingId: holding.id,
            type: cashflowType,
            date,
            quantity,
            pricePerUnit,
            amount: amount.toString(),
            feeAmount,
            taxAmount,
            note,
          },
        });

        await persistPosition(tx, holding.id, position);

        return {
          ok: true as const,
          holdingId: holding.id,
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
    const result = await db.$transaction(
      async (tx) => {
        const holding = await tx.holding.findUnique({
          where: { id: holdingId },
          select: {
            userId: true,
            cashflows: {
              select: {
                id: true,
                type: true,
                date: true,
                createdAt: true,
                quantity: true,
                pricePerUnit: true,
                feeAmount: true,
              },
              // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
              orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            },
            // Issue #59: xem ghi chú tương tự ở createHolding.
            dividends: {
              where: { type: "STOCK" },
              select: {
                id: true,
                date: true,
                createdAt: true,
                stockQuantity: true,
              },
            },
          },
        });
        if (!holding || holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy danh mục" };
        }

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: CANDIDATE_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [...holding.cashflows.map(toCashflowInput), candidate],
          holding.dividends.map(toStockDividendInput),
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

        const cashflow = await tx.cashflow.create({
          data: {
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
        });

        await persistPosition(tx, holdingId, position);

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
    const result = await db.$transaction(
      async (tx) => {
        const cashflow = await tx.cashflow.findUnique({
          where: { id: cashflowId },
          select: {
            holdingId: true,
            holding: {
              select: {
                userId: true,
                cashflows: {
                  select: {
                    id: true,
                    type: true,
                    date: true,
                    createdAt: true,
                    quantity: true,
                    pricePerUnit: true,
                    feeAmount: true,
                  },
                  // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
                  orderBy: [
                    { date: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                  ],
                },
                // Issue #59: xem ghi chú tương tự ở createHolding.
                dividends: {
                  where: { type: "STOCK" },
                  select: {
                    id: true,
                    date: true,
                    createdAt: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        });
        if (!cashflow || cashflow.holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy giao dịch" };
        }

        const candidate: CashflowInputWithEvent = {
          id: "__candidate__",
          type: cashflowType,
          date,
          createdAt: CANDIDATE_CREATED_AT,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
          feeAmount: new Decimal(feeAmount),
        };

        const position = derivePosition(
          [
            ...cashflow.holding.cashflows
              .filter((cf) => cf.id !== cashflowId)
              .map(toCashflowInput),
            candidate,
          ],
          cashflow.holding.dividends.map(toStockDividendInput),
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

        await tx.cashflow.update({
          where: { id: cashflowId },
          data: {
            type: cashflowType,
            date,
            quantity,
            pricePerUnit,
            amount: amount.toString(),
            feeAmount,
            taxAmount,
            note,
          },
        });

        await persistPosition(tx, cashflow.holdingId, position);

        return { ok: true as const, holdingId: cashflow.holdingId };
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
    const result = await db.$transaction(
      async (tx) => {
        const cashflow = await tx.cashflow.findUnique({
          where: { id: cashflowId },
          select: {
            holdingId: true,
            holding: {
              select: {
                userId: true,
                cashflows: {
                  select: {
                    id: true,
                    type: true,
                    date: true,
                    createdAt: true,
                    quantity: true,
                    pricePerUnit: true,
                    feeAmount: true,
                  },
                  // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
                  orderBy: [
                    { date: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                  ],
                },
                // Issue #59: xem ghi chú tương tự ở createHolding.
                dividends: {
                  where: { type: "STOCK" },
                  select: {
                    id: true,
                    date: true,
                    createdAt: true,
                    stockQuantity: true,
                  },
                },
              },
            },
          },
        });
        if (!cashflow || cashflow.holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy giao dịch" };
        }

        const remaining = cashflow.holding.cashflows
          .filter((cf) => cf.id !== cashflowId)
          .map(toCashflowInput);

        const position = derivePosition(
          remaining,
          cashflow.holding.dividends.map(toStockDividendInput),
        );
        if (position.wentNegative) {
          return {
            ok: false as const,
            error:
              "Không thể xóa — có giao dịch bán sau đó phụ thuộc vào số lượng này",
          };
        }

        await tx.cashflow.delete({ where: { id: cashflowId } });

        await persistPosition(tx, cashflow.holdingId, position);

        return { ok: true as const, holdingId: cashflow.holdingId };
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

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    select: { userId: true },
  });
  if (!holding || holding.userId !== session.user.id) {
    return { ok: false, error: "Không tìm thấy vị thế" };
  }

  try {
    // upsert theo unique (holdingId, date) — atomic ở tầng DB, không cần
    // $transaction/Serializable như các action cashflow: không có bất biến
    // derive (kiểu derivePosition) cần bảo vệ TOCTOU ở đây.
    await db.navOverride.upsert({
      where: { holdingId_date: { holdingId, date } },
      create: { holdingId, date, price },
      update: { price },
    });
  } catch (err) {
    logger.error({ err, holdingId }, "saveNavOverride failed");
    return { ok: false, error: "Không lưu được giá. Thử lại sau ít phút." };
  }

  revalidateHoldingDependentRoutes(holdingId);
  redirect(ROUTES.holdingDetail(holdingId));
}
