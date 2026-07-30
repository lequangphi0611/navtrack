import { cache } from "react";

import { getSession } from "@/lib/auth";

import { findHoldingRows } from "../repository";
import type { HoldingsOverview, HoldingSummary } from "../types";

// Danh sách vị thế Open/Closed (Phase 1) — dùng cho HoldingsOverviewLayout +
// mọi nơi cần danh mục thô (HoldingsPositionsSection, ClosedHoldingsSection,
// dashboard...).

// Memo theo request (như getSession) — nhiều Suspense region (danh sách vị thế
// open/closed) gọi độc lập vẫn chỉ tốn 1 DB round-trip/request.
//
// Đọc thuần materialized cache (quantity/avgCost) trên Holding — KHÔNG kéo cashflow.
// Cache được 4 action ghi cashflow recompute-in-transaction nên luôn khớp nguồn sự thật
// (docs/domain/02-transactions-and-cost-basis.md). Chi phí O(số holding), không phình
// theo lịch sử giao dịch.
const getHoldingsRaw = cache(async (): Promise<HoldingsOverview> => {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holdings = await findHoldingRows(session.user.id);

  const open: HoldingSummary[] = [];
  const closed: HoldingSummary[] = [];

  for (const holding of holdings) {
    const totalCostBasis = holding.quantity.mul(holding.avgCost);

    const summary: HoldingSummary = {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      unit: holding.unit,
      quantity: holding.quantity.toString(),
      avgCost: holding.avgCost.toString(),
      totalCostBasis: totalCostBasis.toString(),
    };

    if (holding.quantity.gt(0)) {
      open.push(summary);
    } else {
      closed.push(summary);
    }
  }

  return { open, closed };
});

export async function getOpenHoldings(): Promise<HoldingSummary[]> {
  return (await getHoldingsRaw()).open;
}

export async function getClosedHoldings(): Promise<HoldingSummary[]> {
  return (await getHoldingsRaw()).closed;
}

export async function hasAnyHolding(): Promise<boolean> {
  const { open, closed } = await getHoldingsRaw();
  return open.length > 0 || closed.length > 0;
}
