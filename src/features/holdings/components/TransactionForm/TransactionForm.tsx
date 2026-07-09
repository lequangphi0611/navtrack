"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { addTransaction, updateTransaction } from "../../actions";
import type { CashflowRow } from "../../types";

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

type TransactionFormProps =
  | { mode: "create"; holdingId: string }
  | { mode: "edit"; holdingId: string; cashflow: CashflowRow };

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
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

    router.push(`/holdings/${result.data.holdingId}`);
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(
    submitTransaction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="cashflowType" value={cashflowType} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Loại giao dịch
        </label>
        <SegmentedControl
          options={[
            { value: "BUY", label: "Mua" },
            { value: "SELL", label: "Bán" },
          ]}
          value={cashflowType}
          onChange={setCashflowType}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Ngày
        </label>
        <Input
          type="date"
          name="date"
          defaultValue={toDateInputValue(defaults.date)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Số lượng
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="quantity"
            defaultValue={defaults.quantity}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Giá / đơn vị
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="pricePerUnit"
            defaultValue={defaults.pricePerUnit}
            placeholder="0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Phí
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="feeAmount"
            defaultValue={defaults.feeAmount}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Thuế
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="taxAmount"
            defaultValue={defaults.taxAmount}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Ghi chú (tuỳ chọn)
        </label>
        <Input type="text" name="note" defaultValue={defaults.note ?? ""} />
      </div>

      <Button type="submit" disabled={isPending}>
        {props.mode === "create" ? "Lưu giao dịch" : "Cập nhật giao dịch"}
      </Button>

      {state && !state.ok ? (
        <Alert variant="error" title={state.error ?? "Không lưu được"} />
      ) : null}
    </form>
  );
}

export { TransactionForm };
export type { TransactionFormProps };
