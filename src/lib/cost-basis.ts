import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";
import {
  buildQuantityTimeline,
  sortByPositionTrailOrder,
} from "@/lib/position-trail";
import type { PositionTrailEvent } from "@/lib/position-trail";

export type CashflowInput = {
  type: CashflowType;
  date: Date;
  quantity: Decimal;
  pricePerUnit: Decimal;
  // Phí giao dịch (docs/domain/07-tax.md mục "Phí giao dịch (mua & bán)") —
  // BẮT BUỘC (không optional): chỉ gộp vào avgCost khi type === "BUY" (đóng
  // issue #66), nhưng field phải luôn có mặt ở input để caller không quên
  // truyền cho cả BUY lẫn SELL — SELL không dùng field này ở derivePosition()
  // (phí bán không đổi avgCost, chỉ trừ vào amount khi bán) nhưng vẫn cần khai
  // để CashflowInput mô tả đúng 1-1 field thật của Cashflow.
  feeAmount: Decimal;
};

// Quy ước dấu (docs/domain/02-transactions-and-cost-basis.md):
// BUY: amount = -(quantity * pricePerUnit) - feeAmount
// SELL: amount = (quantity * pricePerUnit) - feeAmount - taxAmount
export function computeCashflowAmount(params: {
  type: CashflowType;
  quantity: Decimal;
  pricePerUnit: Decimal;
  feeAmount: Decimal;
  taxAmount: Decimal;
}): Decimal {
  const gross = params.quantity.mul(params.pricePerUnit);
  if (params.type === "BUY") {
    return gross.neg().minus(params.feeAmount);
  }
  return gross.minus(params.feeAmount).minus(params.taxAmount);
}

export type CashflowInputWithEvent = CashflowInput & {
  id: string;
  createdAt: Date;
};

export type StockDividendInput = {
  id: string;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
};

