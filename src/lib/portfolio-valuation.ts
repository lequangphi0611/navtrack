import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";
import { type AssetType, ASSET_TYPE_LABEL } from "@/components/AssetTypeBadge";
import type { XirrResult as XirrResultUi } from "@/components/ReturnMetrics";
import type { AllocationSlice } from "@/features/dashboard/components/AllocationBar";
import type { MissingPriceHolding } from "@/features/dashboard/components/MissingPriceList";
import {
  getClosedHoldings,
  getOpenHoldings,
} from "@/features/holdings/queries";
import { findCashDividendsForHoldings } from "@/features/holdings/repository";
import type { HoldingSummary } from "@/features/holdings/types";
import { computeAllocationGroupDetails } from "@/lib/allocation-group-pnl";
import { getSession } from "@/lib/auth";
import {
  type ConcentrationBadgeState,
  computeConcentration,
} from "@/lib/concentration";
import {
  computeCostDrag,
  computeCostDragContributionPercent,
} from "@/lib/cost-drag";
import {
  CUTOFF_LABELS,
  type CutoffSelection,
  resolveCutoffDate,
} from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { db } from "@/lib/db";
import {
  formatDate,
  formatDayMonth,
  formatXirrBarePercent,
} from "@/lib/format";
import { logger } from "@/lib/logger";
import {
  computeRealizedGainForHolding,
  computeUnrealizedGain,
} from "@/lib/realized-pnl";
import { ROUTES, withFrom } from "@/lib/routes";
import { resolveDecimalSetting, SETTING_KEYS } from "@/lib/settings";
import { computeStockGroupAllocation } from "@/lib/stock-group-allocation";
import type { HoldingValuation } from "@/lib/valuation";
import { AUTO_PRICED_ASSET_TYPES, valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows, sumXirrPointsAmount } from "@/lib/xirr-cashflow";

// Một nguồn "chi phí ăn mòn" (docs/domain/07-tax.md mục "Chi phí ăn mòn") —
// `source` là enum thuần, KHÔNG kèm nhãn tiếng Việt (nhất quán cách tách UI
// copy khỏi lib đã làm ở missingPriceReasonLabel bên dưới); design-implementer
// tự gắn nhãn ("Phí giao dịch"/"Thuế bán"/"Thuế cổ tức") ở tầng UI.
// contributionPercent tính trên costDragAmount (KHÁC mẫu số costDragPercent ở
// dưới, vốn tính trên grossInvested) — 2 phép chia riêng biệt, dễ nhầm mẫu số.
export type CostDragBreakdownEntry = {
  source: "FEE" | "SALE_TAX" | "DIVIDEND_TAX";
  amount: string;
  contributionPercent: number;
};

// Holding đang mở, ĐANG dùng giá nhập tay (NavOverride) tại mốc chốt — khối
// mới "Đang dùng giá nhập tay" (khác hẳn MissingPriceHolding, vốn là những mã
// CHƯA có giá nào). Định nghĩa ở đây (không import từ component như
// MissingPriceHolding) vì component hiển thị (ManualPriceList) chưa tồn tại —
// design-implementer tự định nghĩa Props khớp shape này.
export type ManualPriceHolding = {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  // Ngày của giá nhập tay đang dùng — dùng formatDate() (đầy đủ có năm, KHÔNG
  // phải formatDayMonth) vì giá nhập tay có thể cũ hơn 1 năm.
  priceDateLabel: string;
  href: string;
};

// Shape trả về bởi getPortfolioValuation() — khớp NGUYÊN VĂN
// DashboardScreenProps (features/dashboard/components/DashboardScreen) TRỪ
// displayName (lấy từ session ở page.tsx, không phải việc của query) và
// hidden (cờ ẩn số tiền, không set ở tầng dữ liệu). Khai độc lập (không
// `Omit<DashboardScreenProps, ...>`) vì file này nằm ở lib/ — lib/ không
// được phụ thuộc ngược vào features/ (cùng lý do đã ghi ở lib/cutoff.ts).
// TypeScript structural typing vẫn đảm bảo khớp Props khi spread ở page.tsx.
export type PortfolioValuation = {
  cutoffLabel: string;
  cutoffDate: string;
  cutoffHref: string;
  navValue: string;
  navValueIsPartial: boolean;
  navDeltaAmount: string;
  navDeltaPercent: number;
  xirr: XirrResultUi;
  absolutePnl: string;
  absolutePnlIsPartial: boolean;
  // Tách absolutePnl thành phần ĐÃ CHỐT (đã bán thật + cổ tức tiền mặt) và
  // TRÊN GIẤY (vị thế đang mở, NAV - vốn còn lại) — issue #67. Bất biến toán
  // học: realizedPnl + unrealizedPnl == absolutePnl TUYỆT ĐỐI (không xấp xỉ)
  // khi cutoff = hôm nay và không thiếu giá — phương pháp avgCost bình quân
  // di động đảm bảo Σ(vốn gốc trừ ra ở mỗi lần bán) + Σ(vốn gốc còn lại
  // trong vị thế đang giữ) = Σ|BUY.amount| (xem lib/realized-pnl.ts).
  // Dùng chung absolutePnlIsPartial (không có cờ isPartial riêng) — chỉ
  // unrealizedPnl bị ảnh hưởng khi thiếu giá.
  realizedPnl: string;
  unrealizedPnl: string;
  // true khi mốc chốt (cutoff) KHÁC "hôm nay" — realizedPnl/unrealizedPnl khi
  // đó có thể không cộng khớp tuyệt đối absolutePnl (unrealizedPnl luôn dùng
  // quantity/avgCost HIỆN TẠI, không phải tại cutoffDate — giới hạn có sẵn
  // của cơ chế cutoff, xem lib/portfolio-valuation.ts::computeXirrAndPnlCore).
  pnlSplitIsApproximate: boolean;
  allocation: AllocationSlice[];
  priceFreshnessNote: string;
  missingPriceHoldings: MissingPriceHolding[];
  // Holding đang mở, ĐANG dùng giá nhập tay (NavOverride) tại mốc chốt — KHÁC
  // missingPriceHoldings (chưa có giá nào cả). Cho phép user rà lại/cập nhật
  // giá nhập tay đã cũ (mockup — khối mới "Đang dùng giá nhập tay").
  manualPriceHoldings: ManualPriceHolding[];
  // Tổng vốn ròng đã bỏ vào TÍNH TỚI cutoffDate (XirrAndPnlCore.totalInvested)
  // — DashboardScreenProps không dùng field này (Dashboard không hiện dòng
  // "Vốn: ..."), chỉ HoldingsSummarySection (features/holdings) cần, nhưng
  // expose ở đây thay vì viết lại phép tính để NAV/XIRR/PnL/vốn LUÔN nhất
  // quán giữa Dashboard và Danh mục (cùng một lần gọi computeXirrAndPnlCore).
  totalCostBasis: string;
  // Vốn GỘP đã triển khai (Σ|BUY.amount|, KHÁC totalCostBasis vốn RÒNG ở
  // trên) — mẫu số của costDragPercent, và hiển thị trực tiếp là chỉ số "Vốn
  // đã bỏ ra mua" (mockup 5d). Không co lại khi đã bán nhiều (process/DECISION.md
  // 2026-07-17 (6)).
  grossInvested: string;
  costDragAmount: string;
  costDragPercent: number;
  costDragBreakdown: CostDragBreakdownEntry[];
};

