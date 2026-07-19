import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";
import { buildQuantityTimeline } from "@/lib/position-trail";
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

// Phát lại lịch sử Cashflow theo thứ tự ngày để suy ra số lượng + giá vốn bình quân
// hiện tại (phương pháp bình quân di động — xem docs/domain/02-transactions-and-cost-basis.md).
// wentNegative = true nếu số lượng từng âm ở bất kỳ thời điểm nào khi phát lại — dùng để
// chặn bán vượt số lượng đang giữ "tại thời điểm bán", không chỉ so với tổng hiện tại.
export function derivePosition(cashflows: CashflowInput[]): {
  quantity: Decimal;
  avgCost: Decimal;
  wentNegative: boolean;
} {
  const sorted = [...cashflows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  let quantity = new Decimal(0);
  let avgCost = new Decimal(0);
  let wentNegative = false;

  for (const cf of sorted) {
    if (cf.type === "BUY") {
      const newQuantity = quantity.plus(cf.quantity);
      // Gộp phí mua vào tử số (đóng issue #66, docs/domain/02-transactions-and-cost-basis.md
      // mục "Cách tính"): giá vốn mới = (SL cũ × giá vốn cũ + (SL mua × giá mua
      // + phí mua)) / (SL cũ + SL mua) — avgCost phản ánh đúng tổng tiền thực
      // đã bỏ ra, khớp amount của BUY (-(quantity × pricePerUnit) - feeAmount).
      avgCost = newQuantity.isZero()
        ? new Decimal(0)
        : quantity
            .mul(avgCost)
            .plus(cf.quantity.mul(cf.pricePerUnit))
            .plus(cf.feeAmount)
            .div(newQuantity);
      quantity = newQuantity;
    } else {
      quantity = quantity.minus(cf.quantity);
      if (quantity.isNegative()) wentNegative = true;
      if (quantity.isZero()) avgCost = new Decimal(0);
    }
  }

  return { quantity, avgCost, wentNegative };
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

// Issue #59: derivePosition() một mình KHÔNG đủ để tính vị thế đúng — nó chỉ
// biết Cashflow, nên (1) SL trả về thiếu cổ tức cổ phiếu đã nhận, và (2)
// wentNegative có thể báo "bán vượt" SAI cho một lệnh bán thực ra hợp lệ (SL
// bán nằm trong phần SL đến từ cổ tức cổ phiếu, không phải mua). Hàm này kết
// hợp derivePosition() (avgCost — CHỈ dẫn xuất từ Cashflow, cổ tức cổ phiếu
// không đổi avgCost, xem docs/domain/03-dividends.md) với
// buildQuantityTimeline() (lib/position-trail.ts, đã phát lại đúng thứ tự
// thời gian CẢ Cashflow lẫn Dividend{STOCK}) để lấy SL + validate bán vượt
// đúng. Dùng ở 4 action ghi giao dịch (features/holdings/actions.ts) và
// getHoldingDetail (features/holdings/queries.ts) — derivePosition() giữ
// nguyên không đổi (vẫn đúng/đủ cho avgCost, có unit test riêng bao phủ).
export function derivePositionIncludingStockDividends(
  cashflows: CashflowInputWithEvent[],
  stockDividends: StockDividendInput[],
): { quantity: Decimal; avgCost: Decimal; wentNegative: boolean } {
  const { avgCost } = derivePosition(cashflows);

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

  return { quantity, avgCost, wentNegative };
}
