import Decimal from "decimal.js";

import type { HoldingSummary } from "@/features/holdings/types";
import type { HoldingValuation } from "@/lib/valuation";

// Drill-down "tỉ trọng theo mã trong nhóm cổ phiếu" (issue #132, phụ thuộc
// #131 cho phần UI/wiring — file này chỉ phần tính toán thuần, tách riêng
// khỏi portfolio-valuation.ts để giữ test được KHÔNG cần DB, cùng lý do
// computeConcentration() nằm ở lib/concentration.ts thay vì portfolio-
// valuation.ts: import lib/auth.ts ở đó kéo theo next-auth -> next/server,
// không resolve được trong môi trường test node). KHÁC concentrationPercent
// (lib/concentration.ts): mẫu số ở đây là NAV NHÓM STOCK, không phải NAV
// TOÀN DANH MỤC — hai con số % cố tình khác nhau, xem comment
// ConcentrationBadgeState.
export type StockGroupAllocationEntry = {
  holdingId: string;
  symbol: string;
  name: string | null;
  nav: Decimal;
  percentInGroup: number;
};

// Mã STOCK đang mở nhưng MISSING_PRICE — loại khỏi mẫu số (không suy diễn
// NAV=0, cùng nguyên tắc computeConcentration()), tách riêng để wiring sau
// này hiển thị trạng thái "Thiếu giá" thay vì một dòng 0%.
export type StockGroupMissingPriceEntry = {
  holdingId: string;
  symbol: string;
  name: string | null;
};

export type StockGroupAllocation = {
  groupNav: Decimal;
  // Sắp theo percentInGroup giảm dần (mockup 131a).
  entries: StockGroupAllocationEntry[];
  missingPrice: StockGroupMissingPriceEntry[];
};

function isValued(
  valuation: HoldingValuation,
): valuation is Extract<HoldingValuation, { status: "VALUED" }> {
  return valuation.status === "VALUED";
}

// Pure, unit-testable — caller (wiring) tự lọc CHỈ Holding ĐANG MỞ trước khi
// gọi, cùng hợp đồng với buildAllocation()/computeConcentration()
// (portfolio-valuation.ts/concentration.ts). Holding không phải STOCK bị
// loại khỏi mẫu số (mẫu số CHỈ nhóm cổ phiếu).
export function computeStockGroupAllocation(
  holdings: HoldingSummary[],
  valuations: Map<string, HoldingValuation>,
): StockGroupAllocation {
  const stockHoldings = holdings.filter((h) => h.type === "STOCK");

  const valued: { holding: HoldingSummary; nav: Decimal }[] = [];
  const missingPrice: StockGroupMissingPriceEntry[] = [];

  for (const holding of stockHoldings) {
    const valuation = valuations.get(holding.id);
    if (valuation && isValued(valuation)) {
      valued.push({ holding, nav: valuation.nav });
    } else {
      missingPrice.push({
        holdingId: holding.id,
        symbol: holding.symbol,
        name: holding.name,
      });
    }
  }

  const groupNav = valued.reduce((sum, x) => sum.plus(x.nav), new Decimal(0));

  const entries: StockGroupAllocationEntry[] = groupNav.isZero()
    ? []
    : valued
        .map(({ holding, nav }) => ({
          holdingId: holding.id,
          symbol: holding.symbol,
          name: holding.name,
          nav,
          percentInGroup: nav.div(groupNav).mul(100).toNumber(),
        }))
        .sort((a, b) => b.percentInGroup - a.percentInGroup);

  return { groupNav, entries, missingPrice };
}