function isValued(
  valuation: HoldingValuation,
): valuation is Extract<HoldingValuation, { status: "VALUED" }> {
  return valuation.status === "VALUED";
}

// docs/domain/04 "Thiếu giá": STOCK/FUND định giá tự động (vnstock) nên thiếu
// giá nghĩa là job chưa chạy/chưa có mã đó; BOND/GOLD mặc định nhập tay nên
// thiếu giá nghĩa là chưa ai nhập NavOverride.
function missingPriceReasonLabel(type: AssetType): string {
  const label = ASSET_TYPE_LABEL[type];
  const suffix = AUTO_PRICED_ASSET_TYPES.has(type)
    ? "chưa có giá tự động"
    : "chưa có giá nhập tay";
  return `${label} · ${suffix}`;
}

// Batch theo tập holdingId (không N+1) — process/phase-2.md mục cache/N+1.
// type/taxAmount/feeAmount thêm cho "chi phí ăn mòn" (docs/domain/07-tax.md
// mục "Chi phí ăn mòn") — cùng round-trip đã có, không query thêm lần 2.
async function getAllCashflowsForXirr(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<
  {
    id: string;
    date: Date;
    createdAt: Date;
    amount: Decimal;
    type: CashflowType;
    taxAmount: Decimal;
    feeAmount: Decimal;
    // holdingId/quantity thêm cho realized/unrealized PnL (issue #67, lib/
    // realized-pnl.ts) — buildXirrCashflows() chỉ đọc {date, amount} nên các
    // field thừa an toàn về type (structural typing), không cần sửa hàm đó.
    holdingId: string;
    quantity: Decimal;
  }[]
> {
  if (holdingIds.length === 0) return [];

  const rows = await db.cashflow.findMany({
    where: { holdingId: { in: holdingIds }, date: { lte: cutoffDate } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      date: true,
      createdAt: true,
      amount: true,
      type: true,
      taxAmount: true,
      feeAmount: true,
      holdingId: true,
      quantity: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    createdAt: row.createdAt,
    amount: new Decimal(row.amount.toString()),
    type: row.type,
    taxAmount: new Decimal(row.taxAmount.toString()),
    feeAmount: new Decimal(row.feeAmount.toString()),
    holdingId: row.holdingId,
    quantity: new Decimal(row.quantity.toString()),
  }));
}

// Cổ tức cổ phiếu <= cutoffDate cho toàn danh mục — cùng pattern batch với
// getAllCashDividendsForXirr() (gộp nhiều holdingId một lượt, không N+1).
// Dùng cho computeRealizedGainForHolding() (lib/realized-pnl.ts) track
// realQuantity — quantity luôn dương, không ảnh hưởng avgCost.
async function getAllStockDividendsForXirr(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<
  {
    id: string;
    holdingId: string;
    date: Date;
    createdAt: Date;
    quantity: Decimal;
  }[]
> {
  if (holdingIds.length === 0) return [];

  const rows = await db.dividend.findMany({
    where: {
      holdingId: { in: holdingIds },
      type: "STOCK",
      date: { lte: cutoffDate },
    },
    select: {
      id: true,
      holdingId: true,
      date: true,
      createdAt: true,
      stockQuantity: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    holdingId: row.holdingId,
    date: row.date,
    createdAt: row.createdAt,
    // stockQuantity luôn có mặt khi type === "STOCK" (schema chỉ nullable vì
    // field dùng chung cho cả CASH) — non-null assertion an toàn ở đây, cùng
    // pattern netAmount! ở getAllCashDividendsForXirr().
    quantity: new Decimal(row.stockQuantity!.toString()),
  }));
}

// Exported thêm cho getAllocationDetail() bên dưới (mục 6 phase-6.md — tái
// dùng đúng công thức, không viết lại lần 2). Refactor NỘI BỘ (issue #130) để
// gọi computeAllocationGroupDetails() (lib/allocation-group-pnl.ts, pure) rồi
// chỉ giữ lại {type, percent} — GIỮ NGUYÊN 100% chữ ký/hành vi output cho mọi
// caller hiện có (Dashboard getPortfolioValuation() không đổi kết quả).
export function buildAllocation(
  holdings: HoldingSummary[],
  valuations: Map<string, HoldingValuation>,
  navSum: Decimal,
): AllocationSlice[] {
  // Tránh chia 0 — cũng đúng nghĩa nghiệp vụ: chưa có mã nào định giá được thì
  // chưa có gì để phân bổ (mockup 2f: allocation rỗng khi NAV không xác định).
  if (navSum.isZero()) return [];

  return computeAllocationGroupDetails(holdings, valuations, navSum).map(
    (detail) => ({ type: detail.type, percent: detail.percent }),
  );
}

// Ghi chú độ tươi của giá (mockup 2a): mốc PriceQuote tự động mới nhất <=
// cutoffDate trong các mã đang mở + số mã đang dùng giá nhập tay (NavOverride)
// tại mốc chốt. Lọc theo cutoffDate để nhất quán với mọi lookup giá khác
// trong file này (valuateHoldings/getLatestPriceQuotes/getLatestNavOverrides)
// — thiếu filter này khiến ghi chú "cập nhật EOD ..." hiện ngày mới hơn cả
// mốc chốt đang xem (vd đang xem "cuối tháng trước" nhưng ghi chú lại nói
// giá cập nhật hôm nay).
async function getPriceFreshnessNote(
  open: HoldingSummary[],
  valuations: Map<string, HoldingValuation>,
  cutoffDate: Date,
): Promise<string> {
  if (open.length === 0) return "";

  const manualCount = [...valuations.values()].filter(
    (v) => isValued(v) && v.source === "MANUAL",
  ).length;

  const symbols = [...new Set(open.map((h) => h.symbol))];
  const latestQuote = await db.priceQuote.findFirst({
    where: { symbol: { in: symbols }, date: { lte: cutoffDate } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!latestQuote) {
    return manualCount > 0
      ? `${manualCount} mã dùng giá nhập tay · chưa có giá tự động`
      : "Chưa có giá tự động nào được ghi nhận";
  }

  const base = `Giá tự động cập nhật EOD ${formatDayMonth(latestQuote.date)}`;
  return manualCount > 0
    ? `${base} · ${manualCount} mã dùng giá nhập tay`
    : base;
}

// Adapter shape business (ok/reason/Decimal, lib/xirr.ts) -> shape UI
// (status/percentPerYear/number, @/components/ReturnMetrics) — hai type khác
// nhau có chủ đích (xem comment HoldingDetailValuation trong holdings/types.ts).
// Export vì getHoldingDetail() (features/holdings/queries.ts) cũng cần adapter
// này để build HoldingDetailValuation.xirr — tránh viết lại lần 2.
export function toUiXirr(result: ReturnType<typeof computeXirr>): XirrResultUi {
  if (result.ok) {
    return {
      status: "OK",
      percentPerYear: result.annualizedRate.mul(100).toNumber(),
    };
  }
  return { status: result.reason };
}

// Phần lõi dùng chung giữa getPortfolioValuation() (đầy đủ, cho Dashboard) và
// getXirrForCutoff() (nhẹ, chỉ cần XIRR — cho preview 3 mốc ở Settings,
// getCutoffOptions()) — valuateHoldings + cashflow/dividend + XIRR + lãi/lỗ +
// tổng vốn ròng LUÔN cần tính bất kể caller nào, chỉ allocation/missingPrice/
// priceFreshnessNote là phần "đắt" riêng của Dashboard nên tách ra ngoài hàm
// này (process/DECISION.md — tránh gọi dư 3 lần valuateHoldings+allocation+
// priceFreshnessNote không cần thiết khi Settings chỉ đọc .xirr).
type XirrAndPnlCore = {
  cutoffDate: Date;
  open: HoldingSummary[];
  allHoldings: HoldingSummary[];
  valuations: Map<string, HoldingValuation>;
  navSum: Decimal;
  xirr: ReturnType<typeof computeXirr>;
  absolutePnl: Decimal;
  // Tách absolutePnl thành đã chốt/trên giấy (issue #67) — xem comment đầy đủ
  // ở PortfolioValuation.realizedPnl/unrealizedPnl (bất biến toán học +
  // tham chiếu công thức, lib/realized-pnl.ts).
  realizedPnl: Decimal;
  unrealizedPnl: Decimal;
  // Tổng vốn ròng đã bỏ vào TÍNH TỚI cutoffDate, cho TẤT CẢ holding (mở lẫn
  // đóng) — docs/domain/05 "Cách tính": Σ tiền ra (mua) − Σ tiền vào đã rút
  // (bán + cổ tức) trước mốc. CỐ Ý không dùng getTotalInvested() (chỉ tính
  // vốn của holding đang mở theo HÔM NAY, không theo cutoff — sai denominator
  // cho navDeltaPercent khi cutoff khác "hôm nay", xem code review #2).
  totalInvested: Decimal;
  // "Chi phí ăn mòn" (docs/domain/07-tax.md mục "Chi phí ăn mòn") — grossInvested
  // là vốn GỘP (Σ|BUY.amount|), KHÁC totalInvested vốn RÒNG ở trên (không co
  // lại khi bán nhiều, process/DECISION.md 2026-07-17 (6)). feeTotal/
  // saleTaxTotal/dividendTaxTotal giữ riêng (không chỉ costDragAmount đã cộng
  // dồn) để getPortfolioValuation() build costDragBreakdown theo 3 nguồn.
  grossInvested: Decimal;
  feeTotal: Decimal;
  saleTaxTotal: Decimal;
  dividendTaxTotal: Decimal;
  costDragAmount: Decimal;
  costDragPercent: number;
  // true khi mốc chốt KHÁC "hôm nay" — xem comment tại nơi tính giá trị này
  // trong computeXirrAndPnlCore() (issue #83 code review #2).
  pnlSplitIsApproximate: boolean;
};

// Holding tối thiểu cần cho computeXirrCore — cả getOpenHoldings/
// getClosedHoldings (HoldingSummary.quantity: string) lẫn
// getAllHoldingIdsAndQuantities (quantity: Decimal) đều map được vào type
// này, caller tự chịu convert Decimal trước khi gọi.
export type HoldingForXirr = { id: string; symbol: string; quantity: Decimal };

// Phần TÍNH TOÁN dùng chung giữa computeXirrAndPnlCore() (Dashboard/Danh mục,
// đọc holdings qua getOpenHoldings/getClosedHoldings đã cache() theo request),
// getCurrentPortfolioXirrPercent() (cần đọc THẲNG DB, không qua cache() —
// xem comment getAllHoldingIdsAndQuantities bên dưới), và
// getClosedHoldingsDetail() (features/holdings/queries.ts — gọi với DUY NHẤT
// 1 Holding/lần để lấy XIRR "chốt" + realizedPnl riêng từng vị thế đã đóng,
// mục 7 phase-6.md) — valuate + gom cashflow/dividend + build điểm XIRR +
// computeXirr từng bị lặp lại giữa hai hàm, tách ra đây để chỉ 1 nơi giữ đúng
// thứ tự các bước này (process/DECISION.md mục dedupe XIRR core). KHÔNG tự gọi
// getSession()/getOpenHoldings()/getClosedHoldings() bên trong — nhận holdings
// + cutoffDate trực tiếp để caller tự quyết định nguồn đọc (cache() theo
// request hay DB tươi). Nhận thêm `userId` (thay vì tin holdingIds truyền vào
// đã lọc sẵn) để findCashDividendsForHoldings() tự filter userId trực tiếp —
// gộp lại nguồn cổ tức/trái tức với features/holdings/repository.ts, đóng
// việc còn treo ở process/DECISION.md 2026-07-29 (2 cài đặt song song, bản ở
// đây thiếu filter userId trực tiếp).
export async function computeXirrCore({
  holdings,
  userId,
  cutoffDate,
}: {
  holdings: HoldingForXirr[];
  userId: string;
  cutoffDate: Date;
}): Promise<{
  valuations: Map<string, HoldingValuation>;
  currentNav: Decimal | null;
  isOpenPosition: boolean;
  points: ReturnType<typeof buildXirrCashflows>;
  xirr: ReturnType<typeof computeXirr>;
  cashflows: Awaited<ReturnType<typeof getAllCashflowsForXirr>>;
  dividends: Awaited<ReturnType<typeof findCashDividendsForHoldings>>;
}> {
  const holdingIds = holdings.map((h) => h.id);
  const [valuations, cashflows, dividends] = await Promise.all([
    valuateHoldings(holdings, cutoffDate),
    getAllCashflowsForXirr(holdingIds, cutoffDate),
    findCashDividendsForHoldings(holdingIds, userId, cutoffDate),
  ]);

  const validNavs = [...valuations.values()].filter(isValued).map((v) => v.nav);
  // NULL (KHÔNG Decimal(0)) khi chưa có mã nào định giá được — nếu để 0,
  // buildXirrCashflows ghép 1 dòng tiền dương giả = 0, khiến XIRR/PnL trông
  // như "mất trắng" thay vì đúng ca biên "không tính được" (docs/domain/05).
  const currentNav =
    validNavs.length > 0
      ? validNavs.reduce((sum, nav) => sum.plus(nav), new Decimal(0))
      : null;

  const isOpenPosition = holdings.some((h) => !h.quantity.isZero());

  const points = buildXirrCashflows({
    cashflows,
    dividends,
    isOpenPosition,
    cutoffDate,
    currentNav,
  });

  return {
    valuations,
    currentNav,
    isOpenPosition,
    points,
    xirr: computeXirr(points),
    cashflows,
    dividends,
  };
}

async function computeXirrAndPnlCore(
  selection: CutoffSelection,
): Promise<XirrAndPnlCore> {
  const cutoffDate = resolveCutoffDate(selection);
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // getOpenHoldings/getClosedHoldings đọc từ getHoldingsRaw (cache() theo
  // request, đã filter userId) — gọi cả hai trong 1 request không tốn thêm
  // round-trip (process/phase-2.md "Hiện trạng fetch Phase 1").
  const [open, closed] = await Promise.all([
    getOpenHoldings(),
    getClosedHoldings(),
  ]);
  const allHoldings = [...open, ...closed];
  const allHoldingIds = allHoldings.map((h) => h.id);

  // getAllStockDividendsForXirr() chạy song song với computeXirrCore() (không
  // phụ thuộc kết quả của nhau) — tránh thêm round-trip tuần tự thừa.
  const [
    { valuations, currentNav, points, xirr, cashflows, dividends },
    stockDividends,
  ] = await Promise.all([
    computeXirrCore({
      holdings: allHoldings.map((h) => ({
        id: h.id,
        symbol: h.symbol,
        quantity: new Decimal(h.quantity),
      })),
      userId: session.user.id,
      cutoffDate,
    }),
    getAllStockDividendsForXirr(allHoldingIds, cutoffDate),
  ]);

  // currentNav là null (không phải Decimal(0)) khi chưa mã nào định giá được
  // (xem comment computeXirrCore) — navSum ở XirrAndPnlCore luôn là Decimal
  // (không nullable) cho mục đích hiển thị, nên quy về 0 ở đây.
  const navSum = currentNav ?? new Decimal(0);

  // "NAV − tổng vốn ròng đã bỏ vào" tương đương đại số với tổng có dấu của
  // đúng tập điểm đã đưa vào XIRR (Cashflow.amount mang dấu chuẩn BUY âm/SELL
  // dương + Dividend dương + NAV giả định dương) — không cần công thức riêng.
  const absolutePnl = sumXirrPointsAmount(points);

  // Tổng vốn ròng = -(Σ Cashflow.amount + Σ Dividend.netAmount) trước cutoff,
  // KHÔNG gồm điểm NAV giả định (points ở trên có thể có, nhưng cashflows/
  // dividends thì không) — tương đương đại số với "Σ tiền ra (mua) − Σ tiền
  // vào đã rút (bán + cổ tức)" vì BUY âm/SELL+Dividend dương theo quy ước
  // (docs/domain/02-transactions-and-cost-basis.md).
  const cashflowSum = cashflows.reduce(
    (sum, cf) => sum.plus(cf.amount),
    new Decimal(0),
  );
  const dividendSum = dividends.reduce(
    (sum, d) => sum.plus(d.netAmount),
    new Decimal(0),
  );
  const totalInvested = cashflowSum.plus(dividendSum).negated();

  // "Chi phí ăn mòn" (docs/domain/07-tax.md mục "Chi phí ăn mòn") — công thức
  // thuần tách riêng ở lib/cost-drag.ts (unit test không cần DB).
  const {
    grossInvested,
    feeTotal,
    saleTaxTotal,
    dividendTaxTotal,
    costDragAmount,
    costDragPercent,
  } = computeCostDrag(cashflows, dividends);

  // Realized/unrealized PnL (issue #67, lib/realized-pnl.ts) — tách
  // absolutePnl thành phần ĐÃ CHỐT (bán thật + cổ tức) và TRÊN GIẤY (vị thế
  // đang mở). Nhóm cashflows VÀ cổ tức cổ phiếu theo holdingId bằng Map (cùng
  // pattern navByType ở buildAllocation) rồi tính lãi/lỗ chốt riêng từng
  // holding — cổ tức cổ phiếu (issue #83 code review #1) không tạo Cashflow
  // nên phải truyền riêng để computeRealizedGainForHolding() track đúng lúc
  // vị thế thực sự đóng hết (xem comment lib/realized-pnl.ts).
  const cashflowsByHolding = new Map<string, typeof cashflows>();
  for (const cf of cashflows) {
    const group = cashflowsByHolding.get(cf.holdingId) ?? [];
    group.push(cf);
    cashflowsByHolding.set(cf.holdingId, group);
  }
  const stockDividendsByHolding = new Map<string, typeof stockDividends>();
  for (const dividend of stockDividends) {
    const group = stockDividendsByHolding.get(dividend.holdingId) ?? [];
    group.push(dividend);
    stockDividendsByHolding.set(dividend.holdingId, group);
  }
  const realizedGainFromSales = [...cashflowsByHolding.entries()].reduce(
    (sum, [holdingId, group]) =>
      sum.plus(
        computeRealizedGainForHolding(
          group,
          stockDividendsByHolding.get(holdingId) ?? [],
        ),
      ),
    new Decimal(0),
  );
  const realizedPnl = realizedGainFromSales.plus(dividendSum);

  // unrealizedPnl chỉ tính trên vị thế đang mở ĐỊNH GIÁ ĐƯỢC (isValued) —
  // CHÚ Ý: dùng quantity/avgCost HIỆN TẠI (cache materialize trên Holding,
  // HoldingSummary.totalCostBasis), KHÔNG phải tại cutoffDate — giới hạn CÓ
  // SẴN của toàn cơ chế cutoff trong file này (NAV cũng dùng cùng cách),
  // không phải lỗi mới phát sinh từ issue #67.
  const unrealizedPositions = open.flatMap((h) => {
    const valuation = valuations.get(h.id);
    if (!valuation || !isValued(valuation)) return [];
    return [
      { navValue: valuation.nav, costBasis: new Decimal(h.totalCostBasis) },
    ];
  });
  const unrealizedPnl = computeUnrealizedGain(unrealizedPositions);

  // Cờ cảnh báo (issue #83 code review #2): unrealizedPnl LUÔN dùng
  // quantity/avgCost HIỆN TẠI (không phải tại cutoffDate — giới hạn có sẵn,
  // xem comment unrealizedPositions trên) nên khi mốc chốt KHÁC hôm nay, tổng
  // realizedPnl + unrealizedPnl có thể không khớp tuyệt đối với absolutePnl
  // tại đúng mốc đó — chỉ đúng tuyệt đối khi cutoff = TODAY. Thêm cờ để UI
  // cảnh báo thay vì sửa cơ chế cutoff tổng thể (process/DECISION.md).
  const pnlSplitIsApproximate = selection.key !== "TODAY";

  return {
    cutoffDate,
    open,
    allHoldings,
    valuations,
    navSum,
    xirr,
    absolutePnl,
    realizedPnl,
    unrealizedPnl,
    totalInvested,
    grossInvested,
    feeTotal,
    saleTaxTotal,
    dividendTaxTotal,
    costDragAmount,
    costDragPercent,
    pnlSplitIsApproximate,
  };
}

// NAV toàn danh mục + XIRR (theo năm) + lãi/lỗ tuyệt đối + phân bổ theo loại +
// danh sách mã thiếu giá, tại một mốc chốt (mặc định "hôm nay" —
// docs/domain/05-returns-xirr-and-pnl.md "Mốc chốt chọn được"). Dùng cho
// Dashboard (2a/2f) — process/UI_phase_2.md. Preview XIRR từng mốc ở Settings
// (2e) dùng getXirrForCutoff() (nhẹ hơn) thay vì hàm này.
export async function getPortfolioValuation(
  selection: CutoffSelection = { key: "TODAY" },
): Promise<PortfolioValuation> {
  const {
    cutoffDate,
    open,
    allHoldings,
    valuations,
    navSum,
    xirr,
    absolutePnl,
    realizedPnl,
    unrealizedPnl,
    totalInvested,
    grossInvested,
    feeTotal,
    saleTaxTotal,
    dividendTaxTotal,
    costDragAmount,
    costDragPercent,
    pnlSplitIsApproximate,
  } = await computeXirrAndPnlCore(selection);

  const missingPriceHoldings: MissingPriceHolding[] = open
    .filter((h) => valuations.get(h.id)?.status === "MISSING_PRICE")
    .map((h) => ({
      id: h.id,
      symbol: h.symbol,
      name: h.name ?? h.symbol,
      type: h.type,
      reasonLabel: missingPriceReasonLabel(h.type),
      href: withFrom(ROUTES.navOverrideNew(h.id), ROUTES.dashboard),
    }));

  // Holding đang mở đang dùng giá NHẬP TAY (NavOverride, docs/domain/04
  // "Nguồn giá") tại mốc chốt — KHÁC missingPriceHoldings ở trên (những mã đó
  // CHƯA có giá nào cả). Cho phép user rà lại/cập nhật giá nhập tay đã cũ.
  const manualPriceHoldings: ManualPriceHolding[] = open.flatMap((h) => {
    const valuation = valuations.get(h.id);
    if (!valuation || !isValued(valuation) || valuation.source !== "MANUAL") {
      return [];
    }
    return [
      {
        id: h.id,
        symbol: h.symbol,
        name: h.name ?? h.symbol,
        type: h.type,
        priceDateLabel: formatDate(valuation.priceDate),
        href: withFrom(ROUTES.navOverrideNew(h.id), ROUTES.dashboard),
      },
    ];
  });

  const navValueIsPartial = missingPriceHoldings.length > 0;
  const navDeltaPercent = totalInvested.isZero()
    ? 0
    : absolutePnl.div(totalInvested).mul(100).toNumber();

  const allocation = buildAllocation(allHoldings, valuations, navSum);
  const priceFreshnessNote = await getPriceFreshnessNote(
    open,
    valuations,
    cutoffDate,
  );

  // % đóng góp của MỖI nguồn trên costDragAmount (KHÁC costDragPercent — %
  // trên grossInvested), xem lib/cost-drag.ts::computeCostDragContributionPercent.
  const costDragBreakdown: CostDragBreakdownEntry[] = [
    {
      source: "FEE",
      amount: feeTotal.toString(),
      contributionPercent: computeCostDragContributionPercent(
        feeTotal,
        costDragAmount,
      ),
    },
    {
      source: "SALE_TAX",
      amount: saleTaxTotal.toString(),
      contributionPercent: computeCostDragContributionPercent(
        saleTaxTotal,
        costDragAmount,
      ),
    },
    {
      source: "DIVIDEND_TAX",
      amount: dividendTaxTotal.toString(),
      contributionPercent: computeCostDragContributionPercent(
        dividendTaxTotal,
        costDragAmount,
      ),
    },
  ];

  return {
    cutoffLabel: CUTOFF_LABELS[selection.key],
    cutoffDate: formatDate(cutoffDate),
    cutoffHref: ROUTES.settings,
    navValue: navSum.toString(),
    navValueIsPartial,
    navDeltaAmount: absolutePnl.toString(),
    navDeltaPercent,
    xirr: toUiXirr(xirr),
    absolutePnl: absolutePnl.toString(),
    absolutePnlIsPartial: navValueIsPartial,
    realizedPnl: realizedPnl.toString(),
    unrealizedPnl: unrealizedPnl.toString(),
    pnlSplitIsApproximate,
    allocation,
    priceFreshnessNote,
    missingPriceHoldings,
    manualPriceHoldings,
    totalCostBasis: totalInvested.toString(),
    grossInvested: grossInvested.toString(),
    costDragAmount: costDragAmount.toString(),
    costDragPercent,
    costDragBreakdown,
  };
}

// XIRR tại một mốc chốt — bản NHẸ của getPortfolioValuation(), chỉ tính phần
// cần cho XIRR (không valuate riêng allocation, không đếm missingPriceHoldings,
// không query priceFreshnessNote) — dùng cho getCutoffOptions() (Settings,
// preview XIRR của cả 3 mốc TODAY/END_OF_MONTH/END_OF_YEAR cùng lúc, code
// review #3: gọi getPortfolioValuation() đầy đủ 3 lần trước đây dư 3 query
// priceFreshnessNote + 3 lần buildAllocation không dùng tới).
export async function getXirrForCutoff(
  selection: CutoffSelection,
): Promise<XirrResultUi> {
  const { xirr } = await computeXirrAndPnlCore(selection);
  return toUiXirr(xirr);
}

// Đọc Holding TRỰC TIẾP từ DB (id/symbol/quantity) — KHÔNG qua
// getOpenHoldings/getClosedHoldings (features/holdings/queries.ts), vốn cache()
// theo request/render. getCurrentPortfolioXirrPercent() bên dưới cần gọi được
// HAI LẦN trong CÙNG một invocation Server Action (trước và sau khi ghi
// Dividend/cập nhật Holding.quantity, xem recordDividend) — nếu tái dùng
// getOpenHoldings/getClosedHoldings, lần gọi thứ hai sẽ trả kết quả CŨ do
// React cache() de-dup trong cùng request, không phản ánh thay đổi vừa ghi.
async function getAllHoldingIdsAndQuantities(
  userId: string,
): Promise<{ id: string; symbol: string; quantity: Decimal }[]> {
  const holdings = await db.holding.findMany({
    where: { userId },
    select: { id: true, symbol: true, quantity: true },
  });

  return holdings.map((holding) => ({
    id: holding.id,
    symbol: holding.symbol,
    quantity: new Decimal(holding.quantity.toString()),
  }));
}

// XIRR toàn danh mục "tại thời điểm gọi" (cutoff = hôm nay), đọc dữ liệu tươi
// mỗi lần gọi — dùng cho DividendRecordedResult.xirrBeforePercent/
// xirrAfterPercent (recordDividend, features/dividends/actions.ts): gọi hàm
// này 1 lần TRƯỚC và 1 lần SAU transaction ghi Dividend để so sánh ảnh hưởng.
// Nhận userId trực tiếp (KHÔNG tự gọi getSession()) — caller đã resolve session
// một lần ở đầu action, tránh phụ thuộc lại vào giá trị cache() theo request.
// Trả null (KHÔNG throw) khi XIRR không hội tụ/thiếu dòng tiền dương — caller
// tự quyết định ẩn field tương ứng (docs/rules/error-handling.md).
export async function getCurrentPortfolioXirrPercent(
  userId: string,
): Promise<string | null> {
  const cutoffDate = resolveCutoffDate({ key: "TODAY" });

  const allHoldings = await getAllHoldingIdsAndQuantities(userId);

  const { xirr } = await computeXirrCore({
    holdings: allHoldings,
    userId,
    cutoffDate,
  });

  if (!xirr.ok) return null;

  return formatXirrBarePercent(xirr.annualizedRate.mul(100).toNumber());
}

// --- Cảnh báo tập trung (docs/domain/04-pricing-and-valuation.md mục "Cảnh
// báo tập trung") — wiring cho lib/concentration.ts::computeConcentration() ---

export type ConcentrationBadgesResult = {
  thresholdPercent: number;
  missingPriceSharePercent: number;
  suppressed: boolean;
  naturalConcentrationNote: boolean;
  // Số Holding đang có badge THẬT (loại trừ SUPPRESSED — biến thể đó không
  // xác định được mã nào cụ thể đang vượt ngưỡng, nên không đếm vào "N mã").
  warningCount: number;
  // Theo Holding.id — CHỈ chứa entry cho Holding đang có badge (đã lọc null).
  badges: Map<string, ConcentrationBadgeState>;
};

// Đọc Holding ĐANG MỞ (getOpenHoldings — vị thế đóng KHÔNG BAO GIỜ được đưa
// vào, docs/domain/04 "Vị thế đóng") + valuate bằng valuateHoldings() đã có,
// gọi computeConcentration() (lib/concentration.ts, pure), rồi ĐỒNG BỘ LẠI
// Holding.concentrationWarningActive cho các Holding đổi trạng thái
// (update-on-read — chỉ ghi khi giá trị thực sự đổi, không ghi lại mỗi lần
// render nếu không đổi). Dùng chung cho HoldingListItem/HoldingsGroupCard
// (features/holdings) và callout AllocationScreen — KHÔNG tính 2 lần khác
// công thức (mục 4 phase-6.md).
//
// cutoffDate mặc định đọc cookie mốc chốt user đang chọn (cùng pattern
// getOpenHoldingsWithValuation) — badge cảnh báo phải nhất quán với NAV đang
// hiển thị trên cùng màn, không luôn luôn là "hôm nay".
//
// `precomputedValuations` — caller ĐÃ tự gọi valuateHoldings() cho CÙNG tập
// `open`/cutoffDate (vd getAllocationDetail() dùng kết quả cho buildAllocation)
// thì truyền vào đây thay vì để hàm này tự valuate lại lần nữa — valuateHoldings
// không cache(), gọi 2 lần với input giống hệt nhau tốn 2 round-trip DB giống
// hệt nhau (code review #8). getOpenHoldings() vẫn tự gọi lại bình thường (đã
// cache() theo request, rẻ).
export async function getConcentrationBadges(
  cutoffDate?: Date,
  precomputedValuations?: Map<string, HoldingValuation>,
): Promise<ConcentrationBadgesResult> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const resolvedCutoffDate =
    cutoffDate ?? resolveCutoffDate(await getCutoffSelection());

  const open = await getOpenHoldings();
  const openIds = open.map((h) => h.id);

  const [valuations, stateRows, thresholdPercentDecimal] = await Promise.all([
    precomputedValuations ??
      valuateHoldings(
        open.map((h) => ({
          id: h.id,
          symbol: h.symbol,
          quantity: new Decimal(h.quantity),
        })),
        resolvedCutoffDate,
      ),
    openIds.length > 0
      ? db.holding.findMany({
          where: { id: { in: openIds } },
          select: { id: true, concentrationWarningActive: true },
        })
      : Promise.resolve([]),
    resolveDecimalSetting(
      SETTING_KEYS.CONCENTRATION_WARNING_THRESHOLD,
      new Date(),
    ),
  ]);

  const previouslyWarnedById = new Map(
    stateRows.map((row) => [row.id, row.concentrationWarningActive]),
  );

  const inputs = open.map((holding) => {
    const valuation = valuations.get(holding.id);
    return {
      id: holding.id,
      type: holding.type,
      nav: valuation?.status === "VALUED" ? valuation.nav : null,
      totalCostBasis: new Decimal(holding.totalCostBasis),
      previouslyWarned: previouslyWarnedById.get(holding.id) ?? false,
    };
  });

  const result = computeConcentration(
    inputs,
    thresholdPercentDecimal.toNumber(),
  );

  // Update-on-read — chỉ ghi Holding có trạng thái THỰC SỰ đổi so với DB, chia
  // 2 nhóm bật/tắt để dùng updateMany (không N+1 update từng dòng).
  const toActivate: string[] = [];
  const toDeactivate: string[] = [];
  for (const holding of open) {
    const previouslyWarned = previouslyWarnedById.get(holding.id) ?? false;
    const warnedNow = result.warnedNow.get(holding.id) ?? false;
    if (warnedNow === previouslyWarned) continue;
    (warnedNow ? toActivate : toDeactivate).push(holding.id);
  }

  if (toActivate.length > 0 || toDeactivate.length > 0) {
    try {
      await Promise.all([
        toActivate.length > 0
          ? db.holding.updateMany({
              where: { id: { in: toActivate } },
              data: { concentrationWarningActive: true },
            })
          : Promise.resolve(),
        toDeactivate.length > 0
          ? db.holding.updateMany({
              where: { id: { in: toDeactivate } },
              data: { concentrationWarningActive: false },
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      // Hiệu ứng phụ update-on-read KHÔNG được làm gãy render Dashboard/Holdings
      // — badge hiển thị vẫn đúng (tính từ `result`, không phụ thuộc DB write
      // có thành công hay không), chỉ hysteresis lần tính SAU có thể lệch nếu
      // ghi thất bại nhiều lần liên tiếp. Log để theo dõi, không throw.
      logger.error(
        { err, userId },
        "getConcentrationBadges: failed to sync concentrationWarningActive",
      );
    }
  }

  const badges = new Map<string, ConcentrationBadgeState>();
  let warningCount = 0;
  for (const [id, state] of result.results) {
    if (!state) continue;
    badges.set(id, state);
    if (state.kind !== "SUPPRESSED") warningCount++;
  }

  return {
    thresholdPercent: thresholdPercentDecimal.toNumber(),
    missingPriceSharePercent: result.missingPriceSharePercent,
    suppressed: result.suppressed,
    naturalConcentrationNote: result.naturalConcentrationNote,
    warningCount,
    badges,
  };
}

// --- Phân bổ chi tiết (donut, mục 6 phase-6.md / 6d UI_phase_6.md) ---

export type AllocationDetailSlice = {
  type: AssetType;
  percent: number; // 0-100, KHÔNG bị ẩn bởi `hidden` (chỉ ẩn VND tuyệt đối)
  note?: string; // "· gồm CCQ" cho FUND

  // MỚI (issue #130, process/UI_allocation-group-pnl.md) — NAV ròng + lãi/lỗ
  // theo vốn CỦA RIÊNG NHÓM, Decimal đã serialize (biên server). Công thức
  // khớp groupValuations.changePercent (features/holdings/queries/holdings-valuation.ts)
  // — mẫu số CHỈ tính trên mã ĐÃ định giá trong nhóm.
  navAmount: string;
  pnlAmount: string;
  pnlPercent: number; // KHÔNG bị ẩn bởi `hidden` (chỉ navAmount/pnlAmount là VND tuyệt đối)
  navIsPartial: boolean; // true khi nhóm có >= 1 mã MISSING_PRICE
  // pricedCount/totalCount/missingSymbolsLabel CHỈ set khi navIsPartial (mockup
  // 130b: "NAV ròng · 2/3 mã có giá" + ghi chú amber "1 mã thiếu giá (MWG)").
  pricedCount?: number;
  totalCount?: number;
  missingSymbolsLabel?: string;
};

export type AllocationDetail = {
  slices: AllocationDetailSlice[];
  // N mã đang có badge cảnh báo tập trung (KHÔNG kèm tên mã cụ thể — callout
  // dùng câu chung "N mã đang vượt ngưỡng tập trung", process/DECISION.md
  // 2026-07-21 mục (4)).
  concentrationWarningCount: number;

  // MỚI (issue #130) — thẻ tổng NAV/tổng lãi-lỗ đầu trang, Decimal đã
  // serialize. totalPnlPercent = Σ pnlAmount / Σ costBasisPriced các nhóm ×
  // 100 (0 nếu mẫu số = 0) — KHÔNG tái dùng PortfolioValuation.navDeltaPercent
  // (mẫu số đó là tổng vốn ròng TẤT CẢ holding kể cả mã thiếu giá, khác hẳn
  // — process/UI_allocation-group-pnl.md "Điểm cần xác nhận" #2).
  totalNavAmount: string;
  totalNavIsPartial: boolean; // true khi BẤT KỲ nhóm nào navIsPartial
  totalPnlAmount: string;
  totalPnlPercent: number;
};

// Tái dùng buildAllocation() (đã có, không viết lại) + getConcentrationBadges()
// (đếm N mã cảnh báo) — dùng cho /allocation (route riêng, design-implementer
// dựng ở mục 10 phase-6.md).
//
// valuateHoldings() gọi 1 LẦN DUY NHẤT, truyền kết quả vào getConcentrationBadges()
// qua `precomputedValuations` thay vì để hàm đó tự valuate lại (2 round-trip DB
// giống hệt nhau mỗi lần tải /allocation — code review #8). Đánh đổi: getConcentrationBadges()
// giờ đợi valuateHoldings() xong trước khi chạy 2 query còn lại (stateRows/threshold)
// thay vì cả 3 chạy song song như trước — chấp nhận được, tổng round-trip DB giảm
// nhiều hơn phần latency tuần tự thêm vào.
//
// computeAllocationGroupDetails() (lib/allocation-group-pnl.ts) gọi MỘT LẦN
// DUY NHẤT (issue #130) — dùng kết quả để build cả `slices` (đủ field NAV/
// lãi-lỗ theo nhóm mới) lẫn 4 field tổng đầu trang, tránh lặp lại vòng lặp
// group-by-type lần thứ hai.
export async function getAllocationDetail(): Promise<AllocationDetail> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cutoffDate = resolveCutoffDate(await getCutoffSelection());
  const open = await getOpenHoldings();

  const valuations = await valuateHoldings(
    open.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );
  const concentration = await getConcentrationBadges(cutoffDate, valuations);

  const validNavs = [...valuations.values()].filter(isValued).map((v) => v.nav);
  const navSum = validNavs.reduce((sum, nav) => sum.plus(nav), new Decimal(0));

  const groupDetails = computeAllocationGroupDetails(open, valuations, navSum);
  const slices: AllocationDetailSlice[] = groupDetails.map((detail) => ({
    type: detail.type,
    percent: detail.percent,
    note: detail.type === "FUND" ? "· gồm CCQ" : undefined,
    navAmount: detail.navAmount.toString(),
    pnlAmount: detail.pnlAmount.toString(),
    pnlPercent: detail.pnlPercent,
    navIsPartial: detail.navIsPartial,
    pricedCount: detail.navIsPartial ? detail.pricedCount : undefined,
    totalCount: detail.navIsPartial ? detail.totalCount : undefined,
    missingSymbolsLabel: detail.navIsPartial
      ? detail.missingSymbols.join(", ")
      : undefined,
  }));

  const totalNavAmount = groupDetails.reduce(
    (sum, detail) => sum.plus(detail.navAmount),
    new Decimal(0),
  );
  const totalPnlAmount = groupDetails.reduce(
    (sum, detail) => sum.plus(detail.pnlAmount),
    new Decimal(0),
  );
  const totalCostBasisPriced = groupDetails.reduce(
    (sum, detail) => sum.plus(detail.costBasisPriced),
    new Decimal(0),
  );
  const totalNavIsPartial = groupDetails.some((detail) => detail.navIsPartial);
  const totalPnlPercent = totalCostBasisPriced.isZero()
    ? 0
    : totalPnlAmount.div(totalCostBasisPriced).mul(100).toNumber();

  return {
    slices,
    concentrationWarningCount: concentration.warningCount,
    totalNavAmount: totalNavAmount.toString(),
    totalNavIsPartial,
    totalPnlAmount: totalPnlAmount.toString(),
    totalPnlPercent,
  };
}

// --- Drill-down "% theo mã trong nhóm cổ phiếu" (route /allocation/stock,
// issue #132, phụ thuộc #131 cho Props contract thật — process/DECISION.md
// 2026-08-16 chốt route riêng, không accordion) ---

export type StockAllocationEntry = {
  holdingId: string;
  symbol: string;
  name: string;
  // Decimal đã serialize — client wrapper (StockAllocationDetailClient) tự
  // formatMoney() theo cờ hidden, không format sẵn ở đây (khác AllocationDetail
  // vì màn này CÓ hiện VND tuyệt đối, /allocation thì không).
  nav: string;
  // 0-100, mẫu số = NAV nhóm cổ phiếu (KHÔNG bị ẩn bởi cờ hidden).
  percent: number;
  // Badge amber CŨ (lib/concentration.ts) — mẫu số KHÁC (NAV toàn danh mục),
  // undefined = dưới ngưỡng, không hiện badge.
  concentrationBadge?: ConcentrationBadgeState;
};

export type StockAllocationMissingPriceEntry = {
  holdingId: string;
  symbol: string;
  name: string;
  quantity: string; // Decimal đã serialize
  unit: string;
  updatePriceHref: string; // ROUTES.navOverrideNew(holdingId)
};

export type StockAllocationDetailData = {
  // Decimal đã serialize, "0" khi không mã nào có giá (entries rỗng — client
  // wrapper tự đổi thành nhãn "chưa tính được" thay vì "0 ₫", xem 131d).
  groupNav: string;
  // ĐÃ sort giảm dần theo percent (computeStockGroupAllocation) — mặc định
  // "% giảm dần"; client wrapper tự re-sort khi user đổi sortLabel, không
  // round-trip DB lần 2 (sort thuần theo dữ liệu đã có, không cần query mới).
  entries: StockAllocationEntry[];
  missingPriced: StockAllocationMissingPriceEntry[];
};

// Tái dùng computeStockGroupAllocation() (lib/stock-group-allocation.ts, pure
// — tách riêng khỏi file này vì import chain next-auth khiến vitest không
// resolve được, xem comment ở đó) + getConcentrationBadges() (đã có, không
// viết lại) cho badge amber cũ đặt cạnh tên mã (mockup 131a). valuateHoldings()
// gọi 1 LẦN DUY NHẤT, truyền qua getConcentrationBadges() qua
// `precomputedValuations` — cùng pattern getAllocationDetail() ở trên (code
// review #8, tránh 2 round-trip DB giống hệt nhau).
export async function getStockAllocationDetail(): Promise<StockAllocationDetailData> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cutoffDate = resolveCutoffDate(await getCutoffSelection());
  const open = await getOpenHoldings();

  const valuations = await valuateHoldings(
    open.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );
  const concentration = await getConcentrationBadges(cutoffDate, valuations);

  const { groupNav, entries, missingPrice } = computeStockGroupAllocation(
    open,
    valuations,
  );

  // missingPrice (computeStockGroupAllocation) không mang quantity/unit —
  // hàm đó pure, không biết định dạng hiển thị (xem type StockGroupMissingPriceEntry).
  // Tra lại từ `open` (đã có sẵn trong closure, không round-trip DB thêm).
  const openById = new Map(open.map((h) => [h.id, h]));

  return {
    groupNav: groupNav.toString(),
    entries: entries.map((entry) => ({
      holdingId: entry.holdingId,
      symbol: entry.symbol,
      name: entry.name ?? entry.symbol,
      nav: entry.nav.toString(),
      percent: entry.percentInGroup,
      concentrationBadge: concentration.badges.get(entry.holdingId),
    })),
    missingPriced: missingPrice.map((entry) => {
      const holding = openById.get(entry.holdingId);
      return {
        holdingId: entry.holdingId,
        symbol: entry.symbol,
        name: entry.name ?? entry.symbol,
        quantity: holding?.quantity ?? "0",
        unit: holding?.unit ?? "",
        updatePriceHref: withFrom(
          ROUTES.navOverrideNew(entry.holdingId),
          ROUTES.allocationStock,
        ),
      };
    }),
  };
}
