import { Check, Settings2 } from "lucide-react";

type PriceAdjustmentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
};

// Issue #61: checkbox điều khiển việc Server Action có tự tạo NavOverride bù
// pha loãng hay không — áp dụng CẢ CASH/STOCK như nhau, không phụ thuộc
// DividendType (khác các block khác trong form). Submit qua hidden input
// "true"/"false" ở DividendForm, không phải chính input này.
function PriceAdjustmentCheckbox({
  checked,
  onChange,
  disabled,
}: PriceAdjustmentCheckboxProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
        <Settings2 className="size-3.75 text-accent" />
        Giá điều chỉnh kỹ thuật
        <span className="ml-auto text-[10.5px] font-medium text-muted-faint">
          ngày chia
        </span>
      </div>
      <label className="relative flex cursor-pointer items-start gap-2.75 px-3.75 py-3.25">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
          disabled={disabled}
        />
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-white/4 transition-colors peer-checked:border-accent peer-checked:bg-accent">
          <Check className="size-3.5 text-accent-foreground opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
        <span className="flex-1">
          <span className="block text-[12.5px] font-semibold text-muted-foreground">
            Giá hiện tại đã phản ánh đợt chia này
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-faint">
            Bỏ trống → hệ thống tự tính và ghi giá điều chỉnh tại ngày chia.
            Tick nếu giá đang niêm yết đã đúng (vd job cập nhật giá đã chạy
            lại).
          </span>
        </span>
      </label>
    </div>
  );
}

export { PriceAdjustmentCheckbox };
