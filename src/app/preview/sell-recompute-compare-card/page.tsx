"use client";

import { Percent, ReceiptText } from "lucide-react";

import { SellRecomputeCompareCard } from "@/features/holdings/components/SellRecomputeCompareCard";

// "use client" bắt buộc ở đây — cùng lý do đã ghi ở
// preview/auto-filled-amount-card/page.tsx: SellRecomputeCompareCard là
// "use client" và nhận `icon: LucideIcon` (component reference), không
// serialize được qua ranh giới Server -> Client Component.
//
// Soi cặp card "tính lại" khi sửa ngày một SELL đã ghi (mockup 5f) — thuế +
// phí, cùng lúc, đúng ca biên đã ghi ở process/phase-5-plan-DRAFT.md dòng 172.
export default function SellRecomputeCompareCardPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <SellRecomputeCompareCard
        icon={ReceiptText}
        label="Thuế bán · tính lại"
        fieldName="taxAmount"
        oldAmount="369000"
        oldSummaryLabel="Ngày cũ 10/01/2026 · thuế 0,10%"
        newAmount="553500"
        newSummaryLabel="Ngày mới 15/07/2026 · thuế 0,15%"
        newDetailNote="SALE_TAX_STOCK áp dụng từ 01/03/2026"
        emphasized
      />

      <SellRecomputeCompareCard
        icon={Percent}
        label="Phí giao dịch · tính lại"
        fieldName="feeAmount"
        oldAmount="922500"
        oldSummaryLabel="Ngày cũ · biểu phí 0,25%"
        newAmount="1107000"
        newSummaryLabel="Ngày mới · biểu phí 0,3%"
      />
    </div>
  );
}
