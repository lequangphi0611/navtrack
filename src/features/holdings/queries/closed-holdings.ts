import Decimal from "decimal.js";

import type { XirrResult as XirrResultUi } from "@/components/ReturnMetrics";
import { getSession } from "@/lib/auth";
import { computeCostDrag } from "@/lib/cost-drag";
import { resolveCutoffDate } from "@/lib/cutoff";
import { computeHoldingPeriodLabel } from "@/lib/holding-period";
// toUiXirr — cùng cycle holdings<->portfolio-valuation đã chấp nhận ở
// holding-detail.ts (sub-issue #108, xem comment đầy đủ ở đó): import ngược
// chiều với getOpenHoldings/getClosedHoldings mà portfolio-valuation.ts import
// qua barrel "@/features/holdings/queries", nhưng cả hai chỉ dùng nhau bên
// trong THÂN hàm — an toàn (live binding), không phải circular init thật.
import { toUiXirr } from "@/lib/portfolio-valuation";
import { computeWeightedAverageXirr } from "@/lib/weighted-average-xirr";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows, sumXirrPointsAmount } from "@/lib/xirr-cashflow";

import {
  findCashDividendsForHoldings,
  findCashflowDateRangeForHoldings,
  findCashflowsForHoldings,
} from "../repository";
import type { HoldingSummary } from "../types";
import { getClosedHoldings } from "./holdings-overview";
import { groupByHoldingId } from "./shared";

// Tab "Đã đóng" — chi tiết realized PnL/XIRR chốt/thời gian giữ (mục 7
// phase-6.md). Hàm MỚI, KHÔNG sửa getClosedHoldings() (holdings-overview.ts,
// dùng ở chỗ khác, chỉ trả HoldingSummary thuần).

export type ClosedHoldingRow = {
  id: string;
  symbol: string;
  name: string | null;
  type: HoldingSummary["type"];
  // "{N} tháng {M} ngày" — tính từ ngày mua ĐẦU TIÊN -> ngày bán HẾT cuối
  // cùng (min/max Cashflow.date theo holdingId). KHÔNG kèm tiền tố "nắm" — UI
  // tự ghép câu (xem lib/holding-period.ts).
  holdingPeriodLabel: string;
  realizedPnl: string; // Decimal serialize, có dấu
  realizedPnlPercent: number; // realizedPnl / vốn mua vào (gồm phí mua) * 100
  xirrRealized: XirrResultUi; // XIRR "chốt" (docs/domain/05 — SL=0, KHÔNG ghép NAV giả định)
  // Cổ tức tiền mặt nhận được lúc vị thế còn mở, đã gộp vào `realizedPnl`
  // (buildXirrCashflows đưa netAmount vào chuỗi XIRR) — trả riêng để UI
  // (ClosedHoldingsSection/ClosedPositionSheet) hiện thành dòng/khoản riêng
  // biệt, không để "Tổng mua/Tổng bán/Chênh lệch" trông như sai lệch phép
  // cộng trừ khi có cổ tức (code review #3, PR #81).
  cashDividends: {
    id: string;
    date: string; // ISO
    paymentDate: string | null; // ISO
    netAmount: string;
  }[];
};

export type ClosedHoldingsSummary = {
  totalRealizedPnl: string; // Σ realizedPnl mọi vị thế đã đóng
  // Weighted average theo vốn mua vào (lib/weighted-average-xirr.ts), CHỈ
  // trên holding xirr.status === "OK" — null khi không holding nào tính được.
  averageXirrRealized: XirrResultUi | null;
};

export type ClosedHoldingsDetail = {
  rows: ClosedHoldingRow[];
  summary: ClosedHoldingsSummary;
};

