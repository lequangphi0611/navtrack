import Decimal from "decimal.js";

import type { HoldingSwitcherHolding } from "@/components/HoldingSwitcher";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { valuateHoldings } from "@/lib/valuation";

import { getOpenHoldings } from "./holdings-overview";

// Danh sách Holding đang mở dùng cho HoldingSwitcher (issue #138 — tổng quát
// hoá khỏi dividends, dùng chung cho cả DividendForm và TransactionForm) —
// tái dùng getOpenHoldings() (đã filter userId + quantity > 0), chỉ thêm
// marketValue tại cutoff hiện tại. marketValue fallback về totalCostBasis khi
// MISSING_PRICE (docs/domain/04 "Thiếu giá": không mặc định 0, dùng vốn gốc
// làm ước lượng gần đúng cho màn chọn mã, không phải số chính thức hiển thị NAV).
export async function getOpenHoldingsForSwitcher(): Promise<
  HoldingSwitcherHolding[]
> {
  const open = await getOpenHoldings();
  const cutoffDate = resolveCutoffDate(await getCutoffSelection());

  const valuations = await valuateHoldings(
    open.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );

  return open.map((holding) => {
    const valuation = valuations.get(holding.id);
    const marketValue =
      valuation?.status === "VALUED"
        ? valuation.nav.toString()
        : holding.totalCostBasis;

    return {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      quantity: holding.quantity,
      unit: holding.unit,
      avgCost: holding.avgCost,
      marketValue,
    };
  });
}
