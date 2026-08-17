import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";
import type { HoldingSummary } from "@/features/holdings/types";
import type { HoldingValuation } from "@/lib/valuation";

// NAV ròng + lãi/lỗ theo vốn của TỪNG nhóm tài sản (issue #130, process/
// UI_allocation-group-pnl.md) — pure function, KHÔNG import DB/next-auth
// (cùng lý do computeStockGroupAllocation() nằm ở lib/stock-group-allocation.ts
// thay vì portfolio-valuation.ts: giữ test được không cần mock DB).
//
// Công thức lãi/lỗ PHẢI khớp `groupValuations.changePercent` ở
// getOpenHoldingsWithValuation() (features/holdings/queries/holdings-valuation.ts
// dòng ~96-141): (sumMarketValue − sumCostBasis) / sumCostBasis × 100, mẫu số
// CHỈ tính trên mã ĐÃ định giá (VALUED) trong nhóm — mã MISSING_PRICE bị loại
// khỏi CẢ NAV lẫn lãi/lỗ, không mặc định 0 (docs/domain/04-pricing-and-valuation.md).
export type AllocationGroupDetail = {
  type: AssetType;
  // 0-100, mẫu số = navSum (tổng NAV toàn danh mục các mã đã định giá) — công
  // thức % phân bổ GIỮ NGUYÊN như buildAllocation() hiện tại (KHÔNG bị mã
  // thiếu giá trong CHÍNH nhóm này làm đổi khác, vì tử số chỉ cộng phần đã có
  // giá và navSum là tham số ngoài, không phụ thuộc holding nào thiếu giá).
  percent: number;
  navAmount: Decimal;
  costBasisPriced: Decimal;
  pnlAmount: Decimal;
  pnlPercent: number;
  // true khi nhóm có >= 1 mã MISSING_PRICE.
  navIsPartial: boolean;
  pricedCount: number;
  totalCount: number;
  missingSymbols: string[];
};

// Thứ tự hiển thị cố định — khớp ASSET_TYPE_ORDER dùng ở
// buildAllocation()/portfolio-valuation.ts (STOCK, FUND, BOND, GOLD).
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

function isValued(
  valuation: HoldingValuation,
): valuation is Extract<HoldingValuation, { status: "VALUED" }> {
  return valuation.status === "VALUED";
}

type GroupAccumulator = {
  navAmount: Decimal;
  costBasisPriced: Decimal;
  pricedCount: number;
  totalCount: number;
  missingSymbols: string[];
};

// holdings/valuations/navSum — cùng input contract với buildAllocation()
// (portfolio-valuation.ts) để dùng chung một lượt valuateHoldings() ở tầng
// gọi. Nhóm có pricedCount === 0 (100% mã thiếu giá) bị loại HẲN khỏi kết quả
// — giữ đúng hành vi hiện tại của buildAllocation() (nhóm 0 mã có giá thì
// không xuất hiện).
export function computeAllocationGroupDetails(
  holdings: HoldingSummary[],
  valuations: Map<string, HoldingValuation>,
  navSum: Decimal,
): AllocationGroupDetail[] {
  const byType = new Map<AssetType, GroupAccumulator>();

  for (const holding of holdings) {
    const acc = byType.get(holding.type) ?? {
      navAmount: new Decimal(0),
      costBasisPriced: new Decimal(0),
      pricedCount: 0,
      totalCount: 0,
      missingSymbols: [],
    };
    acc.totalCount += 1;

    const valuation = valuations.get(holding.id);
    if (valuation && isValued(valuation)) {
      acc.navAmount = acc.navAmount.plus(valuation.nav);
      acc.costBasisPriced = acc.costBasisPriced.plus(
        new Decimal(holding.totalCostBasis),
      );
      acc.pricedCount += 1;
    } else {
      acc.missingSymbols.push(holding.symbol);
    }

    byType.set(holding.type, acc);
  }

  const result: AllocationGroupDetail[] = [];
  for (const type of ASSET_TYPE_ORDER) {
    const acc = byType.get(type);
    if (!acc || acc.pricedCount === 0) continue;

    const pnlAmount = acc.navAmount.minus(acc.costBasisPriced);
    const pnlPercent = acc.costBasisPriced.isZero()
      ? 0
      : pnlAmount.div(acc.costBasisPriced).mul(100).toNumber();
    const percent = navSum.isZero()
      ? 0
      : acc.navAmount.div(navSum).mul(100).toNumber();

    result.push({
      type,
      percent,
      navAmount: acc.navAmount,
      costBasisPriced: acc.costBasisPriced,
      pnlAmount,
      pnlPercent,
      navIsPartial: acc.missingSymbols.length > 0,
      pricedCount: acc.pricedCount,
      totalCount: acc.totalCount,
      missingSymbols: acc.missingSymbols,
    });
  }

  return result;
}
