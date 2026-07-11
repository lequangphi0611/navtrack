import Decimal from "decimal.js";

import type { HoldingsGroup, HoldingSummary } from "./types";

// Thứ tự nhóm cố định khớp mockup 2d: Cổ phiếu, Quỹ mở, Trái phiếu, Vàng.
const GROUP_ORDER: HoldingSummary["type"][] = ["STOCK", "FUND", "BOND", "GOLD"];

export function groupHoldingsByType(
  holdings: HoldingSummary[],
): HoldingsGroup[] {
  const groups: HoldingsGroup[] = [];

  for (const type of GROUP_ORDER) {
    const items = holdings.filter((holding) => holding.type === type);
    if (items.length === 0) continue;

    const totalCostBasis = items
      .reduce(
        (sum, holding) => sum.plus(holding.totalCostBasis),
        new Decimal(0),
      )
      .toString();

    groups.push({ type, holdings: items, totalCostBasis });
  }

  return groups;
}
