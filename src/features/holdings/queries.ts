import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import type {
  GroupValuation,
  HoldingValuationExtras,
  HoldingWithValuation,
} from "@/features/holdings/components/HoldingsGroupCard";
import type { TransactionSnapshotBannerProps } from "@/features/holdings/components/TransactionSnapshotBanner";
// Cross-feature import (holdings -> snapshots). Cùng lý do đã chấp nhận cho toUiXirr
// ngay dưới đây: getJustRecordedBanner() (thân hàm) gọi getManualSnapshotToday(), trong
// khi snapshots/actions.ts (KHÔNG phải file này) gọi getOpenHoldings() từ file này — 2
// module khác nhau trong feature snapshots, không có usage nào ở top-level module, ES
// module xử lý an toàn (live binding), không phải "true" circular init dependency.
import { getManualSnapshotToday } from "@/features/snapshots/queries";
import { getSession } from "@/lib/auth";
import { derivePositionIncludingStockDividends } from "@/lib/cost-basis";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { db } from "@/lib/db";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatQuantity,
} from "@/lib/format";
// toUiXirr được export từ lib/portfolio-valuation.ts (adapter dùng chung
// business XirrResult -> UI XirrResult). Import ngược chiều với
// getOpenHoldings/getClosedHoldings mà portfolio-valuation.ts import từ file
// này — CHẤP NHẬN ĐƯỢC vì cả hai đều chỉ dùng nhau bên trong THÂN hàm
// (gọi lúc request, không phải lúc module khởi tạo), không có usage nào ở
// top-level module — ES module xử lý tham chiếu vòng kiểu này an toàn
// (live binding), không phải "true" circular init dependency.
import { toUiXirr } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";
import type { PriceSource } from "@/lib/valuation";
import { AUTO_PRICED_ASSET_TYPES, valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

import { groupHoldingsByType } from "./group-holdings";
import type {
  CashflowRow,
  HoldingDetail,
  HoldingDetailValuation,
  HoldingsOverview,
  HoldingSummary,
} from "./types";

// Nhãn nguồn giá cho priceNote/priceSourceLabel của khối định giá chi tiết vị
// thế (mockup 2c) — nguồn sự thật riêng cho câu chữ này (PriceSourceBadge chỉ
// quản lý label cho chính badge, không phải câu văn đầy đủ dùng ở đây).
const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  AUTO: "Tự động · vnstock",
  MANUAL: "Nhập tay",
};

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

  const holdings = await db.holding.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      quantity: true,
      avgCost: true,
    },
    orderBy: { symbol: "asc" },
  });

  const open: HoldingSummary[] = [];
  const closed: HoldingSummary[] = [];

  for (const holding of holdings) {
    const quantity = new Decimal(holding.quantity.toString());
    const avgCost = new Decimal(holding.avgCost.toString());
    const totalCostBasis = quantity.mul(avgCost);

    const summary: HoldingSummary = {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      unit: holding.unit,
      quantity: quantity.toString(),
      avgCost: avgCost.toString(),
      totalCostBasis: totalCostBasis.toString(),
    };

    if (quantity.gt(0)) {
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

// Cổ tức tiền mặt đã nhận <= cutoffDate — dòng tiền dương cho XIRR
// (docs/domain/03-dividends.md, docs/domain/05 "Cách tính": Dividend.netAmount).
// Chưa có UI nhập cổ tức (chưa có màn hình ghi Dividend) nên hiện tại luôn trả
// mảng rỗng — vô hại, công thức đã ghi rõ trong domain doc nên viết sẵn thay vì
// đoán tính năng tương lai.
async function getCashDividends(
  holdingId: string,
  cutoffDate: Date,
): Promise<{ date: Date; netAmount: Decimal }[]> {
  const rows = await db.dividend.findMany({
    where: {
      holdingId,
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

// cutoffDate: khi caller không truyền tường minh, tự đọc mốc chốt user đã
// chọn qua cookie (getCutoffSelection() — cùng cách Dashboard/Settings dùng),
// KHÔNG hard-code "TODAY" nữa (code review #4: 3 nơi gọi hàm này — trang chi
// tiết vị thế, form thêm/sửa giao dịch — đều không truyền, nên trước đây luôn
// lệch khỏi mốc chốt user đang xem ở Dashboard/Settings).
export async function getHoldingDetail(
  holdingId: string,
  cutoffDate?: Date,
): Promise<HoldingDetail> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const resolvedCutoffDate =
    cutoffDate ?? resolveCutoffDate(await getCutoffSelection());

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    include: {
      // Khớp thứ tự tie-break dùng ở actions.ts/migration backfill (date, createdAt, id) —
      // derivePositionIncludingStockDividends() sort theo (date, createdAt, id), cần thứ tự
      // DB nhất quán khi trùng ngày để không lệch với Holding.quantity/avgCost đã materialize
      // (docs/domain/02).
      cashflows: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
      // Issue #59: vị thế-tại-cutoff (bên dưới) trước đây chỉ derive từ Cashflow,
      // bỏ sót cổ tức cổ phiếu đã nhận — hiện SL/avgCost sai (và NAV/XIRR theo đó).
      dividends: {
        where: { type: "STOCK" },
        select: { id: true, date: true, createdAt: true, stockQuantity: true },
      },
    },
  });

  // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau, không lộ thông tin tồn tại.
  if (!holding || holding.userId !== session.user.id) notFound();

  // Lịch sử giao dịch hiển thị mới nhất trước — đảo ngược mảng đã fetch theo thứ tự tăng dần.
  // (Toàn bộ lịch sử, KHÔNG lọc theo cutoff — timeline hiển thị luôn đầy đủ,
  // chỉ input XIRR/vị thế-tại-cutoff bên dưới mới cần lọc.)
  const cashflows: CashflowRow[] = [...holding.cashflows]
    .reverse()
    .map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date.toISOString(),
      quantity: cf.quantity.toString(),
      pricePerUnit: cf.pricePerUnit.toString(),
      amount: cf.amount.toString(),
      feeAmount: cf.feeAmount.toString(),
      taxAmount: cf.taxAmount.toString(),
      note: cf.note,
    }));

  // Cashflow TÍNH TỚI cutoffDate — dùng cho cả position-tại-cutoff lẫn XIRR,
  // hai input này PHẢI cùng phạm vi thời gian (code review #5: trước đây
  // `position` tính từ TOÀN BỘ lịch sử trong khi `cashflowsForXirr` đã lọc,
  // tự mâu thuẫn nội bộ — vd holding vừa đóng SAU cutoff vẫn báo isOpenPosition
  // sai). Không round-trip DB thứ hai — lọc lại trên `holding.cashflows` đã
  // fetch.
  const cashflowsUpToCutoff = holding.cashflows.filter(
    (cf) => cf.date.getTime() <= resolvedCutoffDate.getTime(),
  );
  // Cổ tức cổ phiếu TÍNH TỚI cutoffDate — cùng phạm vi lọc với cashflowsUpToCutoff
  // (issue #59: trước đây bỏ sót hoàn toàn, SL/avgCost tại cutoff sai).
  const stockDividendsUpToCutoff = holding.dividends.filter(
    (dividend) => dividend.date.getTime() <= resolvedCutoffDate.getTime(),
  );

  // Vị thế TẠI THỜI ĐIỂM cutoff — KHÁC Holding.quantity/avgCost cache (luôn
  // là snapshot HIỆN TẠI, không đổi theo cutoff, dùng cho các nơi khác như
  // getOpenHoldings/getOpenHoldingsWithValuation). Dùng để valuate/xác định
  // isOpenPosition đúng thời điểm đang xem, nhất quán với cashflowsForXirr/
  // dividends bên dưới.
  const position = derivePositionIncludingStockDividends(
    cashflowsUpToCutoff.map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date,
      createdAt: cf.createdAt,
      quantity: new Decimal(cf.quantity.toString()),
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    })),
    stockDividendsUpToCutoff.map((dividend) => ({
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
      // Đã lọc type === "STOCK" ở include -> stockQuantity luôn có giá trị.
      quantity: new Decimal(dividend.stockQuantity!.toString()),
    })),
  );

  const cashflowsForXirr = cashflowsUpToCutoff.map((cf) => ({
    date: cf.date,
    amount: new Decimal(cf.amount.toString()),
  }));

  const isOpenPosition = !position.quantity.isZero();

  const [dividends, valuations] = await Promise.all([
    getCashDividends(holding.id, resolvedCutoffDate),
    valuateHoldings(
      [{ id: holding.id, symbol: holding.symbol, quantity: position.quantity }],
      resolvedCutoffDate,
    ),
  ]);

  // priceValuation (HoldingValuation, lib/valuation.ts) — KHÁC field trả về
  // `valuation` (HoldingDetailValuation) build ở dưới, đặt tên riêng để tránh
  // đụng nhau.
  const priceValuation = valuations.get(holding.id);
  const currentNav =
    priceValuation?.status === "VALUED" ? priceValuation.nav : null;

  const points = buildXirrCashflows({
    cashflows: cashflowsForXirr,
    dividends,
    isOpenPosition,
    cutoffDate: resolvedCutoffDate,
    currentNav,
  });

  const xirr = computeXirr(points);

  // "NAV − tổng vốn ròng đã bỏ vào" tương đương đại số với tổng có dấu của
  // đúng tập điểm đã đưa vào XIRR — cùng kỹ thuật computeXirrAndPnlCore
  // (lib/portfolio-valuation.ts), không cần công thức riêng.
  const absolutePnl = points.reduce(
    (sum, p) => sum.plus(p.amount),
    new Decimal(0),
  );

  // Dòng CUTOFF_NAV chỉ được buildXirrCashflows ghép đúng lúc vị thế còn mở
  // VÀ định giá được — dùng lại đúng điều kiện đó để timeline/footnote nhất
  // quán với dòng tiền thật sự đưa vào XIRR (không tự suy luận riêng).
  const appendedNavPoint = isOpenPosition && currentNav !== null;

  const timeline: CashflowTimelineRow[] = cashflowsUpToCutoff.map((cf) => ({
    id: cf.id,
    kind: cf.type,
    label: `${cf.type === "BUY" ? "Mua" : "Bán"} ${formatQuantity(cf.quantity.toString(), holding.unit)}`,
    dateNote: `${formatDate(cf.date)} · giá ${formatMoney(cf.pricePerUnit.toString())}`,
    amount: cf.amount.toString(),
  }));

  if (appendedNavPoint) {
    // currentNav !== null đã xác nhận ở appendedNavPoint — non-null assertion an toàn.
    timeline.push({
      id: "cutoff-nav",
      kind: "CUTOFF_NAV",
      label: "NAV tại mốc chốt",
      dateNote: `${formatDate(resolvedCutoffDate)} · dòng tiền giả định`,
      amount: currentNav!.toString(),
    });
  }

  const timelineFootnote = appendedNavPoint
    ? "Dòng tiền giả định = NAV mốc chốt, tính lúc chạy — không lưu vào sổ."
    : undefined;

  // valuation chỉ xác định khi status VALUED — MISSING_PRICE để undefined
  // (docs/domain/04 "Thiếu giá": không mặc định 0/giá trị nào cả). Vị thế
  // CLOSED (SL=0) cũng CỐ Ý để undefined dù NAV=0 xác định được: HoldingDetailScreen
  // (Presentational) chưa có biến thể hiển thị riêng cho vị thế đã đóng — nhánh
  // "valuation" hiện chỉ có NAV hero + ReturnMetrics + timeline, KHÔNG hiện lại
  // Số lượng/Giá vốn bình quân như nhánh Phase 1 fallback (đã xác nhận qua e2e:
  // bán hết về 0 rồi thì "0 cổ phần" biến mất khỏi màn nếu ép hiện nhánh valuation).
  // Rơi về Phase 1 (quantity/avgCost/totalCostBasis) vẫn đúng nghiệp vụ cho vị
  // thế đã đóng; XIRR "chốt" cho vị thế đóng để dành cho lần thiết kế lại màn
  // này (xem process/DECISION.md 2026-07-13).
  let valuation: HoldingDetailValuation | undefined;
  if (priceValuation?.status === "VALUED") {
    valuation = {
      navValue: priceValuation.nav.toString(),
      priceSource: priceValuation.source,
      priceSourceLabel: PRICE_SOURCE_LABEL[priceValuation.source],
      priceNote: `Giá EOD ${formatDayMonth(priceValuation.priceDate)}: ${formatMoney(priceValuation.price.toString())} · vốn TB ${formatMoney(position.avgCost.toString())}`,
      xirr: toUiXirr(xirr),
      absolutePnl: absolutePnl.toString(),
      timeline,
      timelineFootnote,
    };
  }

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: position.quantity.toString(),
    avgCost: position.avgCost.toString(),
    totalCostBasis: position.quantity.mul(position.avgCost).toString(),
    cashflows,
    valuation,
  };
}

