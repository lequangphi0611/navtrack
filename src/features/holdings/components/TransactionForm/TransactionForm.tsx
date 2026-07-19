"use client";

import Decimal from "decimal.js";
import { Info, Percent, ReceiptText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import type { AssetType } from "@/components/AssetTypeBadge";
import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/format";
import { holdingDetailAfterTransaction } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { addTransaction, updateTransaction } from "../../actions";
import { SellRecomputeCompareCard } from "../SellRecomputeCompareCard";
import type { CashflowRow, TransactionSettingRows } from "../../types";
import {
  computeAutoFieldPreview,
  feeKeyLabel,
  resolveComputedAmount,
  resolveFormulaLabel,
  saleTaxKeyLabel,
  type AutoFieldPreview,
} from "./TransactionForm.utils";

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

// Thông tin vị thế hiển thị trên form (mockup 2e) — Decimal đã serialize thành string.
// `type` thêm ở Phase 5 (process/phase-5-plan-DRAFT.md mục B2) — đã có sẵn trên
// HoldingDetail thật (getHoldingDetail()), chỉ cần nới type khai báo ở đây.
type TransactionFormHolding = {
  symbol: string;
  name: string | null;
  quantity: string;
  unit: string;
  type: AssetType;
};

// settingRows (process/phase-5-plan-DRAFT.md mục A3/A6): 3 nhóm dòng Setting
// (thuế bán + phí mua/bán) cho form tự tính preview taxAmount/feeAmount tại
// ngày đang chọn.
type TransactionFormProps =
  | {
      mode: "create";
      holdingId: string;
      holding: TransactionFormHolding;
      settingRows: TransactionSettingRows;
    }
  | {
      mode: "edit";
      holdingId: string;
      holding: TransactionFormHolding;
      cashflow: CashflowRow;
      settingRows: TransactionSettingRows;
    };

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function toAmount(quantity: string, pricePerUnit: string): number {
  const q = Number(quantity);
  const p = Number(pricePerUnit);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return 0;
  return q * p;
}

// Decimal (KHÁC toAmount ở trên vốn dùng number cho info box "Thành tiền =" cũ) —
// cần chính xác tuyệt đối vì dùng làm cơ sở nhân với % thuế/phí.
function toGrossValueDecimal(
  quantity: string,
  pricePerUnit: string,
): Decimal | null {
  try {
    const q = new Decimal(quantity);
    const p = new Decimal(pricePerUnit);
    if (!q.isFinite() || !p.isFinite() || q.lte(0) || p.lte(0)) return null;
    return q.mul(p);
  } catch {
    return null;
  }
}

// Khối "Thuế bán · tính lại" + "Phí giao dịch · tính lại" khi sửa ngày một
// SELL đã ghi (mockup 5f, process/phase-5-plan-DRAFT.md mục B2). Tách khỏi
// component chính cùng lý do FieldLabel ở trên — helper hiển thị nội bộ, chưa
// cần thư mục riêng (không export ra ngoài file này).
function SellTaxFeeRecompute({
  cashflow,
  settingRows,
  holdingType,
  originalDate,
  date,
  taxPreview,
  feePreview,
  disabled,
}: {
  cashflow: CashflowRow;
  settingRows: TransactionSettingRows;
  holdingType: AssetType;
  originalDate: string;
  date: string;
  taxPreview: AutoFieldPreview | null;
  feePreview: AutoFieldPreview | null;
  disabled: boolean;
}) {
  const originalDateObj = new Date(originalDate);
  const oldGrossValue = new Decimal(cashflow.quantity).mul(
    cashflow.pricePerUnit,
  );
  const oldTaxPreview = computeAutoFieldPreview(
    settingRows.saleTaxRows,
    originalDateObj,
    oldGrossValue,
  );
  const oldFeePreview = computeAutoFieldPreview(
    settingRows.feeSellRows,
    originalDateObj,
    oldGrossValue,
  );

  return (
    <>
      <div className="flex gap-2.5 rounded-xl border border-primary/28 bg-primary/8 p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <RefreshCw className="mt-0.5 size-4.5 shrink-0 text-primary" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-primary">Bạn đổi ngày bán</span> →
          thuế &amp; phí được tính lại theo ngày mới (effective dating).
        </div>
      </div>

      <SellRecomputeCompareCard
        key={`tax-${date}`}
        icon={ReceiptText}
        label="Thuế bán · tính lại"
        fieldName="taxAmount"
        oldAmount={cashflow.taxAmount}
        oldSummaryLabel={
          oldTaxPreview
            ? `Ngày cũ ${formatDate(originalDate)} · thuế ${formatPercent(oldTaxPreview.ratePercent.toNumber())}`
            : `Ngày cũ ${formatDate(originalDate)}`
        }
        newAmount={taxPreview ? taxPreview.amount.toString() : "0"}
        newSummaryLabel={
          taxPreview
            ? `Ngày mới ${formatDate(date)} · thuế ${formatPercent(taxPreview.ratePercent.toNumber())}`
            : `Ngày mới ${formatDate(date)}`
        }
        newDetailNote={
          taxPreview
            ? `${saleTaxKeyLabel(holdingType)} áp dụng từ ${formatDate(taxPreview.effectiveFrom)}`
            : undefined
        }
        emphasized
        disabled={disabled}
      />

      <SellRecomputeCompareCard
        key={`fee-${date}`}
        icon={Percent}
        label="Phí giao dịch · tính lại"
        fieldName="feeAmount"
        oldAmount={cashflow.feeAmount}
        oldSummaryLabel={
          oldFeePreview
            ? `Ngày cũ ${formatDate(originalDate)} · biểu phí ${formatPercent(oldFeePreview.ratePercent.toNumber())}`
            : `Ngày cũ ${formatDate(originalDate)}`
        }
        newAmount={feePreview ? feePreview.amount.toString() : "0"}
        newSummaryLabel={
          feePreview
            ? `Ngày mới ${formatDate(date)} · biểu phí ${formatPercent(feePreview.ratePercent.toNumber())}`
            : `Ngày mới ${formatDate(date)}`
        }
        newDetailNote={
          feePreview
            ? `${feeKeyLabel("SELL", holdingType)} áp dụng từ ${formatDate(feePreview.effectiveFrom)}`
            : undefined
        }
        disabled={disabled}
      />
    </>
  );
}

function TransactionForm(props: TransactionFormProps) {
  const router = useRouter();
  const defaults =
    props.mode === "edit"
      ? props.cashflow
      : {
          type: "BUY" as const,
          date: new Date().toISOString(),
          quantity: "",
          pricePerUnit: "",
          feeAmount: "0",
          taxAmount: "0",
          note: "",
        };

  const [cashflowType, setCashflowType] = useState<"BUY" | "SELL">(
    defaults.type,
  );
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [pricePerUnit, setPricePerUnit] = useState(defaults.pricePerUnit);
  const [date, setDate] = useState(toDateInputValue(defaults.date));
  const isBuy = cashflowType === "BUY";

  async function submitTransaction(
    _prevState: FormState,
    formData: FormData,
  ): Promise<FormState> {
    const payload = {
      cashflowType: formData.get("cashflowType"),
      date: formData.get("date"),
      quantity: formData.get("quantity"),
      pricePerUnit: formData.get("pricePerUnit"),
      feeAmount: formData.get("feeAmount"),
      taxAmount: formData.get("taxAmount"),
      note: formData.get("note") || undefined,
    };

    const result =
      props.mode === "create"
        ? await addTransaction({ ...payload, holdingId: props.holdingId })
        : await updateTransaction({
            ...payload,
            cashflowId: props.cashflow.id,
          });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    router.push(
      holdingDetailAfterTransaction(
        result.data.holdingId,
        result.data.cashflowId,
      ),
    );
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(
    submitTransaction,
    null,
  );
  const amount = toAmount(quantity, pricePerUnit);
  const submitLabel =
    props.mode === "edit"
      ? "Cập nhật giao dịch"
      : isBuy
        ? "Ghi nhận giao dịch mua"
        : "Ghi nhận giao dịch bán";

  // Thuế/phí tự tính (process/phase-5-plan-DRAFT.md mục B2) — recompute mỗi
  // render từ quantity/pricePerUnit/date/cashflowType hiện tại (không cần
  // effect: computedAmount chỉ là input của AutoFilledAmountCard, chính card
  // đó tự "đóng băng" một khi user sửa tay, xem AutoFilledAmountCard).
  const grossValue = toGrossValueDecimal(quantity, pricePerUnit);
  const dateObj = new Date(date);

  const taxPreview =
    !isBuy && grossValue
      ? computeAutoFieldPreview(
          props.settingRows.saleTaxRows,
          dateObj,
          grossValue,
        )
      : null;
  const feePreview = grossValue
    ? computeAutoFieldPreview(
        isBuy ? props.settingRows.feeBuyRows : props.settingRows.feeSellRows,
        dateObj,
        grossValue,
      )
    : null;

  // Ca sửa SELL đã ghi (mockup 5f): originalDate CỐ ĐỊNH theo cashflow gốc
  // (không đổi theo mỗi lần gõ) — đổi ngày khỏi mốc này mới kích hoạt card so
  // sánh cũ/mới cho cả thuế lẫn phí.
  const editCashflow = props.mode === "edit" ? props.cashflow : null;
  const originalDate = editCashflow
    ? toDateInputValue(editCashflow.date)
    : null;
  const isSellEditWithDateChanged =
    cashflowType === "SELL" && originalDate !== null && date !== originalDate;

  // true khi CHƯA field nào trong 4 field ảnh hưởng thuế/phí bị đổi so với
  // cashflow gốc (chỉ có ý nghĩa ở chế độ edit) — xem resolveComputedAmount.
  const editUnchanged =
    editCashflow !== null &&
    originalDate !== null &&
    editCashflow.quantity === quantity &&
    editCashflow.pricePerUnit === pricePerUnit &&
    originalDate === date &&
    editCashflow.type === cashflowType;

  const taxComputedAmount = resolveComputedAmount(
    editCashflow,
    editUnchanged,
    "taxAmount",
    taxPreview,
  );
  const feeComputedAmount = resolveComputedAmount(
    editCashflow,
    editUnchanged,
    "feeAmount",
    feePreview,
  );

  const taxFormulaLabel = resolveFormulaLabel(
    editUnchanged,
    grossValue,
    taxPreview,
    saleTaxKeyLabel(props.holding.type),
    "Nhập đủ số lượng & giá bán để tính thuế",
    `Thiếu cấu hình ${saleTaxKeyLabel(props.holding.type)} cho ngày này — nhập tay số thuế.`,
  );

  const feeFormulaLabel = resolveFormulaLabel(
    editUnchanged,
    grossValue,
    feePreview,
    feeKeyLabel(isBuy ? "BUY" : "SELL", props.holding.type),
    "Nhập đủ số lượng & giá để tính phí",
    `Thiếu cấu hình ${feeKeyLabel(isBuy ? "BUY" : "SELL", props.holding.type)} cho ngày này — nhập tay số phí.`,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4.5">
      <input type="hidden" name="cashflowType" value={cashflowType} />

      <SegmentedControl
        options={[
          {
            value: "BUY",
            label: "Mua",
            activeClassName: "text-primary-foreground",
          },
          {
            value: "SELL",
            label: "Bán",
            activeClassName: "text-primary-foreground",
          },
        ]}
        value={cashflowType}
        onChange={setCashflowType}
        stretch
        thumbClassName={isBuy ? "bg-gain" : "bg-destructive"}
        className="rounded-xl bg-card p-1 font-bold"
      />

      <div>
        <FieldLabel>Vị thế</FieldLabel>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
          <SymbolAvatar symbol={props.holding.symbol} size="sm" />
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {props.holding.name ?? props.holding.symbol}{" "}
            <span className="text-xs font-medium text-muted-faint">
              · {formatQuantity(props.holding.quantity, props.holding.unit)}{" "}
              đang giữ
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Số lượng</FieldLabel>
          <Input
            type="text"
            inputMode="decimal"
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0"
            className="h-11 rounded-xl font-mono font-semibold"
            required
            disabled={isPending}
          />
        </div>
        <div>
          <FieldLabel>Giá / đơn vị</FieldLabel>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              name="pricePerUnit"
              value={pricePerUnit}
              onChange={(event) => setPricePerUnit(event.target.value)}
              placeholder="0"
              className="h-11 rounded-xl pr-8 font-mono font-semibold"
              required
              disabled={isPending}
            />
            <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-muted-faint">
              ₫
            </span>
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Ngày giao dịch</FieldLabel>
        <DatePicker
          name="date"
          value={date}
          onChange={setDate}
          required
          disabled={isPending}
        />
      </div>

      {isSellEditWithDateChanged && editCashflow && originalDate ? (
        <SellTaxFeeRecompute
          cashflow={editCashflow}
          settingRows={props.settingRows}
          holdingType={props.holding.type}
          originalDate={originalDate}
          date={date}
          taxPreview={taxPreview}
          feePreview={feePreview}
          disabled={isPending}
        />
      ) : (
        <>
          {!isBuy ? (
            <AutoFilledAmountCard
              icon={ReceiptText}
              label="Thuế bán"
              fieldName="taxAmount"
              computedAmount={taxComputedAmount}
              formulaLabel={taxFormulaLabel}
              emphasized
              disabled={isPending}
            />
          ) : (
            <input type="hidden" name="taxAmount" value="0" />
          )}

          <AutoFilledAmountCard
            icon={Percent}
            label="Phí giao dịch"
            fieldName="feeAmount"
            computedAmount={feeComputedAmount}
            formulaLabel={feeFormulaLabel}
            disabled={isPending}
          />
        </>
      )}

      <div>
        <FieldLabel>Ghi chú (tuỳ chọn)</FieldLabel>
        <Input
          type="text"
          name="note"
          defaultValue={defaults.note ?? ""}
          className="h-11 rounded-xl"
          disabled={isPending}
        />
      </div>

      {amount > 0 ? (
        <div className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/8 p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
          <Info className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            Thành tiền ={" "}
            <span className="font-mono font-medium text-foreground-soft tabular-nums">
              {formatMoney(String(amount))}
            </span>
            {props.mode === "create" && isBuy
              ? ". Mã đã có sẵn — giao dịch này tự gộp vào vị thế, giá vốn bình quân sẽ tính lại."
              : null}
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className={cn(
          "h-12 w-full rounded-[13px] text-[14.5px] font-bold text-primary-foreground",
          isBuy
            ? "bg-gain hover:bg-gain/85"
            : "bg-destructive hover:bg-destructive/85",
        )}
      >
        {submitLabel}
      </Button>

      {state && !state.ok ? (
        <Alert variant="error" title={state.error ?? "Không lưu được"} />
      ) : null}
    </form>
  );
}

export { TransactionForm };
export type { TransactionFormProps, TransactionFormHolding };
