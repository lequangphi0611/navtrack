import Decimal from "decimal.js";

import type {
  GroupValuation,
  HoldingValuationExtras,
  HoldingWithValuation,
} from "@/features/holdings/components/HoldingsGroupCard";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { AUTO_PRICED_ASSET_TYPES, valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

import { groupHoldingsByType } from "../group-holdings";
import {
  findCashDividendsForHoldings,
  findCashflowsForHoldings,
} from "../repository";
import type { HoldingSummary } from "../types";
import { getOpenHoldings } from "./holdings-overview";
import { groupByHoldingId } from "./shared";

// Danh sách vị thế ĐANG MỞ + NAV/nguồn giá/XIRR riêng từng vị thế + NAV/%
// thay đổi theo nhóm loại tài sản (mockup 2b/2d) — dùng cho HoldingsPositionsSection
// khi status="open". Vị thế ĐÃ ĐÓNG cố ý KHÔNG mở rộng phạm vi này (getClosedHoldings
// giữ nguyên Phase 1) — "market value" của vị thế đã bán hết không có ý nghĩa hiển thị
// ở màn danh sách (docs/domain/04 "Vị thế đóng: NAV=0, không đóng góp").
export async function getOpenHoldingsWithValuation(cutoffDate?: Date): Promise<{
  holdings: HoldingWithValuation[];
  groupValuations: Partial<Record<HoldingSummary["type"], GroupValuation>>;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const resolvedCutoffDate =
    cutoffDate ?? resolveCutoffDate(await getCutoffSelection());

  const open = await getOpenHoldings();
  const holdingIds = open.map((h) => h.id);

  // Batch cả 3: valuateHoldings (giá) + cashflow + dividend cho TOÀN BỘ tập
  // holdingIds trong 1 lượt gọi mỗi loại — không N+1 theo từng vị thế.
  const [valuations, cashflows, dividends] = await Promise.all([
    valuateHoldings(
      open.map((h) => ({
        id: h.id,
        symbol: h.symbol,
        quantity: new Decimal(h.quantity),
      })),
      resolvedCutoffDate,
    ),
    findCashflowsForHoldings(holdingIds, session.user.id, resolvedCutoffDate),
    findCashDividendsForHoldings(
      holdingIds,
      session.user.id,
      resolvedCutoffDate,
    ),
  ]);

  const cashflowsByHolding = groupByHoldingId(cashflows);
  const dividendsByHolding = groupByHoldingId(dividends);

  const holdings: HoldingWithValuation[] = open.map((holding) => {
    const valuation = valuations.get(holding.id);
    const currentNav = valuation?.status === "VALUED" ? valuation.nav : null;

    // isOpenPosition luôn true — `open` đến từ getOpenHoldings() (quantity > 0
    // HÔM NAY, materialized cache), không phải vị thế-tại-cutoff (khác
    // getHoldingDetail, nơi cutoff có thể rơi vào lúc vị thế đã đóng/chưa mở —
    // phạm vi màn danh sách không cần chính xác tới mức đó).
    const xirrResult = computeXirr(
      buildXirrCashflows({
        cashflows: cashflowsByHolding.get(holding.id) ?? [],
        dividends: dividendsByHolding.get(holding.id) ?? [],
        isOpenPosition: true,
        cutoffDate: resolvedCutoffDate,
        currentNav,
      }),
    );

    const extras: Partial<HoldingValuationExtras> = {};
    if (valuation?.status === "VALUED") {
      extras.marketValue = valuation.nav.toString();
      extras.currentPricePerUnit = valuation.price.toString();
    }
    if (xirrResult.ok) {
      extras.annualReturnPercent = xirrResult.annualizedRate
        .mul(100)
        .toNumber();
    }

    return { ...holding, ...extras };
  });

  const groupValuations: Partial<
    Record<HoldingSummary["type"], GroupValuation>
  > = {};
  for (const group of groupHoldingsByType(open)) {
    const valuedNavs: Decimal[] = [];
    const valuedCostBasis: Decimal[] = [];
    for (const holding of group.holdings) {
      const valuation = valuations.get(holding.id);
      if (valuation?.status !== "VALUED") continue;
      valuedNavs.push(valuation.nav);
      valuedCostBasis.push(new Decimal(holding.totalCostBasis));
    }

    // Nhóm chưa có mã nào định giá được -> bỏ hẳn key này (component tự rơi
    // về hiển thị Phase 1 khi groupValuations[type] undefined).
    if (valuedNavs.length === 0) continue;

    const sumMarketValue = valuedNavs.reduce(
      (sum, nav) => sum.plus(nav),
      new Decimal(0),
    );
    const sumCostBasis = valuedCostBasis.reduce(
      (sum, cost) => sum.plus(cost),
      new Decimal(0),
    );

    // % thay đổi CHỈ tính trên các mã ĐÃ định giá trong nhóm (docs/domain/04 —
    // mã thiếu giá không được mặc định 0, trộn vào mẫu số sẽ làm sai %) —
    // tránh chia 0 khi (hi hữu) tổng vốn của riêng các mã đã định giá = 0.
    const changePercent = sumCostBasis.isZero()
      ? 0
      : sumMarketValue
          .minus(sumCostBasis)
          .div(sumCostBasis)
          .mul(100)
          .toNumber();

    groupValuations[group.type] = {
      // Nguồn giá của cả nhóm suy từ LOẠI tài sản (domain rule cố định —
      // AUTO_PRICED_ASSET_TYPES), không phải suy diễn ngược từ dữ liệu từng
      // mã (vd trộn AUTO/MANUAL nếu vài mã dùng NavOverride) — khớp cách
      // missingPriceReasonLabel (lib/portfolio-valuation.ts) dùng cùng tập
      // hằng số này.
      priceSource: AUTO_PRICED_ASSET_TYPES.has(group.type) ? "AUTO" : "MANUAL",
      changePercent,
    };
  }

  return { holdings, groupValuations };
}
