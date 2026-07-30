import { Info } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";

import { FieldLabel } from "./FieldLabel";

type PaymentDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  // Ghi chú khác câu chữ theo loại (CASH: mốc tính XIRR; STOCK: thuần thông
  // tin) — DatePicker/label dùng chung, chỉ câu chữ khác nên nhận children.
  children: React.ReactNode;
};

// Field "Ngày thanh toán · tuỳ chọn" (issue #61) dùng chung giữa
// CashDividendFields/StockDividendFields.
function PaymentDateField({
  value,
  onChange,
  disabled,
  children,
}: PaymentDateFieldProps) {
  return (
    <div>
      <FieldLabel>
        Ngày thanh toán{" "}
        <span className="font-normal text-muted-faint">· tuỳ chọn</span>
      </FieldLabel>
      <DatePicker
        name="paymentDate"
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-faint">
        <Info className="mt-0.5 size-3.25 shrink-0" />
        <span>{children}</span>
      </div>
    </div>
  );
}

export { PaymentDateField };
