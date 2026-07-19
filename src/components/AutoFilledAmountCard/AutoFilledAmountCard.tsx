"use client";

import { Lightbulb, Pencil, Sigma } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AutoFilledAmountCardProps = {
  icon: LucideIcon;
  label: string;
  // Tên field submit qua FormData ("taxAmount"/"feeAmount") — giá trị thật
  // (manualValue ?? computedAmount) LUÔN đi qua một <input type="hidden"> riêng
  // do chính component render, tách khỏi input hiển thị (không có `name`) để
  // không đổi contract FormData mà addTransaction/updateTransaction đang đọc
  // (process/phase-5-plan-DRAFT.md mục B1).
  fieldName: string;
  // Decimal đã serialize — giá trị tự tính hiện tại từ form cha (đổi theo
  // quantity/giá/ngày). Component NGỪNG theo giá trị này một khi user gõ tay
  // (đến khi bấm "Đặt lại") — tự thân đây chính là "cờ dirty" của TRƯỜNG NÀY,
  // độc lập với card kia (mỗi instance AutoFilledAmountCard giữ state riêng,
  // nên card Thuế/Phí không vô tình ghi đè lẫn nhau khi field còn lại đổi).
  computedAmount: string;
  // Dòng công thức mờ dưới số, đã compose sẵn bởi form cha (vd
  // "369.000.000 × 0,1% — SALE_TAX_STOCK @ 15/07/2026").
  formulaLabel: string;
  // Viền/nền nổi bật hơn — dùng cho card Thuế (mockup 5a), card Phí phẳng hơn.
  emphasized?: boolean;
  disabled?: boolean;
  className?: string;
};

// Card "tự điền, sửa được" dùng chung cho Thuế bán & Phí giao dịch trong
// TransactionForm (process/phase-5-plan-DRAFT.md mục B1) — một component thay
// vì hai khối JSX gần giống nhau. LUÔN có link "Đặt lại" cho cả hai trường hợp
// dùng (quyết định đồng bộ UX, process/DECISION.md 2026-07-18 (5) điểm 2), dù
// mockup 5a/5b chỉ vẽ nút này ở card Thuế.
function AutoFilledAmountCard({
  icon: Icon,
  label,
  fieldName,
  computedAmount,
  formulaLabel,
  emphasized = false,
  disabled = false,
  className,
}: AutoFilledAmountCardProps) {
  const [manualValue, setManualValue] = useState<string | null>(null);
  const value = manualValue ?? computedAmount;
  const isManual = manualValue !== null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        emphasized
          ? "border-primary/40 bg-linear-to-br from-primary/10 to-card"
          : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/6 px-3.75 py-2.75">
        <Icon className="size-4.25 shrink-0 text-primary" />
        <span className="flex-1 text-[13px] font-semibold text-foreground">
          {label}
        </span>
        <Badge className="shrink-0 text-[9px] tracking-wide">
          TỰ ĐIỀN · SỬA ĐƯỢC
        </Badge>
      </div>

      <div className="flex items-center gap-2.5 px-3.75 py-3.25">
        <Input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={value}
          onChange={(event) => setManualValue(event.target.value)}
          disabled={disabled}
          className="h-auto flex-1 border-none bg-transparent px-0 py-0 font-mono text-[22px] font-semibold text-foreground shadow-none tabular-nums focus-visible:ring-0"
        />
        <Pencil className="size-4.5 shrink-0 text-primary" />
      </div>

      <div className="flex items-center gap-1.75 px-3.75 pb-3">
        <Sigma className="size-3.5 shrink-0 text-muted-faint" />
        <span className="font-mono text-[11px] text-muted-faint">
          {formulaLabel}
        </span>
      </div>

      <div className="flex items-start gap-2.25 border-t border-white/5 bg-white/2 px-3.75 py-2.75">
        <Lightbulb className="mt-0.5 size-3.75 shrink-0 text-muted-faint" />
        <span className="flex-1 text-[10.5px] leading-relaxed text-muted-faint">
          Số tự tính chỉ là gợi ý (giống Giá tự nhập). Sửa tay để khớp đúng số
          trên sao kê.
        </span>
        <button
          type="button"
          onClick={() => setManualValue(null)}
          disabled={!isManual || disabled}
          className="shrink-0 text-[10.5px] font-bold text-primary disabled:opacity-40"
        >
          Đặt lại
        </button>
      </div>

      <input type="hidden" name={fieldName} value={value} />
    </div>
  );
}

export { AutoFilledAmountCard };
export type { AutoFilledAmountCardProps };
