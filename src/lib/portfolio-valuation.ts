import Decimal from "decimal.js";

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
  CUTOFF_LABELS,
  type CutoffSelection,
  resolveCutoffDate,
} from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatDate, formatDayMonth } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { HoldingValuation } from "@/lib/valuation";
import { AUTO_PRICED_ASSET_TYPES, valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

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
  allocation: AllocationSlice[];
  priceFreshnessNote: string;
  missingPriceHoldings: MissingPriceHolding[];
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
async function getAllCashflowsForXirr(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<{ date: Date; amount: Decimal }[]> {
  if (holdingIds.length === 0) return [];

  const rows = await db.cashflow.findMany({
    where: { holdingId: { in: holdingIds }, date: { lte: cutoffDate } },
    select: { date: true, amount: true },
  });

  return rows.map((row) => ({
    date: row.date,
    amount: new Decimal(row.amount.toString()),
  }));
}

// Cổ tức tiền mặt <= cutoffDate cho toàn danh mục — cùng pattern
// getCashDividends trong holdings/queries.ts nhưng gộp nhiều holdingId một
// lượt thay vì 1, tránh N+1 khi lặp qua từng vị thế.
async function getAllCashDividendsForXirr(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<{ date: Date; netAmount: Decimal }[]> {
  if (holdingIds.length === 0) return [];

  const rows = await db.dividend.findMany({
    where: {
      holdingId: { in: holdingIds },
      type: "CASH",
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: { date: true, netAmount: true },
  });

  return rows.map((row) => ({
    date: row.date,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
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
// nhau có chủ đích (xem comment HoldingDetail.xirr trong holdings/types.ts).
function toUiXirr(result: ReturnType<typeof computeXirr>): XirrResultUi {
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
  // Tổng vốn ròng đã bỏ vào TÍNH TỚI cutoffDate, cho TẤT CẢ holding (mở lẫn
  // đóng) — docs/domain/05 "Cách tính": Σ tiền ra (mua) − Σ tiền vào đã rút
  // (bán + cổ tức) trước mốc. CỐ Ý không dùng getTotalInvested() (chỉ tính
  // vốn của holding đang mở theo HÔM NAY, không theo cutoff — sai denominator
  // cho navDeltaPercent khi cutoff khác "hôm nay", xem code review #2).
  totalInvested: Decimal;
};

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
  const holdingIds = allHoldings.map((h) => h.id);

  const [valuations, cashflows, dividends] = await Promise.all([
    valuateHoldings(
      allHoldings.map((h) => ({
        id: h.id,
        symbol: h.symbol,
        quantity: new Decimal(h.quantity),
      })),
      cutoffDate,
    ),
    getAllCashflowsForXirr(holdingIds, cutoffDate),
    getAllCashDividendsForXirr(holdingIds, cutoffDate),
  ]);

  const validNavs = [...valuations.values()].filter(isValued).map((v) => v.nav);
  const navSum = validNavs.reduce((sum, nav) => sum.plus(nav), new Decimal(0));
  // NULL (KHÔNG Decimal(0)) khi chưa có mã nào định giá được — nếu để 0,
  // buildXirrCashflows ghép 1 dòng tiền dương giả = 0, khiến XIRR/PnL trông
  // như "mất trắng" thay vì đúng ca biên "không tính được" (docs/domain/05).
  const currentNav = validNavs.length > 0 ? navSum : null;

  const isOpenPosition = open.length > 0;

  const points = buildXirrCashflows({
    cashflows,
    dividends,
    isOpenPosition,
    cutoffDate,
    currentNav,
  });

  const xirr = computeXirr(points);
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

  return {
    cutoffDate,
    open,
    allHoldings,
    valuations,
    navSum,
    xirr,
    absolutePnl,
    totalInvested,
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
    totalInvested,
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
    allocation,
    priceFreshnessNote,
    missingPriceHoldings,
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
