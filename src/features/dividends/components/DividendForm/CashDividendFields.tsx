import Decimal from "decimal.js";
import { Calculator, Lock, TrendingUp } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";
import type { DividendHolding } from "@/features/dividends/types";
import { formatMoney, formatQuantity } from "@/lib/format";

import { FieldLabel } from "./FieldLabel";
import { InfoNote } from "./InfoNote";
import { parseDecimalOrNull } from "./parse-decimal";
import { PaymentDateField } from "./PaymentDateField";
import { PercentInputField } from "./PercentInputField";
import { PreviewBreakdownCard } from "./PreviewBreakdownCard";
import { PreviewFormulaRow } from "./PreviewFormulaRow";

type CashDividendFieldsProps = {
  holding: DividendHolding;
  percent: string;
  onPercentChange: (value: string) => void;
  faceValuePerShare: string;
  taxRatePercent: string;
  date: string;
  onDateChange: (value: string) => void;
  paymentDate: string;
  onPaymentDateChange: (value: string) => void;
  isPending: boolean;
  // PriceAdjustmentCheckbox — dùng chung với StockDividendFields, không phụ
  // thuộc DividendType, DividendForm truyền vào để giữ đúng vị trí giữa card
  // breakdown và alert (xem docs/rules/component-architecture.md mục "Biến
  // thiên theo enum nghiệp vụ lặp lại").
  children: React.ReactNode;
};

// Toàn bộ phần biến thiên theo DividendType="CASH" của DividendForm — tự tính
// preview (gross/tax/net) và tự lắp atom dùng chung
// (PercentInputField/PreviewFormulaRow/PaymentDateField/PreviewBreakdownCard/
// InfoNote), không rẽ nhánh theo `type` ở bất kỳ đâu trong file này.
function CashDividendFields({
  holding,
  percent,
  onPercentChange,
  faceValuePerShare,
  taxRatePercent,
  date,
  onDateChange,
  paymentDate,
  onPaymentDateChange,
  isPending,
  children,
}: CashDividendFieldsProps) {
  const percentDecimal = parseDecimalOrNull(percent);
  const quantity = new Decimal(holding.quantity);

  // Preview CASH — chỉ minh hoạ client-side, Server Action (#52) tự tính lại
  // gross/tax/net độc lập, KHÔNG tin số này khi lưu.
  const pricePerShare = percentDecimal
    ? new Decimal(faceValuePerShare).mul(percentDecimal).div(100)
    : null;
  const grossAmount = pricePerShare ? pricePerShare.mul(quantity) : null;
  const taxAmount = grossAmount
    ? grossAmount.mul(taxRatePercent).div(100)
    : null;
  const netAmount =
    grossAmount && taxAmount ? grossAmount.minus(taxAmount) : null;

  return (
    <>
      <PercentInputField
        label="Tỷ lệ cổ tức (% mệnh giá)"
        value={percent}
        onChange={onPercentChange}
        disabled={isPending}
      >
        <PreviewFormulaRow>
          <span>
            {percent || "0"}% × {formatMoney(faceValuePerShare)} mệnh giá ={" "}
            <span className="text-primary">
              {pricePerShare
                ? `${formatMoney(pricePerShare.toString())}/${holding.unit}`
                : "—"}
            </span>
          </span>
        </PreviewFormulaRow>
      </PercentInputField>

      <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2.5">
        <div>
          <FieldLabel>Ngày nhận</FieldLabel>
          <DatePicker
            name="date"
            value={date}
            onChange={onDateChange}
            required
            disabled={isPending}
          />
        </div>
        <div>
          <FieldLabel>Thuế</FieldLabel>
          <div className="flex h-11 w-full items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3">
            <Lock className="size-3.5 shrink-0 text-muted-faint" />
            <span className="font-mono text-[13.5px] font-semibold text-muted-foreground">
              {taxRatePercent}%
            </span>
          </div>
        </div>
      </div>

      <PaymentDateField
        value={paymentDate}
        onChange={onPaymentDateChange}
        disabled={isPending}
      >
        Ngày tiền thực về tài khoản. Dùng làm mốc tính XIRR (bỏ trống thì tính
        theo ngày chia). Không ảnh hưởng giá điều chỉnh — mốc đó vẫn luôn bám
        ngày chia.
      </PaymentDateField>

      <PreviewBreakdownCard
        icon={Calculator}
        iconClassName="text-primary"
        title="Tự tính số tiền nhận về"
        rows={[
          {
            label: "Cổ tức gộp",
            sublabel: `· ${formatQuantity(holding.quantity, holding.unit)} × ${
              pricePerShare ? formatMoney(pricePerShare.toString()) : "—"
            }`,
            value: grossAmount ? formatMoney(grossAmount.toString()) : "—",
          },
          {
            label: "Thuế TNCN",
            sublabel: `· ${taxRatePercent}%`,
            value: taxAmount ? `−${formatMoney(taxAmount.toString())}` : "—",
            valueClassName: "text-destructive",
          },
        ]}
        footer={{
          label: "Thực nhận (net)",
          value: netAmount ? formatMoney(netAmount.toString()) : "—",
          bgClassName: "bg-gain/7",
          textClassName: "text-gain",
        }}
      />

      {children}

      <InfoNote
        icon={TrendingUp}
        iconClassName="text-gain"
        containerClassName="border-gain/22 bg-gain/7 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      >
        Net{" "}
        <span className="text-foreground-soft">
          {netAmount
            ? formatMoney(netAmount.toString(), { compact: true })
            : "—"}
        </span>{" "}
        ghi làm <span className="text-foreground-soft">dòng tiền dương</span>{" "}
        trong chuỗi XIRR — số minh hoạ, Server Action sẽ tính lại.
      </InfoNote>
    </>
  );
}

export { CashDividendFields };
export type { CashDividendFieldsProps };
