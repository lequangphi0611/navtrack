"use client";

import type { ChangeEvent, ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { formatMoneyInputDisplay, parseMoneyInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange"
> & {
  // Chuỗi số thuần, "." = thập phân — khớp decimalString ở
  // features/holdings/schemas.ts. KHÔNG phải chuỗi đã format có dấu phân cách.
  value: string;
  // Emit chuỗi số thuần, KHÔNG phải ChangeEvent.
  onChange: (value: string) => void;
  // Forward vào hidden input — FormData đọc canonical value từ đây.
  name?: string;
};

// Đếm ký tự thuộc [0-9,] trong `value` nằm trước vị trí `upTo` — dùng để giữ
// vị trí con trỏ tương đối khi chuỗi hiển thị đổi độ dài (thêm/bớt dấu chấm
// nhóm hàng nghìn) sau mỗi lần gõ.
function countDigitOrCommaBefore(value: string, upTo: number): number {
  let count = 0;
  for (let i = 0; i < upTo && i < value.length; i += 1) {
    if (/[0-9,]/.test(value[i] ?? "")) count += 1;
  }
  return count;
}

// Ngược lại countDigitOrCommaBefore: tìm vị trí trong `formatted` ngay sau khi
// đã đếm đủ `keepCount` ký tự [0-9,] tính từ trái sang.
function positionAfterKeepCount(formatted: string, keepCount: number): number {
  if (keepCount <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/[0-9,]/.test(formatted[i] ?? "")) {
      count += 1;
      if (count === keepCount) return i + 1;
    }
  }
  return formatted.length;
}

function MoneyInput({
  value,
  onChange,
  name,
  className,
  ...rest
}: MoneyInputProps) {
  const displayValue = formatMoneyInputDisplay(value);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const rawValue = target.value;
    const selectionStart = target.selectionStart ?? rawValue.length;
    const keepCount = countDigitOrCommaBefore(rawValue, selectionStart);

    const sanitized = parseMoneyInputValue(rawValue);
    const formatted = formatMoneyInputDisplay(sanitized);
    const newPos = positionAfterKeepCount(formatted, keepCount);

    // Gán trực tiếp lên DOM node trước khi React re-render: chuỗi DOM khớp
    // sẵn với displayValue sắp render nên React không set lại .value, con
    // trỏ vừa đặt không bị reset (xem docs/rules — không cần ref/useLayoutEffect).
    target.value = formatted;
    target.setSelectionRange(newPos, newPos);

    onChange(sanitized);
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={cn("pr-8", className)}
        data-testid={name}
        {...rest}
      />
      <input type="hidden" name={name} value={value} readOnly />
      <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-muted-faint">
        ₫
      </span>
    </div>
  );
}

export { MoneyInput };
export type { MoneyInputProps };
