import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";

export type CashflowInput = {
  type: CashflowType;
  date: Date;
  quantity: Decimal;
  pricePerUnit: Decimal;
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
      avgCost = newQuantity.isZero()
        ? new Decimal(0)
        : quantity
            .mul(avgCost)
            .plus(cf.quantity.mul(cf.pricePerUnit))
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
