"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { FieldHint, FieldLabel } from "./FormFieldPrimitives";

type NewPurchaseFieldsProps = {
  quantity: string;
  onQuantityChange: (value: string) => void;
  unit: string;
  onUnitChange: (value: string) => void;
  unitOptions: string[];
  matchedPricePerUnit: string; // "Giá khớp lệnh / đơn vị"
  onMatchedPricePerUnitChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  feeCard: React.ReactNode; // slot — cha compose AutoFilledAmountCard
  totalBreakdown: React.ReactNode | null; // slot — TotalCostBreakdownCard, null khi chưa đủ SL+giá
  disabled?: boolean;
};

// Nhánh "Vừa mua hôm nay" (issue #140, mockup vtc) — cùng bố cục Số lượng +
// Đơn vị như ExistingPositionFields nhưng nhãn/field khác: giá khớp lệnh
// (chưa gồm phí, phí tính riêng ở feeCard) + ngày mua. KHÔNG có ô thuế
// (khớp buyHasNoTax(), src/features/holdings/schemas.ts — bất biến domain đã
// chốt, không phải quyết định UI mới).
function NewPurchaseFields({
  quantity,
  onQuantityChange,
  unit,
  onUnitChange,
  unitOptions,
  matchedPricePerUnit,
  onMatchedPricePerUnitChange,
  date,
  onDateChange,
  feeCard,
  totalBreakdown,
  disabled,
}: NewPurchaseFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Số lượng mua</FieldLabel>
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
        <FieldLabel>Giá khớp lệnh / đơn vị</FieldLabel>
        <div className="relative">
          <Input
            type="text"
            inputMode="decimal"
            name="pricePerUnit"
            placeholder="0"
            className="h-11 rounded-xl pr-8 font-mono font-semibold"
            value={matchedPricePerUnit}
            onChange={(event) =>
              onMatchedPricePerUnitChange(event.target.value)
            }
            required
            disabled={disabled}
          />
          <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-muted-faint">
            ₫
          </span>
        </div>
        <FieldHint>
          Giá khớp thật trên sao kê, chưa gồm phí — phí tính riêng bên dưới.
        </FieldHint>
      </div>

      <div>
        <FieldLabel>Ngày mua</FieldLabel>
        <DatePicker
          name="date"
          value={date}
          onChange={onDateChange}
          required
          disabled={disabled}
        />
      </div>

      {feeCard}
      {totalBreakdown}
    </>
  );
}

export { NewPurchaseFields };
export type { NewPurchaseFieldsProps };
