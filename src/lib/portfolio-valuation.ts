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
import type { HoldingSummary } from "@/features/holdings/types";
import { getSession } from "@/lib/auth";
import {
  computeCostDrag,
  computeCostDragContributionPercent,
} from "@/lib/cost-drag";
import {
  CUTOFF_LABELS,
  type CutoffSelection,
  resolveCutoffDate,
} from "@/lib/cutoff";
import { db } from "@/lib/db";
import {
  formatDate,
  formatDayMonth,
  formatXirrBarePercent,
} from "@/lib/format";
import {
  computeRealizedGainForHolding,
  computeUnrealizedGain,
} from "@/lib/realized-pnl";
import { ROUTES } from "@/lib/routes";
import type { HoldingValuation } from "@/lib/valuation";
import { AUTO_PRICED_ASSET_TYPES, valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

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

// Thứ tự hiển thị cố định cho allocation — khớp thứ tự dùng ở
// AssetTypeBadge/AllocationBar mockup (STOCK, FUND, BOND, GOLD), không phụ
// thuộc thứ tự Map insertion (vốn theo thứ tự holding đầu tiên gặp mỗi loại).
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

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

// Cổ tức tiền mặt <= cutoffDate cho toàn danh mục — cùng pattern
// getCashDividends trong holdings/queries.ts nhưng gộp nhiều holdingId một
// lượt thay vì 1, tránh N+1 khi lặp qua từng vị thế. taxAmount thêm cho "chi
// phí ăn mòn" (docs/domain/07-tax.md).
async function getAllCashDividendsForXirr(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<
  {
    date: Date;
    paymentDate: Date | null;
    netAmount: Decimal;
    taxAmount: Decimal | null;
  }[]
> {
  if (holdingIds.length === 0) return [];

  const rows = await db.dividend.findMany({
    where: {
      holdingId: { in: holdingIds },
      type: "CASH",
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: { date: true, paymentDate: true, netAmount: true, taxAmount: true },
  });

  return rows.map((row) => ({
    date: row.date,
    paymentDate: row.paymentDate,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
    // taxAmount CÓ THỂ null (dividend CASH ghi trước khi thuế cổ tức có mặt,
    // hoặc chưa resolve được) — coi như 0 khi cộng dồn costDragAmount, KHÔNG
    // ép non-null assertion như netAmount ở trên.
    taxAmount:
      row.taxAmount !== null ? new Decimal(row.taxAmount.toString()) : null,
  }));
}

function buildAllocation(
  holdings: HoldingSummary[],
  valuations: Map<string, HoldingValuation>,
  navSum: Decimal,
): AllocationSlice[] {
  // Tránh chia 0 — cũng đúng nghĩa nghiệp vụ: chưa có mã nào định giá được thì
  // chưa có gì để phân bổ (mockup 2f: allocation rỗng khi NAV không xác định).
  if (navSum.isZero()) return [];

  const navByType = new Map<AssetType, Decimal>();
  for (const holding of holdings) {
    const valuation = valuations.get(holding.id);
    if (!valuation || !isValued(valuation)) continue;
    const prev = navByType.get(holding.type) ?? new Decimal(0);
    navByType.set(holding.type, prev.plus(valuation.nav));
  }

  return ASSET_TYPE_ORDER.filter((type) => navByType.has(type)).map((type) => ({
    type,
    // navByType.get(type) chắc chắn tồn tại nhờ filter ngay trên.
    percent: (navByType.get(type) as Decimal).div(navSum).mul(100).toNumber(),
  }));
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
type HoldingForXirr = { id: string; symbol: string; quantity: Decimal };

// Phần TÍNH TOÁN dùng chung giữa computeXirrAndPnlCore() (Dashboard/Danh mục,
// đọc holdings qua getOpenHoldings/getClosedHoldings đã cache() theo request)
// và getCurrentPortfolioXirrPercent() (cần đọc THẲNG DB, không qua cache() —
// xem comment getAllHoldingIdsAndQuantities bên dưới) — valuate + gom
// cashflow/dividend + build điểm XIRR + computeXirr từng bị lặp lại giữa hai
// hàm, tách ra đây để chỉ 1 nơi giữ đúng thứ tự các bước này (process/DECISION.md
// mục dedupe XIRR core). KHÔNG tự gọi getSession()/getOpenHoldings()/
// getClosedHoldings() bên trong — nhận holdings + cutoffDate trực tiếp để
// caller tự quyết định nguồn đọc (cache() theo request hay DB tươi).
async function computeXirrCore({
  holdings,
  cutoffDate,
}: {
  holdings: HoldingForXirr[];
  cutoffDate: Date;
}): Promise<{
  valuations: Map<string, HoldingValuation>;
  currentNav: Decimal | null;
  isOpenPosition: boolean;
  points: ReturnType<typeof buildXirrCashflows>;
  xirr: ReturnType<typeof computeXirr>;
  cashflows: Awaited<ReturnType<typeof getAllCashflowsForXirr>>;
  dividends: Awaited<ReturnType<typeof getAllCashDividendsForXirr>>;
}> {
  const holdingIds = holdings.map((h) => h.id);
  const [valuations, cashflows, dividends] = await Promise.all([
    valuateHoldings(holdings, cutoffDate),
    getAllCashflowsForXirr(holdingIds, cutoffDate),
    getAllCashDividendsForXirr(holdingIds, cutoffDate),
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
  const absolutePnl = points.reduce(
    (sum, p) => sum.plus(p.amount),
    new Decimal(0),
  );

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
      href: ROUTES.holdingDetail(h.id),
    }));

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

  const { xirr } = await computeXirrCore({ holdings: allHoldings, cutoffDate });

  if (!xirr.ok) return null;

  return formatXirrBarePercent(xirr.annualizedRate.mul(100).toNumber());
}