// Query hẹp riêng cho màn nhập giá tay (NavOverrideForm) — không kéo cashflows
// như getHoldingDetail (màn này không cần lịch sử giao dịch), chỉ cần metadata
// + số lượng/vốn để hiển thị preview NAV.
export async function getHoldingForPricing(holdingId: string): Promise<{
  id: string;
  symbol: string;
  name: string | null;
  type: HoldingSummary["type"];
  unit: string;
  quantity: string;
  totalCostBasis: string;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    select: {
      userId: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      quantity: true,
      avgCost: true,
    },
  });

  if (!holding || holding.userId !== session.user.id) notFound();

  const quantity = new Decimal(holding.quantity.toString());
  const avgCost = new Decimal(holding.avgCost.toString());

  return {
    id: holdingId,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: quantity.toString(),
    totalCostBasis: quantity.mul(avgCost).toString(),
  };
}

// Batch cashflow/dividend theo tập holdingId cho NHIỀU vị thế cùng lúc, khác
// getCashDividends (1 holdingId) — cùng pattern getAllCashflowsForXirr/
// getAllCashDividendsForXirr (lib/portfolio-valuation.ts) nhưng thêm
// holdingId vào select để group lại theo từng vị thế ở JS (portfolio-valuation
// gộp XIRR CẢ danh mục nên không cần giữ holdingId riêng).
async function getCashflowsForHoldings(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<{ holdingId: string; date: Date; amount: Decimal }[]> {
  if (holdingIds.length === 0) return [];

  const rows = await db.cashflow.findMany({
    where: { holdingId: { in: holdingIds }, date: { lte: cutoffDate } },
    select: { holdingId: true, date: true, amount: true },
  });

  return rows.map((row) => ({
    holdingId: row.holdingId,
    date: row.date,
    amount: new Decimal(row.amount.toString()),
  }));
}

async function getCashDividendsForHoldings(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<{ holdingId: string; date: Date; netAmount: Decimal }[]> {
  if (holdingIds.length === 0) return [];

  const rows = await db.dividend.findMany({
    where: {
      holdingId: { in: holdingIds },
      type: "CASH",
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: { holdingId: true, date: true, netAmount: true },
  });

  return rows.map((row) => ({
    holdingId: row.holdingId,
    date: row.date,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
  }));
}

function groupByHoldingId<T extends { holdingId: string }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.holdingId);
    if (list) list.push(row);
    else map.set(row.holdingId, [row]);
  }
  return map;
}