// Phát lại lịch sử vị thế theo thứ tự thời gian để suy ra số lượng + giá vốn
// bình quân hiện tại (phương pháp bình quân di động —
// docs/domain/02-transactions-and-cost-basis.md). Đây là cài đặt DUY NHẤT của
// công thức này trong repo — tính CẢ Cashflow (BUY/SELL) LẪN cổ tức cổ phiếu
// (Dividend{STOCK}); không còn một hàm "gốc" chỉ-Cashflow nào tồn tại song
// song (từng có, đã xoá — xem lịch sử bug bên dưới). Mọi call site mới PHẢI
// gọi thẳng hàm này, không tự chép lại công thức — tránh lặp lại đúng pattern
// "nhiều cài đặt song song của cùng công thức, sửa 1 nơi quên nơi kia" đã gây
// ra chuỗi bug retrofit dưới đây (process/DECISION.md 2026-07-24 (2) và (3)).
//
// wentNegative = true nếu số lượng từng âm ở bất kỳ thời điểm nào khi phát
// lại — dùng để chặn bán vượt số lượng đang giữ "tại thời điểm bán", không
// chỉ so với tổng hiện tại.
//
// Issue #59: một cài đặt chỉ-biết-Cashflow (hàm derivePosition() cũ, đã xoá)
// KHÔNG đủ để tính vị thế đúng — nó (1) trả SL thiếu cổ tức cổ phiếu đã nhận,
// và (2) wentNegative có thể báo "bán vượt" SAI cho một lệnh bán thực ra hợp
// lệ (SL bán nằm trong phần SL đến từ cổ tức cổ phiếu, không phải mua). Fix
// lần 1: viết hàm này (khi đó tên derivePositionIncludingStockDividends) tính
// quantity/wentNegative đúng qua buildQuantityTimeline(), nhưng avgCost vẫn
// lấy THẲNG từ derivePosition(cashflows) cũ.
//
// Sửa lần 2 (retrofit, process/DECISION.md sau 2026-07-24 (2)): lấy avgCost
// từ hàm cũ là SAI — hàm đó chỉ phát lại BUY/SELL, không biết cổ tức cổ
// phiếu, nên khi một lệnh SELL "ăn" cả phần SL đến từ cổ tức, quantity nội bộ
// CHỈ-cashflow của nó đi âm mà không bao giờ đúng bằng 0 → điều kiện reset
// avgCost (`quantity.isZero()`) không kích hoạt, avgCost sai vĩnh viễn cho
// BUY kế tiếp — bug write-path thật (khác bug retrofit ở
// computeRealizedGainForHolding, lib/realized-pnl.ts, cùng họ nhưng ở đường
// đọc). Fix: tính avgCost bằng vòng lặp riêng ngay trong hàm này, chỉ xử lý
// BUY, dùng SL THỰC (gồm cả cổ tức cổ phiếu, before/after đã có sẵn từ
// buildQuantityTimeline() bên dưới — tái dùng không tính lại) làm cơ sở bình
// quân di động. Khi SL thực trước BUY = 0 (vị thế thực sự đóng hết, kể cả
// phần đến từ cổ tức), số hạng SL_trước × avgCost_cũ = 0 tự "quên" avgCost cũ
// — không cần bước reset tường minh riêng, đúng cho CẢ ca đóng hết LẪN ca bán
// một phần (không đóng hết). avgCost vẫn CHỈ đổi bởi BUY, KHÔNG đổi bởi cổ
// tức cổ phiếu — giữ nguyên quy tắc domain (docs/domain/03-dividends.md).
//
// Sửa lần 3 (dọn dẹp, process/DECISION.md sau 2026-07-24 (3)): sau fix lần 2,
// derivePosition() cũ (chỉ-Cashflow) không còn production caller nào — xoá
// hẳn, đổi tên hàm này (trước đó derivePositionIncludingStockDividends) thành
// derivePosition(), chiếm lại tên cũ vì giờ đây là cài đặt DUY NHẤT. Giữ 2
// bản công thức song song (dù bản kia chỉ còn sống trong test) chính là
// pattern đã gây chuỗi bug ở trên — không lặp lại.
//
// buildQuantityTimeline() (lib/position-trail.ts, đã phát lại đúng thứ tự
// thời gian CẢ Cashflow lẫn Dividend{STOCK}) dùng chung cho cả quantity/
// wentNegative lẫn avgCost. Dùng ở 4 action ghi giao dịch
// (features/holdings/actions.ts) và getHoldingDetail
// (features/holdings/queries.ts).
export function derivePosition(
  cashflows: CashflowInputWithEvent[],
  stockDividends: StockDividendInput[],
): { quantity: Decimal; avgCost: Decimal; wentNegative: boolean } {
  const events: PositionTrailEvent[] = [
    ...cashflows.map((cf) => ({
      id: cf.id,
      date: cf.date,
      createdAt: cf.createdAt,
      delta: cf.type === "BUY" ? cf.quantity : cf.quantity.neg(),
    })),
    ...stockDividends.map((dividend) => ({
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
      delta: dividend.quantity,
    })),
  ];

  // Map giữ thứ tự insertion = thứ tự chronological buildQuantityTimeline()
  // đã sort -> entry cuối cùng lặp qua chính là SL sau cùng.
  const timeline = buildQuantityTimeline(events);
  let quantity = new Decimal(0);
  let wentNegative = false;
  for (const entry of timeline.values()) {
    quantity = entry.after;
    if (entry.after.isNegative()) wentNegative = true;
  }

  // avgCost: chỉ BUY đổi, dùng SL thực (before/after từ timeline ở trên, gồm
  // cả cổ tức cổ phiếu) làm cơ sở bình quân — xem giải thích ở comment đầu hàm.
  let avgCost = new Decimal(0);
  for (const cf of sortByPositionTrailOrder(cashflows)) {
    if (cf.type !== "BUY") continue;
    const entry = timeline.get(cf.id)!;
    const realQuantityBefore = entry.before;
    const afterQty = entry.after;
    avgCost = afterQty.isZero()
      ? new Decimal(0)
      : realQuantityBefore
          .mul(avgCost)
          .plus(cf.quantity.mul(cf.pricePerUnit))
          .plus(cf.feeAmount)
          .div(afterQty);
  }

  // Sửa lần 4 (process/DECISION.md sau 2026-07-24 (4)): cơ chế "tự quên
  // avgCost cũ nhờ nhân 0" ở vòng lặp trên chỉ kích hoạt tại LẦN BUY KẾ TIẾP
  // (chỉ BUY mới chạm vào avgCost) — nếu chuỗi sự kiện kết thúc ngay sau một
  // lệnh SELL đóng hết vị thế (không còn BUY nào sau), không có "lần BUY kế
  // tiếp" nào để kích hoạt việc quên, nên avgCost bị kẹt ở giá trị cũ dù SL
  // thật đã về 0. Reset tường minh dựa trên `quantity` thật (dividend-aware,
  // không phải một biến cashflow-only riêng) — nhất quán với thiết kế "real
  // quantity là nguồn sự thật duy nhất" xuyên suốt hàm này.
  if (quantity.isZero()) avgCost = new Decimal(0);

  return { quantity, avgCost, wentNegative };
}
