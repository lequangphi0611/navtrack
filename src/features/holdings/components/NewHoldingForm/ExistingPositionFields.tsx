"use client";

import { Info } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";

import { toAmount } from "./amount";
import { FieldHint, FieldLabel } from "./FormFieldPrimitives";

type ExistingPositionFieldsProps = {
  quantity: string;
  onQuantityChange: (value: string) => void;
  unit: string;
  onUnitChange: (value: string) => void;
  unitOptions: string[];
  avgCostPerUnit: string;
  onAvgCostPerUnitChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  disabled?: boolean;
};

// Nhánh "Đã có từ trước" (issue #140, mockup vtb) — field GIỮ NGUYÊN hành vi
// của NewHoldingForm gốc (khai báo lịch sử, giá vốn bình quân đã gộp), chỉ
// thêm 1 hint mới dưới field giá vốn.
function ExistingPositionFields({
  quantity,
  onQuantityChange,
  unit,
  onUnitChange,
  unitOptions,
  avgCostPerUnit,
  onAvgCostPerUnitChange,
  date,
  onDateChange,
  disabled,
}: ExistingPositionFieldsProps) {
  const initialAmount = toAmount(quantity, avgCostPerUnit);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Số lượng</FieldLabel>
          <Input
            type="text"
            inputMode="decimal"
            name="quantity"
            placeholder="0"
            className="h-11 rounded-xl font-mono font-semibold"
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div>
          <FieldLabel>Đơn vị</FieldLabel>
          <Select
            name="unit"
            value={unit}
            onChange={(event) => onUnitChange(event.target.value)}
            className="h-11 rounded-xl font-semibold"
            required
            disabled={disabled}
          >
            {unitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel>Giá vốn bình quân / đơn vị</FieldLabel>
        <div className="relative">
          <Input
            type="text"
            inputMode="decimal"
            name="pricePerUnit"
            placeholder="0"
            className="h-11 rounded-xl pr-8 font-mono font-semibold"
            value={avgCostPerUnit}
            onChange={(event) => onAvgCostPerUnitChange(event.target.value)}
            required
            disabled={disabled}
          />
          <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-muted-faint">
            ₫
          </span>
        </div>
        <FieldHint>
          Nên là giá vốn đã gồm mọi chi phí đã trả cho các lần mua trước (phí,
          thuế nếu có) — app không hỏi riêng phí ở nhánh này.
        </FieldHint>
      </div>

      <div>
        <FieldLabel>Ngày chốt vị thế</FieldLabel>
        <DatePicker
          name="date"
          value={date}
          onChange={onDateChange}
          required
          disabled={disabled}
        />
        <FieldHint>Lãi/lỗ được tính từ mốc này trở đi.</FieldHint>
      </div>

      {initialAmount > 0 ? (
        <div className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/8 p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <Info className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            Tổng vốn ban đầu = số lượng × giá vốn ={" "}
            <span className="font-mono font-medium text-foreground-soft tabular-nums">
              {formatMoney(String(initialAmount))}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

export { ExistingPositionFields };
export type { ExistingPositionFieldsProps };
