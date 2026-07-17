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

// Bù pha loãng khi ghi cổ tức cổ phiếu (issue #61, docs/domain/03-dividends.md
// "Bù pha loãng NAV khi ghi cổ tức"): Holding.quantity tăng NGAY khi ghi (recordDividend)
// nhưng giá (PriceQuote/NavOverride) chưa đổi kịp — tổng NAV bị thổi phồng tạm
// thời cho tới khi có giá mới. Giữ nguyên TỔNG GIÁ TRỊ trước/sau: giá_mới =
// giá_cũ × SL_trước / SL_sau. Trả null khi SL_sau = 0 (không thể — caller coi
// null = "không điều chỉnh được", không tạo NavOverride).
// Không cần clamp âm/0: đây là phép NHÂN với tỷ lệ SL_trước/SL_sau luôn dương
// (SL_sau > SL_trước >= 0, cổ tức chỉ CỘNG thêm SL) -> giá_mới luôn dương, trừ
// khi giá_cũ vốn đã <= 0 (dữ liệu hỏng có sẵn, không phải rủi ro do tính năng
// này gây ra — ngoài phạm vi xử lý ở đây).
export function computeStockDividendPriceAdjustment(input: {
  oldPrice: Decimal;
  quantityBefore: Decimal;
  quantityAfter: Decimal;
}): Decimal | null {
  if (input.quantityAfter.isZero()) return null;
  return input.oldPrice.mul(input.quantityBefore).div(input.quantityAfter);
}

// Bù pha loãng khi ghi cổ tức tiền mặt (issue #61, cùng lý do trên): tiền mặt
// rời khỏi vốn công ty → giá cổ phiếu thường điều chỉnh giảm tương ứng ngay
// ngày chia (ex-dividend), nhưng PriceQuote/NavOverride chưa kịp phản ánh.
// Trừ cổ tức GỘP (`grossAmount`, TRƯỚC thuế) trên mỗi cổ phần — đây là tiền
// rời khỏi vốn công ty, không liên quan thuế TNCN cá nhân của người nắm giữ
// (KHÔNG dùng netAmount). Trả null khi SL tại ngày ghi = 0.
// Trả null khi giá điều chỉnh <= 0 (review PR #62 finding #5,
// process/DECISION.md 2026-07-17 (3)) — có ca thật: CP giao dịch dưới mệnh
// giá kết hợp %cổ tức cao, hoặc nhiều đợt cổ tức liên tiếp cùng holding dồn
// giá xuống. Xử lý giống MISSING_PRICE (null = "không điều chỉnh được") —
// caller bỏ qua tạo NavOverride, dividend vẫn ghi thành công.
export function computeCashDividendPriceAdjustment(input: {
  oldPrice: Decimal;
  grossAmount: Decimal;
  quantityAtDate: Decimal;
}): Decimal | null {
  if (input.quantityAtDate.isZero()) return null;
  const newPrice = input.oldPrice.minus(
    input.grossAmount.div(input.quantityAtDate),
  );
  return newPrice.gt(0) ? newPrice : null;
}
