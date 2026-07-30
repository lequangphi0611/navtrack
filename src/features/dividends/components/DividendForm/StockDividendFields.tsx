import Decimal from "decimal.js";
import { Calculator, Info, Pencil, X } from "lucide-react";
import { useEffect } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  computeStockDividend,
  isStockQuantityOverrideValid,
} from "@/features/dividends/dividend-math";
import type { DividendHolding } from "@/features/dividends/types";
import { formatQuantity } from "@/lib/format";

import { FieldLabel } from "./FieldLabel";
import { InfoNote } from "./InfoNote";
import { parseDecimalOrNull } from "./parse-decimal";
import { PaymentDateField } from "./PaymentDateField";
import { PercentInputField } from "./PercentInputField";
import { PreviewBreakdownCard } from "./PreviewBreakdownCard";
import { PreviewFormulaRow } from "./PreviewFormulaRow";

type StockDividendFieldsProps = {
  holding: DividendHolding;
  percent: string;
  onPercentChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  paymentDate: string;
  onPaymentDateChange: (value: string) => void;
  isPending: boolean;
  // Override state giữ ở DividendForm (không local ở đây) — cùng lý do
  // `percent`/`date`: giá trị KHÔNG được mất khi user chuyển tab CASH rồi
  // quay lại STOCK (hành vi gốc trước khi tách component).
  stockOverride: string;
  onStockOverrideChange: (value: string) => void;
  showOverrideInput: boolean;
  onShowOverrideInputChange: (value: boolean) => void;
  // Nút Submit (dùng chung ở DividendForm) cần biết override có hợp lệ hay
  // không — giá trị chỉ STOCK tính được, báo ngược lên qua callback (xem
  // process/DECISION.md 2026-07-28 "Tách variant component...").
  onValidityChange: (invalid: boolean) => void;
  // PriceAdjustmentCheckbox — dùng chung với CashDividendFields.
  children: React.ReactNode;
};

