import Decimal from "decimal.js";

import { computeMaturitySettlement } from "@/lib/maturity-settlement";

// Số liệu màn "Tất toán đáo hạn" (mockup Phase 7 Screens 7e/7f) — preview
// client-side để user thấy ngay khi sửa số lượng/giá, KHÔNG phải nguồn sự thật:
// Server Action ghi Cashflow{type: MATURITY} (settleMaturity,
// features/holdings/actions.ts) tự tính lại độc lập.
//
// CÔNG THỨC không sống ở đây — nằm ở `src/lib/maturity-settlement.ts`, dùng
// chung với Server Action (issue #101). File này chỉ giữ phần riêng của form:
// parse chuỗi người dùng đang gõ (có thể dở dang/sai định dạng) và format ngược
// ra chuỗi để hiển thị. Giữ 2 bản công thức song song chính là pattern đã gây
// chuỗi bug retrofit ở derivePosition/computeRealizedGainForHolding
// (process/DECISION.md 2026-07-24) — không lặp lại.

type MaturitySettlementInput = {
  quantity: string;
  pricePerUnit: string; // tiền nhận về mỗi trái phiếu, prefill = mệnh giá
  avgCost: string; // giá vốn bình quân mỗi trái phiếu
  interestTaxRatePercent: string; // "5" | "0"
};

type MaturitySettlementPreview = {
  grossProceeds: string;
  taxableInterest: string;
  taxAmount: string;
  netProceeds: string;
  hasTaxableInterest: boolean;
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
  const result = computeMaturitySettlement({
    quantity: toDecimalOrZero(quantity),
    pricePerUnit: toDecimalOrZero(pricePerUnit),
    avgCost: toDecimalOrZero(avgCost),
    interestTaxRatePercent: toDecimalOrZero(interestTaxRatePercent),
  });

  return {
    grossProceeds: result.grossProceeds.toString(),
    taxableInterest: result.taxableInterest.toString(),
    taxAmount: result.taxAmount.toString(),
    netProceeds: result.netProceeds.toString(),
    hasTaxableInterest: result.hasTaxableInterest,
    interestPerUnit: result.interestPerUnit.toString(),
  };
}

export { computeMaturitySettlementPreview, toDecimalOrZero };
export type { MaturitySettlementInput, MaturitySettlementPreview };