// Danh sách vị thế ĐANG MỞ + NAV/nguồn giá/XIRR riêng từng vị thế + NAV/%
// thay đổi theo nhóm loại tài sản (mockup 2b/2d) — dùng cho HoldingsPositionsSection
// khi status="open". Vị thế ĐÃ ĐÓNG cố ý KHÔNG mở rộng phạm vi này (getClosedHoldings
// giữ nguyên Phase 1) — "market value" của vị thế đã bán hết không có ý nghĩa hiển thị
// ở màn danh sách (docs/domain/04 "Vị thế đóng: NAV=0, không đóng góp").
export async function getOpenHoldingsWithValuation(cutoffDate?: Date): Promise<{
  holdings: HoldingWithValuation[];
  groupValuations: Partial<Record<HoldingSummary["type"], GroupValuation>>;
}> {
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
    getCashflowsForHoldings(holdingIds, resolvedCutoffDate),
    getCashDividendsForHoldings(holdingIds, resolvedCutoffDate),
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

// Props cho TransactionSnapshotBanner (mockup 3d, /holdings/[id]) — hiện khi vừa ghi
// một giao dịch VÀ trigger tự động (holdings/actions.ts gọi freezeManualSnapshot()) đã
// chốt xong snapshot hôm nay. `cashflowId` đến từ query param `?cashflowId=` trên URL
// (không phải cookie — xem lib/routes.ts::holdingDetailAfterTransaction), page.tsx
// KHÔNG tin thẳng query string: hàm này tự verify cashflowId thuộc đúng
// `holding.cashflows` ĐÃ FETCH (không query DB lại) trước khi dựng banner. Sai/không
// tồn tại/chưa có snapshot hôm nay -> trả undefined (ẩn banner, không lỗi).
export async function getJustRecordedBanner(
  holding: { unit: string; cashflows: CashflowRow[] },
  cashflowId: string,
): Promise<TransactionSnapshotBannerProps | undefined> {
  const cashflow = holding.cashflows.find((cf) => cf.id === cashflowId);
  if (!cashflow) return undefined;

  const snapshot = await getManualSnapshotToday();
  if (!snapshot) return undefined;

  return {
    // Cùng cách build label/dateNote với timeline trong getHoldingDetail() phía trên —
    // "Mua 5.000 cổ phần" / "11/07/2026 · giá 27.300".
    transactionLabel: `${cashflow.type === "BUY" ? "Mua" : "Bán"} ${formatQuantity(cashflow.quantity, holding.unit)}`,
    transactionDateNote: `${formatDate(cashflow.date)} · giá ${formatMoney(cashflow.pricePerUnit)}`,
    transactionAmount: cashflow.amount,
    transactionKind: cashflow.type,
    snapshotNavValue: snapshot.value,
    navHistoryHref: ROUTES.snapshots,
  };
}