// Chi tiết vị thế ĐÃ ĐÓNG cho /holdings/closed (mockup 6g/6h/6i,
// process/UI_phase_6.md mục 4) — mở rộng getClosedHoldings() (Phase 1, chỉ
// trả quantity/avgCost/totalCostBasis thuần) với realized PnL/XIRR chốt/thời
// gian giữ. cutoffDate luôn "hôm nay" (KHÔNG đọc cookie mốc chốt user đang
// chọn) — vị thế đã đóng không phụ thuộc mốc chốt: dòng bán cuối là dòng tiền
// dương THẬT đã đủ cho công thức XIRR, không có NAV tại-mốc-chốt nào cần chọn
// (docs/domain/05 "Vị thế đã đóng").
export async function getClosedHoldingsDetail(): Promise<ClosedHoldingsDetail> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const closed = await getClosedHoldings();
  const cutoffDate = resolveCutoffDate({ key: "TODAY" });

  if (closed.length === 0) {
    return {
      rows: [],
      summary: { totalRealizedPnl: "0", averageXirrRealized: null },
    };
  }

  const closedIds = closed.map((h) => h.id);

  // Batch cashflow/dividend/khoảng thời gian nắm giữ cho TOÀN BỘ vị thế đã
  // đóng trong 1 lượt mỗi loại — trước đây gọi computeXirrCore() N lần (1 vị
  // thế/lần), mỗi lần tự query cashflow + dividend riêng -> N+1 (code review
  // #7). Vị thế đã đóng luôn quantity=0 nên KHÔNG cần valuateHoldings (giá) —
  // bỏ hẳn bước đó (computeXirrCore chỉ thật sự cần valuate cho vị thế còn
  // mở), tự tính points/XIRR tại đây bằng đúng 2 hàm thuần computeXirrCore
  // dùng bên trong (buildXirrCashflows + computeXirr), không round-trip DB
  // nào thêm ngoài 3 query batch dưới đây.
  const [cashflowPeriods, allCashflows, allDividends] = await Promise.all([
    findCashflowDateRangeForHoldings(closedIds, session.user.id),
    findCashflowsForHoldings(closedIds, session.user.id, cutoffDate),
    findCashDividendsForHoldings(closedIds, session.user.id, cutoffDate),
  ]);

  const periodByHoldingId = new Map(
    cashflowPeriods.map((row) => [row.holdingId, row]),
  );
  const cashflowsByHolding = groupByHoldingId(allCashflows);
  const dividendsByHolding = groupByHoldingId(allDividends);

  const computed = closed.map((holding) => {
    const cashflows = cashflowsByHolding.get(holding.id) ?? [];
    const dividends = dividendsByHolding.get(holding.id) ?? [];

    // isOpenPosition=false, currentNav=null — vị thế đã đóng KHÔNG ghép NAV
    // giả định, dòng bán cuối đã là dòng tiền dương thật, đủ cho công thức
    // (docs/domain/05 "Vị thế đã đóng: XIRR chốt"), cùng công thức
    // computeXirrCore() dùng trước đây cho từng holding.
    const points = buildXirrCashflows({
      cashflows,
      dividends,
      isOpenPosition: false,
      cutoffDate,
      currentNav: null,
    });
    const xirr = computeXirr(points);

    // "NAV cuối kỳ (=0, đã đóng) − vốn ròng đã bỏ vào" tương đương đại số
    // với tổng có dấu của các điểm đã đưa vào XIRR — MỘT hàm dùng chung với
    // computeXirrAndPnlCore (lib/portfolio-valuation.ts), xem sumXirrPointsAmount.
    const realizedPnl = sumXirrPointsAmount(points);

    // Vốn mua vào (gồm phí mua) = Σ|BUY.amount| — dùng LUÔN làm trọng số
    // cho weighted average XIRR bên dưới (process/DECISION.md 2026-07-21).
    const { grossInvested } = computeCostDrag(cashflows, []);

    const realizedPnlPercent = grossInvested.isZero()
      ? 0
      : realizedPnl.div(grossInvested).mul(100).toNumber();

    const period = periodByHoldingId.get(holding.id);
    const holdingPeriodLabel =
      period?.minDate && period.maxDate
        ? computeHoldingPeriodLabel(period.minDate, period.maxDate)
        : "";

    const row: ClosedHoldingRow = {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      holdingPeriodLabel,
      realizedPnl: realizedPnl.toString(),
      realizedPnlPercent,
      xirrRealized: toUiXirr(xirr),
      cashDividends: dividends.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        paymentDate: d.paymentDate?.toISOString() ?? null,
        netAmount: d.netAmount.toString(),
      })),
    };

    return { row, xirr, grossInvested, realizedPnl };
  });

  const totalRealizedPnl = computed
    .reduce((sum, c) => sum.plus(c.realizedPnl), new Decimal(0))
    .toString();

  const weightedRate = computeWeightedAverageXirr(
    computed.map((c) => ({ xirr: c.xirr, capital: c.grossInvested })),
  );

  return {
    rows: computed.map((c) => c.row),
    summary: {
      totalRealizedPnl,
      averageXirrRealized: weightedRate
        ? { status: "OK", percentPerYear: weightedRate.mul(100).toNumber() }
        : null,
    },
  };
}
