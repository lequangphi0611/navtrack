import Decimal from "decimal.js";

// Tất toán đáo hạn trái phiếu (Phase 7, issue #101) — công thức DUY NHẤT, dùng
// chung cho Server Action (features/holdings/actions.ts::settleMaturity) và
// preview client-side của MaturitySettlementForm. Thuần, không đụng DB.
//
// Hai luật thuế ở đây, cả hai đều dễ làm sai theo hướng ngược nhau
// (docs/domain/07-tax.md mục "Thuế lãi trái phiếu & đáo hạn"):
//
//  1. **KHÔNG áp `SALE_TAX_BOND` 0,1%.** Đáo hạn là nhận lại gốc TỪ CHÍNH tổ
//     chức phát hành, không phải chuyển nhượng chứng khoán trên thị trường thứ
//     cấp. Ghi đáo hạn bằng một dòng SELL sẽ đánh 0,1% trên TOÀN BỘ mệnh giá
//     hoàn trả — sai theo hướng thu quá.
//  2. **Nhưng thuế KHÔNG phải 0 cứng.** Với trái phiếu mua chiết khấu/
//     zero-coupon, toàn bộ lợi tức nằm ở phần chênh giữa số nhận về và giá vốn,
//     và phần đó là LÃI (chịu thuế lãi trái phiếu theo `issuerType`), không phải
//     capital gain. Cho thuế = 0 cứng là sai theo hướng thu thiếu.
//
// Công thức tổng quát dưới đây phủ CẢ HAI ca, không cần nhánh riêng: mua đúng
// mệnh giá thì `avgCost >= parValue` (avgCost đã gồm phí mua) -> chênh lệch <= 0
// -> `taxableInterest` = 0 -> thuế ra 0 một cách tự nhiên.

export type MaturitySettlementInput = {
  quantity: Decimal;
  // Tiền nhận về mỗi trái phiếu — prefill = mệnh giá, user sửa được.
  pricePerUnit: Decimal;
  // Giá vốn bình quân mỗi trái phiếu (đã gồm phí mua).
  avgCost: Decimal;
  // BOND_INTEREST_TAX_RATE_<issuerType> tại ngày tất toán.
  interestTaxRatePercent: Decimal;
};

export type MaturitySettlement = {
  // Tổng tiền nhận về theo giá đang nhập (chưa trừ thuế/phí).
  grossProceeds: Decimal;
  // Lợi tức mỗi trái phiếu — kẹp sàn 0 (mua CAO hơn mệnh giá là lỗ, không phải
  // lãi âm chịu thuế âm).
  interestPerUnit: Decimal;
  // Lợi tức chịu thuế = interestPerUnit × SL.
  taxableInterest: Decimal;
  // Thuế lãi tính trên taxableInterest.
  taxAmount: Decimal;
  // Thực nhận = gross − thuế (CHƯA trừ phí — phí xử lý ở computeCashflowAmount,
  // xem lib/cost-basis.ts; đáo hạn thường không qua lệnh khớp nên phí = 0).
  netProceeds: Decimal;
  // true khi có lợi tức chịu thuế -> UI hiện card "Vì sao lần này có thuế" (7f).
  hasTaxableInterest: boolean;
};

export function computeMaturitySettlement(
  input: MaturitySettlementInput,
): MaturitySettlement {
  const grossProceeds = input.pricePerUnit.mul(input.quantity);

  const rawInterestPerUnit = input.pricePerUnit.minus(input.avgCost);
  const interestPerUnit = rawInterestPerUnit.gt(0)
    ? rawInterestPerUnit
    : new Decimal(0);

  const taxableInterest = interestPerUnit.mul(input.quantity);
  const taxAmount = taxableInterest.mul(input.interestTaxRatePercent).div(100);
  const netProceeds = grossProceeds.minus(taxAmount);

  return {
    grossProceeds,
    interestPerUnit,
    taxableInterest,
    taxAmount,
    netProceeds,
    hasTaxableInterest: taxableInterest.gt(0),
  };
}
