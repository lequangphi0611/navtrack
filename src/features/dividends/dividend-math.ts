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
// Cổ phiếu không chia lẻ -> stockQuantity được LÀM TRÒN XUỐNG (floor) so với
// công thức tuyến tính. rawStockQuantity (trước làm tròn) giữ lại làm mốc so
// sánh tolerance khi user tự chỉnh (isStockQuantityOverrideValid bên dưới) —
// công ty phát hành có thể áp quy ước làm tròn khác (vd theo lô) lệch khỏi
// công thức tuyến tính của app.
export function computeStockDividend(input: {
  percent: Decimal;
  quantity: Decimal;
}): {
  rawStockQuantity: Decimal;
  stockQuantity: Decimal;
  wasRounded: boolean;
} {
  const rawStockQuantity = input.quantity.mul(input.percent).div(100);
  const stockQuantity = rawStockQuantity.floor();
  return {
    rawStockQuantity,
    stockQuantity,
    wasRounded: !rawStockQuantity.eq(stockQuantity),
  };
}

// Sai lệch tối đa cho phép giữa giá trị user tự sửa (stockQuantityOverride)
// và rawStockQuantity (số CP thưởng RAW, trước làm tròn, tính từ %) — đủ rộng
// để chấp nhận quy ước làm tròn khác của công ty phát hành (vd theo lô), đủ
// hẹp để bắt lỗi gõ nhầm.
export const STOCK_DIVIDEND_ROUNDING_TOLERANCE = new Decimal(2);

export function isStockQuantityOverrideValid(
  override: Decimal,
  rawStockQuantity: Decimal,
): boolean {
  return override
    .minus(rawStockQuantity)
    .abs()
    .lte(STOCK_DIVIDEND_ROUNDING_TOLERANCE);
}
