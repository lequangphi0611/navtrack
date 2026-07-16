import Decimal from "decimal.js";

// Công thức thuần cho cổ tức tiền mặt (docs/domain/03-dividends.md "Cách
// tính"): grossAmount = mệnh giá × %/100 × SL đang giữ; taxAmount = gross ×
// thuế%/100; netAmount = gross − tax. netAmount là dòng tiền dương đưa vào
// XIRR (features/holdings/queries.ts::getCashDividends).
export function computeCashDividend(input: {
  percent: Decimal;
  parValue: Decimal;
  taxRatePercent: Decimal;
  quantity: Decimal;
}): { grossAmount: Decimal; taxAmount: Decimal; netAmount: Decimal } {
  const pricePerUnit = input.parValue.mul(input.percent).div(100);
  const grossAmount = pricePerUnit.mul(input.quantity);
  const taxAmount = grossAmount.mul(input.taxRatePercent).div(100);
  const netAmount = grossAmount.minus(taxAmount);
  return { grossAmount, taxAmount, netAmount };
}

// Công thức thuần cho cổ tức cổ phiếu (docs/domain/03-dividends.md "Cách
// tính"): stockQuantity = SL đang giữ × %/100 — không phát sinh dòng tiền,
// avgCost giữ nguyên (xem features/dividends/actions.ts::recordDividend).
export function computeStockDividend(input: {
  percent: Decimal;
  quantity: Decimal;
}): { stockQuantity: Decimal } {
  return { stockQuantity: input.quantity.mul(input.percent).div(100) };
}
