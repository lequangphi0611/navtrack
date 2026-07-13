"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";
import type { Cashflow } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { computeCashflowAmount, derivePosition } from "@/lib/cost-basis";
import type { CashflowInput } from "@/lib/cost-basis";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";

import { getHoldingCashflowPage } from "./queries";
import {
  addTransactionSchema,
  deleteTransactionSchema,
  loadMoreCashflowsSchema,
  navOverrideSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";
import type { CashflowPage, NavOverrideFormState } from "./types";

function toCashflowInput(
  cf: Pick<Cashflow, "type" | "date" | "quantity" | "pricePerUnit">,
): CashflowInput {
  return {
    type: cf.type,
    date: cf.date,
    quantity: new Decimal(cf.quantity.toString()),
    pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
  };
}

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

export async function createHolding(
  input: unknown,
): Promise<ActionResult<{ holdingId: string }>> {
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
                type: true,
                date: true,
                quantity: true,
                pricePerUnit: true,
              },
              // Khớp thứ tự tie-break của migration backfill (date, createdAt, id) —
              // derivePosition() chỉ sort theo date, dựa vào thứ tự DB trả về để
              // phá vỡ trùng ngày một cách nhất quán giữa các lần ghi cache.
              orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            },
          },
        });

        const candidate: CashflowInput = {
          type: cashflowType,
          date,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
        };

        const position = derivePosition([
          ...(existing?.cashflows.map(toCashflowInput) ?? []),
          candidate,
        ]);
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

        await tx.cashflow.create({
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

        return { ok: true as const, holdingId: holding.id };
      },
      // Serializable — cùng lý do với addTransaction: đọc cashflows để derive vị thế
      // rồi ghi persistPosition phải atomic với đọc, kể cả khi merge vào holding đã có
      // (không có unique constraint nào bảo vệ đường ghi này).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    revalidatePath(ROUTES.holdingDetail(result.holdingId));
    revalidatePath(ROUTES.holdings);
    revalidatePath(ROUTES.holdingsClosed);
    return { ok: true, data: { holdingId: result.holdingId } };
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
): Promise<ActionResult<{ holdingId: string }>> {
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
                type: true,
                date: true,
                quantity: true,
                pricePerUnit: true,
              },
              // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
              orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            },
          },
        });
        if (!holding || holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy danh mục" };
        }

        const candidate: CashflowInput = {
          type: cashflowType,
          date,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
        };

        const position = derivePosition([
          ...holding.cashflows.map(toCashflowInput),
          candidate,
        ]);
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

        await tx.cashflow.create({
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

        return { ok: true as const };
      },
      // Serializable — đọc cashflows để derive vị thế rồi ghi phải cùng transaction,
      // tránh hai request đồng thời cùng thấy vị thế cũ rồi cùng bán vượt (docs/rules/data-prisma.md).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    revalidatePath(ROUTES.holdingDetail(holdingId));
    revalidatePath(ROUTES.holdings);
    revalidatePath(ROUTES.holdingsClosed);
    return { ok: true, data: { holdingId } };
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
): Promise<ActionResult<{ holdingId: string }>> {
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
                    quantity: true,
                    pricePerUnit: true,
                  },
                  // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
                  orderBy: [
                    { date: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                  ],
                },
              },
            },
          },
        });
        if (!cashflow || cashflow.holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy giao dịch" };
        }

        const candidate: CashflowInput = {
          type: cashflowType,
          date,
          quantity: new Decimal(quantity),
          pricePerUnit: new Decimal(pricePerUnit),
        };

        const position = derivePosition([
          ...cashflow.holding.cashflows
            .filter((cf) => cf.id !== cashflowId)
            .map(toCashflowInput),
          candidate,
        ]);
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

    revalidatePath(ROUTES.holdingDetail(result.holdingId));
    revalidatePath(ROUTES.holdings);
    revalidatePath(ROUTES.holdingsClosed);
    return { ok: true, data: { holdingId: result.holdingId } };
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
                    quantity: true,
                    pricePerUnit: true,
                  },
                  // Khớp thứ tự tie-break của migration backfill (date, createdAt, id).
                  orderBy: [
                    { date: "asc" },
                    { createdAt: "asc" },
                    { id: "asc" },
                  ],
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

        const position = derivePosition(remaining);
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

    revalidatePath(ROUTES.holdingDetail(result.holdingId));
    revalidatePath(ROUTES.holdings);
    revalidatePath(ROUTES.holdingsClosed);
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

  revalidatePath(ROUTES.holdingDetail(holdingId));
  redirect(ROUTES.holdingDetail(holdingId));
}

// Đọc thuần (không mutate) — không cần revalidatePath. Bắt HẾT lỗi vào ok:false
// (khác các action mutation ở trên vốn cho rethrow lỗi lạ ra error.tsx) vì đây
// gọi từ 1 nút nhỏ trong TransactionHistoryList: rethrow sẽ crash cả trang chi
// tiết vị thế qua error boundary chỉ vì tải thêm lịch sử thất bại. Không lộ lý
// do chi tiết (vd "Invalid cursor") ra client — tránh gợi ý cursor đoán được
// có match holding hay không.
export async function loadMoreCashflows(
  input: unknown,
): Promise<ActionResult<CashflowPage>> {
  const parsed = loadMoreCashflowsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    const page = await getHoldingCashflowPage(
      parsed.data.holdingId,
      parsed.data.cursor,
    );
    return { ok: true, data: page };
  } catch (err) {
    logger.error(
      { err, holdingId: parsed.data.holdingId },
      "loadMoreCashflows failed",
    );
    return { ok: false, error: "Không tải được thêm giao dịch" };
  }
}
