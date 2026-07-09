"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import type { Cashflow } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { computeCashflowAmount, derivePosition } from "@/lib/cost-basis";
import type { CashflowInput } from "@/lib/cost-basis";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

import {
  addTransactionSchema,
  deleteTransactionSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";

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

  const session = await auth();
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
    const existing = await db.holding.findUnique({
      where: { userId_symbol_type: { userId, symbol, type } },
      include: { cashflows: true },
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
      return { ok: false, error: "Bán vượt quá số lượng đang giữ" };
    }

    const amount = computeCashflowAmount({
      type: cashflowType,
      quantity: candidate.quantity,
      pricePerUnit: candidate.pricePerUnit,
      feeAmount: new Decimal(feeAmount),
      taxAmount: new Decimal(taxAmount),
    });

    const holdingId = await db.$transaction(async (tx) => {
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

      return holding.id;
    });

    revalidatePath("/holdings");
    return { ok: true, data: { holdingId } };
  } catch (err) {
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

  const session = await auth();
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
    const holding = await db.holding.findUnique({
      where: { id: holdingId },
      include: { cashflows: true },
    });
    if (!holding || holding.userId !== userId) {
      return { ok: false, error: "Không tìm thấy danh mục" };
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
        ok: false,
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

    await db.cashflow.create({
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

    revalidatePath(`/holdings/${holdingId}`);
    revalidatePath("/holdings");
    return { ok: true, data: { holdingId } };
  } catch (err) {
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

  const session = await auth();
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
    const cashflow = await db.cashflow.findUnique({
      where: { id: cashflowId },
      include: { holding: { include: { cashflows: true } } },
    });
    if (!cashflow || cashflow.holding.userId !== userId) {
      return { ok: false, error: "Không tìm thấy giao dịch" };
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
        ok: false,
        error: "Không thể sửa — số lượng sẽ âm tại một thời điểm trong lịch sử",
      };
    }

    const amount = computeCashflowAmount({
      type: cashflowType,
      quantity: candidate.quantity,
      pricePerUnit: candidate.pricePerUnit,
      feeAmount: new Decimal(feeAmount),
      taxAmount: new Decimal(taxAmount),
    });

    await db.cashflow.update({
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

    revalidatePath(`/holdings/${cashflow.holdingId}`);
    revalidatePath("/holdings");
    return { ok: true, data: { holdingId: cashflow.holdingId } };
  } catch (err) {
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

  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const { cashflowId } = parsed.data;

  try {
    const cashflow = await db.cashflow.findUnique({
      where: { id: cashflowId },
      include: { holding: { include: { cashflows: true } } },
    });
    if (!cashflow || cashflow.holding.userId !== userId) {
      return { ok: false, error: "Không tìm thấy giao dịch" };
    }

    const remaining = cashflow.holding.cashflows
      .filter((cf) => cf.id !== cashflowId)
      .map(toCashflowInput);

    const position = derivePosition(remaining);
    if (position.wentNegative) {
      return {
        ok: false,
        error:
          "Không thể xóa — có giao dịch bán sau đó phụ thuộc vào số lượng này",
      };
    }

    await db.cashflow.delete({ where: { id: cashflowId } });

    revalidatePath(`/holdings/${cashflow.holdingId}`);
    revalidatePath("/holdings");
    return { ok: true, data: { holdingId: cashflow.holdingId } };
  } catch (err) {
    logger.error({ err, cashflowId }, "deleteTransaction failed");
    throw err;
  }
}