// Toàn bộ phần biến thiên theo DividendType="STOCK" của DividendForm.
function StockDividendFields({
  holding,
  percent,
  onPercentChange,
  date,
  onDateChange,
  paymentDate,
  onPaymentDateChange,
  isPending,
  stockOverride,
  onStockOverrideChange,
  showOverrideInput,
  onShowOverrideInputChange,
  onValidityChange,
  children,
}: StockDividendFieldsProps) {
  const percentDecimal = parseDecimalOrNull(percent);
  const quantity = new Decimal(holding.quantity);

  // Preview STOCK — dùng chung dividend-math.ts với Server Action (tránh
  // drift giữa 2 nơi tính công thức), stockQuantity đã floor (cổ phiếu không
  // chia lẻ). rawStockQuantity là mốc so sánh tolerance cho override.
  const stockDividend = percentDecimal
    ? computeStockDividend({ percent: percentDecimal, quantity })
    : null;

  const overrideDecimal = parseDecimalOrNull(stockOverride);
  // User đã bật ô chỉnh sửa VÀ gõ được một số hợp lệ -> ưu tiên hiển thị số đó
  // (kể cả khi lệch quá tolerance — disable submit lo phần chặn, không chặn preview).
  const overrideActive = showOverrideInput && overrideDecimal !== null;
  const overrideInvalid =
    overrideDecimal !== null &&
    stockDividend !== null &&
    !isStockQuantityOverrideValid(
      overrideDecimal,
      stockDividend.rawStockQuantity,
    );
  const addedQuantity = overrideActive
    ? overrideDecimal
    : (stockDividend?.stockQuantity ?? null);
  const afterQuantity = addedQuantity ? quantity.plus(addedQuantity) : null;

  useEffect(() => {
    onValidityChange(overrideInvalid);
  }, [overrideInvalid, onValidityChange]);

  return (
    <>
      <PercentInputField
        label="Tỷ lệ cổ tức cổ phiếu (%)"
        value={percent}
        onChange={onPercentChange}
        disabled={isPending}
      >
        <PreviewFormulaRow>
          <span>
            {percent || "0"}% × {formatQuantity(holding.quantity, holding.unit)}{" "}
            ={" "}
            <span className="text-primary">
              {addedQuantity
                ? formatQuantity(addedQuantity.toString(), holding.unit)
                : "—"}
            </span>{" "}
            thưởng
          </span>
        </PreviewFormulaRow>

        <div className="mt-1.5 flex flex-col gap-1.5">
          {stockDividend?.wasRounded && !overrideActive ? (
            <div className="flex items-start gap-1.5 font-mono text-[11px] text-muted-faint">
              <Info className="mt-0.5 size-3.25 shrink-0" />
              <span>
                Đã làm tròn xuống từ{" "}
                {formatQuantity(
                  stockDividend.rawStockQuantity.toString(),
                  holding.unit,
                )}{" "}
                →{" "}
                {formatQuantity(
                  stockDividend.stockQuantity.toString(),
                  holding.unit,
                )}{" "}
                · cổ phiếu không chia lẻ
              </span>
            </div>
          ) : null}

          {showOverrideInput ? (
            <button
              type="button"
              onClick={() => {
                onShowOverrideInputChange(false);
                onStockOverrideChange("");
              }}
              className="flex w-fit items-center gap-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              Bỏ chỉnh sửa, dùng số hệ thống tính
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onShowOverrideInputChange(true)}
              className="flex w-fit items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline"
            >
              <Pencil className="size-3" />
              Sửa số lượng nếu công ty làm tròn khác
            </button>
          )}

          {showOverrideInput ? (
            <div className="mt-0.5">
              <FieldLabel>
                Số lượng thực nhận (theo thông báo công ty)
              </FieldLabel>
              <Input
                type="text"
                inputMode="decimal"
                name="stockQuantityOverride"
                value={stockOverride}
                onChange={(event) => onStockOverrideChange(event.target.value)}
                placeholder={
                  stockDividend ? stockDividend.stockQuantity.toString() : "0"
                }
                className="h-11 rounded-xl font-mono font-semibold"
                disabled={isPending}
              />
              {overrideInvalid && stockDividend ? (
                <p className="mt-1.5 text-[11.5px] text-destructive">
                  Chỉ được lệch tối đa 2 đơn vị so với số tính từ % (
                  {formatQuantity(
                    stockDividend.rawStockQuantity.toString(),
                    holding.unit,
                  )}
                  )
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </PercentInputField>

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

      <PaymentDateField
        value={paymentDate}
        onChange={onPaymentDateChange}
        disabled={isPending}
      >
        Ngày {holding.unit} thực về tài khoản. Không dùng để tính XIRR hay giá
        điều chỉnh — mọi tính toán bám ngày chia.
      </PaymentDateField>

      <PreviewBreakdownCard
        icon={Calculator}
        iconClassName="text-accent"
        title="Số lượng nắm giữ thay đổi"
        rows={[
          {
            label: "Đang nắm giữ",
            value: formatQuantity(holding.quantity, holding.unit),
          },
          {
            label: "CP thưởng",
            sublabel: `· ${formatQuantity(holding.quantity, holding.unit)} × ${percent || "0"}%`,
            value: addedQuantity
              ? `+${formatQuantity(addedQuantity.toString(), holding.unit)}`
              : "—",
            valueClassName: "text-accent",
          },
        ]}
        footer={{
          label: "Sau khi ghi",
          value: afterQuantity
            ? formatQuantity(afterQuantity.toString(), holding.unit)
            : "—",
          bgClassName: "bg-accent/8",
          textClassName: "text-accent",
        }}
      />

      {children}

      <InfoNote
        icon={Info}
        iconClassName="text-muted-faint"
        containerClassName="border-border bg-card"
      >
        Cổ tức cổ phiếu{" "}
        <span className="text-foreground-soft">không phát sinh dòng tiền</span>{" "}
        → không vào XIRR. Giá vốn/{holding.unit} giữ nguyên, số lượng{" "}
        {holding.unit} tăng thêm tương ứng.
      </InfoNote>
    </>
  );
}

export { StockDividendFields };
export type { StockDividendFieldsProps };
