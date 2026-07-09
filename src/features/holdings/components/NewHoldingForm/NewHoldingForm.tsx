"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/Alert";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { AssetType } from "@/components/AssetTypeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createHolding } from "../../actions";

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedSymbol?: string;
} | null;

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "STOCK", label: "Cổ phiếu" },
  { value: "FUND", label: "Quỹ mở" },
  { value: "BOND", label: "Trái phiếu" },
  { value: "GOLD", label: "Vàng" },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function NewHoldingForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [assetType, setAssetType] = useState<AssetType>("STOCK");

  async function submitNewHolding(
    _prevState: FormState,
    formData: FormData,
  ): Promise<FormState> {
    const intent = formData.get("intent");
    const symbol = String(formData.get("symbol") ?? "");

    const result = await createHolding({
      symbol,
      type: formData.get("type"),
      unit: formData.get("unit"),
      name: formData.get("name") || undefined,
      cashflowType: "BUY",
      date: formData.get("date"),
      quantity: formData.get("quantity"),
      pricePerUnit: formData.get("pricePerUnit"),
      feeAmount: formData.get("feeAmount"),
      taxAmount: formData.get("taxAmount"),
      note: formData.get("note") || undefined,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    if (intent === "save-and-add-another") {
      formRef.current?.reset();
      return { ok: true, savedSymbol: symbol };
    }

    router.push(`/holdings/${result.data.holdingId}`);
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(submitNewHolding, null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Mã
          </label>
          <Input
            type="text"
            name="symbol"
            placeholder="VD: FPT"
            required
            disabled={isPending}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Đơn vị
          </label>
          <Input
            type="text"
            name="unit"
            placeholder="cổ phần / chỉ / lượng..."
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Loại tài sản
        </label>
        <input type="hidden" name="type" value={assetType} />
        <SegmentedControl
          options={ASSET_TYPE_OPTIONS}
          value={assetType}
          onChange={setAssetType}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Tên (tuỳ chọn)
        </label>
        <Input type="text" name="name" disabled={isPending} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Ngày mua
        </label>
        <Input
          type="date"
          name="date"
          defaultValue={todayInputValue()}
          required
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Số lượng đang giữ
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="quantity"
            placeholder="0"
            required
            disabled={isPending}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Giá vốn / đơn vị
          </label>
          <Input
            type="text"
            inputMode="decimal"
            name="pricePerUnit"
            placeholder="0"
            required
            disabled={isPending}
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
            defaultValue="0"
            disabled={isPending}
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
            defaultValue="0"
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Ghi chú (tuỳ chọn)
        </label>
        <Input type="text" name="note" disabled={isPending} />
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          name="intent"
          value="save"
          disabled={isPending}
          className="flex-1"
        >
          Lưu
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save-and-add-another"
          variant="outline"
          disabled={isPending}
          className="flex-1"
        >
          Lưu & thêm mã khác
        </Button>
      </div>

      {state && !state.ok ? (
        <Alert variant="error" title={state.error ?? "Không lưu được"} />
      ) : null}
      {state?.ok && state.savedSymbol ? (
        <Alert
          variant="info"
          title={`Đã lưu ${state.savedSymbol}`}
          description="Nhập tiếp mã khác bên dưới."
        />
      ) : null}
    </form>
  );
}

export { NewHoldingForm };
