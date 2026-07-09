import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { db } from "@/lib/db";

import type { CashflowRow, HoldingDetail, OpenHolding } from "./types";

export async function getOpenHoldings(): Promise<OpenHolding[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holdings = await db.holding.findMany({
    where: { userId: session.user.id },
    include: { cashflows: true },
    orderBy: { symbol: "asc" },
  });

  return holdings
    .map((holding) => {
      const position = derivePosition(
        holding.cashflows.map((cf) => ({
          type: cf.type,
          date: cf.date,
          quantity: new Decimal(cf.quantity.toString()),
          pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
        })),
      );

      return {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        type: holding.type,
        unit: holding.unit,
        quantity: position.quantity,
        avgCost: position.avgCost,
      };
    })
    .filter((holding) => holding.quantity.gt(0))
    .map((holding): OpenHolding => ({
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      unit: holding.unit,
      quantity: holding.quantity.toString(),
      avgCost: holding.avgCost.toString(),
      totalCostBasis: holding.quantity.mul(holding.avgCost).toString(),
    }));
}

export async function getHoldingDetail(
  holdingId: string,
): Promise<HoldingDetail> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    include: { cashflows: { orderBy: { date: "desc" } } },
  });

  // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau, không lộ thông tin tồn tại.
  if (!holding || holding.userId !== session.user.id) notFound();

  const position = derivePosition(
    holding.cashflows.map((cf) => ({
      type: cf.type,
      date: cf.date,
      quantity: new Decimal(cf.quantity.toString()),
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    })),
  );

  const cashflows: CashflowRow[] = holding.cashflows.map((cf) => ({
    id: cf.id,
    type: cf.type,
    date: cf.date.toISOString(),
    quantity: cf.quantity.toString(),
    pricePerUnit: cf.pricePerUnit.toString(),
    amount: cf.amount.toString(),
    feeAmount: cf.feeAmount.toString(),
    taxAmount: cf.taxAmount.toString(),
    note: cf.note,
  }));

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: position.quantity.toString(),
    avgCost: position.avgCost.toString(),
    totalCostBasis: position.quantity.mul(position.avgCost).toString(),
    cashflows,
  };
}
