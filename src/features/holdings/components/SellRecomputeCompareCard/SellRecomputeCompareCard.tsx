"use client";

import { Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SellRecomputeCompareCardProps = {
  icon: LucideIcon;
  label: string; // "Thuế bán · tính lại" / "Phí giao dịch · tính lại"
  fieldName: string; // "taxAmount" / "feeAmount"
  oldAmount: string; // giá trị đã lưu trên Cashflow — hiển thị gạch ngang
  oldSummaryLabel: string; // "Ngày cũ 10/01/2026 · thuế 0,10%"
  newAmount: string; // giá trị tính lại tại ngày hiện tại — prefill mặc định
  newSummaryLabel: string; // "Ngày mới 15/07/2026 · thuế 0,15%"
  newDetailNote?: string; // "SALE_TAX_STOCK áp dụng từ 01/03/2026"
  emphasized?: boolean;
  disabled?: boolean;
  className?: string;
};

// Card so sánh cũ/mới khi sửa ngày một SELL đã ghi (mockup 5f) —
// process/phase-5-plan-DRAFT.md mục B2. KHÁC AutoFilledAmountCard ở chỗ giá
// trị "mới" (newAmount) LUÔN ghi đè input mỗi khi đổi, kể cả khi user đã sửa
// tay trước đó (quyết định đã chốt: "không có cách phân biệt cũ do auto vs cũ
// do user sửa" — process/DECISION.md). Component KHÔNG tự làm việc "ghi đè mỗi
// lần ngày đổi" bằng effect — caller (TransactionForm) ép remount bằng
// `key={date}` mỗi khi ngày đổi, đây là pattern React chuẩn để reset state
// theo một trigger bên ngoài mà không cần đồng bộ effect.
function SellRecomputeCompareCard({
  icon: Icon,
  label,
  fieldName,
  oldAmount,
  oldSummaryLabel,
  newAmount,
  newSummaryLabel,
  newDetailNote,
  emphasized = false,
  disabled = false,
  className,
}: SellRecomputeCompareCardProps) {
  const [manualValue, setManualValue] = useState<string | null>(null);
  const value = manualValue ?? newAmount;

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

      <div className="flex items-center gap-3 px-3.75 py-2.75">
        <span className="flex-1 text-[11px] text-muted-faint">
          {oldSummaryLabel}
        </span>
        <span className="font-mono text-[13px] text-muted-faint line-through tabular-nums">
          {oldAmount}
        </span>
      </div>

      <div className="flex items-center gap-3 border-t border-white/5 bg-primary/6 px-3.75 py-2.75">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-primary">
            {newSummaryLabel}
          </div>
          {newDetailNote ? (
            <div className="mt-0.5 text-[10px] text-muted-faint">
              {newDetailNote}
            </div>
          ) : null}
        </div>
        <Input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={value}
          onChange={(event) => setManualValue(event.target.value)}
          disabled={disabled}
          className="h-auto w-28 shrink-0 border-none bg-transparent px-0 py-0 text-right font-mono text-base font-bold text-foreground shadow-none tabular-nums focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center gap-1.75 border-t border-white/5 px-3.75 py-2.5">
        <Pencil className="size-3.5 shrink-0 text-muted-faint" />
        <span className="text-[10.5px] text-muted-faint">
          Giá trị tính lại vẫn sửa tay được nếu cần khớp sao kê.
        </span>
      </div>

      <input type="hidden" name={fieldName} value={value} />
    </div>
  );
}

export { SellRecomputeCompareCard };
export type { SellRecomputeCompareCardProps };
