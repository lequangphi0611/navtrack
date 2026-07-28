import Decimal from "decimal.js";

// Số liệu màn "Tất toán đáo hạn" (mockup Phase 7 Screens 7e/7f) — preview
// client-side để user thấy ngay khi sửa số lượng/giá, KHÔNG phải nguồn sự thật:
// Server Action ghi Cashflow{type: MATURITY} (issue #101) tự tính lại độc lập.
//
// Hai luật thuế được thể hiện ở đây (docs/domain/07-tax.md, process/phase-7.md):
//  1. Đáo hạn KHÔNG phải chuyển nhượng -> không áp thuế bán 0,1%.
//  2. Mua chiết khấu (giá vốn < mệnh giá) -> phần chênh là LÃI, chịu thuế lãi
//     trái phiếu theo issuerType (5% doanh nghiệp / 0% chính phủ).

type MaturitySettlementInput = {
  quantity: string;
  pricePerUnit: string; // tiền nhận về mỗi trái phiếu, prefill = mệnh giá
  avgCost: string; // giá vốn bình quân mỗi trái phiếu
  interestTaxRatePercent: string; // "5" | "0"
};

type MaturitySettlementPreview = {
  // Tổng tiền nhận về theo giá đang nhập (chưa trừ thuế).
  grossProceeds: string;
  // Lợi tức chịu thuế = max(0, (giá nhận về − giá vốn) × SL). Mua đúng mệnh
  // giá -> 0; mua cao hơn mệnh giá (lỗ) cũng -> 0, không âm.
  taxableInterest: string;
  // Thuế lãi tính trên taxableInterest.
  taxAmount: string;
  // Thực nhận = gross − thuế.
  netProceeds: string;
  // true khi có lợi tức chịu thuế -> hiện card "Vì sao lần này có thuế" (7f).
  hasTaxableInterest: boolean;
  // Lợi tức mỗi trái phiếu — dùng cho dòng công thức "2 × 8.000.000 × 5%".
  interestPerUnit: string;
};

function toDecimalOrZero(value: string): Decimal {
  const trimmed = value.trim();
  if (trimmed === "") return new Decimal(0);
  try {
    const parsed = new Decimal(trimmed.replace(",", "."));
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

function computeMaturitySettlementPreview({
  quantity,
  pricePerUnit,
  avgCost,
  interestTaxRatePercent,
}: MaturitySettlementInput): MaturitySettlementPreview {
  const qty = toDecimalOrZero(quantity);
  const price = toDecimalOrZero(pricePerUnit);
  const cost = toDecimalOrZero(avgCost);
  const taxRate = toDecimalOrZero(interestTaxRatePercent);

  const grossProceeds = price.mul(qty);
  const rawInterestPerUnit = price.minus(cost);
  const interestPerUnit = rawInterestPerUnit.gt(0)
    ? rawInterestPerUnit
    : new Decimal(0);
  const taxableInterest = interestPerUnit.mul(qty);
  const taxAmount = taxableInterest.mul(taxRate).div(100);
  const netProceeds = grossProceeds.minus(taxAmount);

  return {
    grossProceeds: grossProceeds.toString(),
    taxableInterest: taxableInterest.toString(),
    taxAmount: taxAmount.toString(),
    netProceeds: netProceeds.toString(),
    hasTaxableInterest: taxableInterest.gt(0),
    interestPerUnit: interestPerUnit.toString(),
  };
}

export { computeMaturitySettlementPreview, toDecimalOrZero };
export type { MaturitySettlementInput, MaturitySettlementPreview };
