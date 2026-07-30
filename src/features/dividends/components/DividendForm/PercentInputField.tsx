import { Input } from "@/components/ui/input";

import { FieldLabel } from "./FieldLabel";

type PercentInputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  // Dòng preview công thức + phần biến thiên theo loại (vd override số lượng
  // CP, chỉ STOCK) — ngay dưới ô nhập %, khác cấu trúc theo loại nên nhận
  // qua children (docs/rules/component-architecture.md mục "Biến thiên theo
  // enum nghiệp vụ lặp lại").
  children?: React.ReactNode;
};

// Ô nhập % dùng chung giữa CashDividendFields/StockDividendFields — chỉ khác
// label, phần còn lại (style, validation) là MỘT tri thức, tách để đổi một chỗ.
function PercentInputField({
  label,
  value,
  onChange,
  disabled,
  children,
}: PercentInputFieldProps) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          name="percent"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="h-15 rounded-2xl border-primary/40 pr-9 text-[26px] font-mono font-semibold"
          required
          disabled={disabled}
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2 text-base font-medium text-muted-foreground">
          %
        </span>
      </div>
      {children}
    </div>
  );
}

export { PercentInputField };
