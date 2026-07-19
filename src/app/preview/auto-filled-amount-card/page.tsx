"use client";

import { Percent, ReceiptText } from "lucide-react";

import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";

// "use client" bắt buộc ở đây: AutoFilledAmountCard là "use client" và nhận
// `icon: LucideIcon` (component reference, không phải ReactNode) — truyền
// thẳng từ Server Component sang Client Component sẽ crash ("Functions cannot
// be passed directly to Client Components", RSC không serialize được function
// reference). Khớp đúng cách dùng thật trong TransactionForm.tsx (vốn đã
// "use client" nên đây luôn là client -> client, không qua ranh giới RSC).
//
// Soi 4 biến thể: card Thuế (emphasized) + card Phí (thường), ca thường +
// ca "0 ₫" (mockup 5c — bán vàng, SALE_TAX_GOLD/TRANSACTION_FEE_*_GOLD = 0%
// vẫn hiện badge, không ẩn card). Thử gõ tay vào ô số rồi bấm "Đặt lại" để
// soi hành vi dirty-state trực tiếp trên trình duyệt.
export default function AutoFilledAmountCardPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <AutoFilledAmountCard
        icon={ReceiptText}
        label="Thuế bán"
        fieldName="taxAmount"
        computedAmount="369000"
        formulaLabel="369.000.000 ₫ × 0,1% — SALE_TAX_STOCK @ 15/07/2026"
        emphasized
      />

      <AutoFilledAmountCard
        icon={Percent}
        label="Phí giao dịch"
        fieldName="feeAmount"
        computedAmount="1107000"
        formulaLabel="369.000.000 ₫ × 0,3% — TRANSACTION_FEE_SELL_STOCK @ 15/07/2026"
      />

      <AutoFilledAmountCard
        icon={ReceiptText}
        label="Thuế bán · vàng"
        fieldName="taxAmount"
        computedAmount="0"
        formulaLabel="164.000.000 ₫ × 0% — SALE_TAX_GOLD @ 15/07/2026"
        emphasized
      />

      <AutoFilledAmountCard
        icon={Percent}
        label="Phí giao dịch · vàng"
        fieldName="feeAmount"
        computedAmount="0"
        formulaLabel="164.000.000 ₫ × 0% — TRANSACTION_FEE_SELL_GOLD @ 15/07/2026"
      />

      <AutoFilledAmountCard
        icon={Percent}
        label="Phí giao dịch · disabled (đang submit)"
        fieldName="feeAmount"
        computedAmount="1107000"
        formulaLabel="369.000.000 ₫ × 0,3% — TRANSACTION_FEE_SELL_STOCK @ 15/07/2026"
        disabled
      />
    </div>
  );
}
