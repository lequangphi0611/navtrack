"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { MoneyInput } from "@/components/MoneyInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { addTransaction, updateTransaction } from "../../actions";
import type { CashflowRow } from "../../types";

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

// Thông tin vị thế hiển thị trên form (mockup 2e) — Decimal đã serialize thành string.
type TransactionFormHolding = {
  symbol: string;
  name: string | null;
  quantity: string;
  unit: string;
};

type TransactionFormProps =
  | { mode: "create"; holdingId: string; holding: TransactionFormHolding }
  | {
      mode: "edit";
      holdingId: string;
      holding: TransactionFormHolding;
      cashflow: CashflowRow;
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
  const [feeAmount, setFeeAmount] = useState(defaults.feeAmount);
  const [taxAmount, setTaxAmount] = useState(defaults.taxAmount);
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

    router.push(ROUTES.holdingDetail(result.data.holdingId));
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
          <MoneyInput
            name="pricePerUnit"
            value={pricePerUnit}
            onChange={setPricePerUnit}
            placeholder="0"
            className="h-11 rounded-xl font-mono font-semibold"
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Ngày giao dịch</FieldLabel>
        <Input
          type="date"
          name="date"
          defaultValue={toDateInputValue(defaults.date)}
          className="h-11 rounded-xl font-mono font-semibold"
          required
          disabled={isPending}
        />
      </div>

      {/* Mockup 2e không có phí/thuế nhưng Phase 1 quy định phí/thuế nhập tay
          per-giao-dịch (process/phase-1.md) — giữ lại, style đồng bộ. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Phí</FieldLabel>
          <MoneyInput
            name="feeAmount"
            value={feeAmount}
            onChange={setFeeAmount}
            placeholder="0"
            className="h-11 rounded-xl font-mono font-semibold"
            disabled={isPending}
          />
        </div>
        <div>
          <FieldLabel>Thuế</FieldLabel>
          <MoneyInput
            name="taxAmount"
            value={taxAmount}
            onChange={setTaxAmount}
            placeholder="0"
            className="h-11 rounded-xl font-mono font-semibold"
            disabled={isPending}
          />
        </div>
      </div>

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
