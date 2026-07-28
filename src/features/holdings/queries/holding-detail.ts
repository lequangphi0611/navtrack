import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import { getSession } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
// toUiXirr được export từ lib/portfolio-valuation.ts (adapter dùng chung
// business XirrResult -> UI XirrResult). Import ngược chiều với
// getOpenHoldings/getClosedHoldings mà portfolio-valuation.ts import từ
// barrel "@/features/holdings/queries" (thực sống ở
// queries/holdings-overview.ts, sub-issue #108) — CHẤP NHẬN ĐƯỢC vì cả hai
// đều chỉ dùng nhau bên trong THÂN hàm (gọi lúc request, không phải lúc
// module khởi tạo), không có usage nào ở top-level module — ES module xử lý
// tham chiếu vòng kiểu này an toàn (live binding), không phải "true"
// circular init dependency.
import { toUiXirr } from "@/lib/portfolio-valuation";
import type { PriceSource } from "@/lib/valuation";
import { valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

import { buildCashflowTimeline } from "../build-cashflow-timeline";
import {
  findCashDividendsForHolding,
  findHoldingDetailSource,
} from "../repository";
import type {
  CashflowRow,
  HoldingDetail,
  HoldingDetailValuation,
} from "../types";
import {
  buildCutoffNavDateNote,
  buildPriceNote,
} from "./holding-detail-strings";

// Chi tiết vị thế cho /holdings/[id] (mockup 2c). Setting rows/pricing form/
// banner "vừa ghi nhận" — cùng nhóm màn hình, dùng chung CashflowRow — sống ở
// ./holding-transaction-form.ts (tách riêng, sub-issue #108, giữ file này
// dưới 300 dòng).

// Nhãn nguồn giá cho priceNote/priceSourceLabel của khối định giá chi tiết vị
// thế (mockup 2c) — nguồn sự thật riêng cho câu chữ này (PriceSourceBadge chỉ
// quản lý label cho chính badge, không phải câu văn đầy đủ dùng ở đây).
const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  AUTO: "Tự động · vnstock",
  MANUAL: "Nhập tay",
};

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

  // "Không tồn tại" và "không thuộc user hiện tại" đều trả `null` — xử lý
  // giống nhau, không lộ thông tin tồn tại (findHoldingDetailSource tự filter
  // userId, xem repository.ts).
  const holding = await findHoldingDetailSource(holdingId, session.user.id);
  if (!holding) notFound();

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
  // dividends bên dưới. repository đã trả Domain (Decimal) nên không cần
  // wrap lại qua new Decimal().
  const position = derivePosition(
    cashflowsUpToCutoff,
    stockDividendsUpToCutoff,
  );

  const cashflowsForXirr = cashflowsUpToCutoff.map((cf) => ({
    date: cf.date,
    amount: cf.amount,
  }));

  const isOpenPosition = !position.quantity.isZero();

  const [dividends, valuations] = await Promise.all([
    findCashDividendsForHolding(holding.id, resolvedCutoffDate),
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

  const timeline: CashflowTimelineRow[] = buildCashflowTimeline(
    cashflowsUpToCutoff,
    dividends,
    holding.unit,
  );

  if (appendedNavPoint) {
    // currentNav !== null đã xác nhận ở appendedNavPoint — non-null assertion an toàn.
    timeline.push({
      id: "cutoff-nav",
      kind: "CUTOFF_NAV",
      label: "NAV tại mốc chốt",
      dateNote: buildCutoffNavDateNote(resolvedCutoffDate),
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
      priceNote: buildPriceNote(
        priceValuation.priceDate,
        priceValuation.price,
        position.avgCost,
      ),
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
