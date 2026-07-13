"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/Alert";
import type { AssetType } from "@/components/AssetTypeBadge";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

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

// Đơn vị theo loại tài sản — đổi loại thì tự chọn đơn vị đầu tiên của loại đó.
// DB không ràng buộc (Holding.unit là String tự do), đây chỉ là gợi ý ở tầng UI.
const UNIT_OPTIONS: Record<AssetType, string[]> = {
  STOCK: ["cổ phần"],
  FUND: ["CCQ"],
  BOND: ["trái phiếu"],
  GOLD: ["chỉ", "lượng"],
};

function defaultUnit(assetType: AssetType): string {
  return UNIT_OPTIONS[assetType][0] ?? "";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

type AssetTypeTilesProps = {
  value: AssetType;
  onChange: (value: AssetType) => void;
  disabled?: boolean;
};

// Lưới 4 ô chọn loại tài sản (mockup 2c) — khác SegmentedControl (thanh trượt).
function AssetTypeTiles({ value, onChange, disabled }: AssetTypeTilesProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ASSET_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors",
            option.value === value
              ? "border-primary/40 bg-primary/14 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground-soft",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 text-[11.5px] text-muted-faint">{children}</div>
  );
}

function toAmount(quantity: string, pricePerUnit: string): number {
  const q = Number(quantity);
  const p = Number(pricePerUnit);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return 0;
  return q * p;
}

function NewHoldingForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [assetType, setAssetType] = useState<AssetType>("STOCK");
  const [unit, setUnit] = useState(defaultUnit("STOCK"));
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");

  function changeAssetType(next: AssetType) {
    setAssetType(next);
    setUnit(defaultUnit(next));
  }

  async function submitNewHolding(
    _prevState: FormState,
    formData: FormData,
  ): Promise<FormState> {
    const intent = formData.get("intent");
    const symbol = String(formData.get("symbol") ?? "");

    // Phí/thuế không nhập ở màn khai báo vị thế ban đầu (mockup 2c) —
    // giá vốn bình quân người dùng nhập đã bao gồm; schema default "0".
    const result = await createHolding({
      symbol,
      type: formData.get("type"),
      unit: formData.get("unit"),
      name: formData.get("name") || undefined,
      cashflowType: "BUY",
      date: formData.get("date"),
      quantity: formData.get("quantity"),
      pricePerUnit: formData.get("pricePerUnit"),
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
      setQuantity("");
      setPricePerUnit("");
      return { ok: true, savedSymbol: symbol };
    }

    router.push(ROUTES.holdingDetail(result.data.holdingId));
    return { ok: true };
  }

  const [state, formAction, isPending] = useActionState(submitNewHolding, null);
  const initialAmount = toAmount(quantity, pricePerUnit);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4.5">
      <div>
        <FieldLabel>Loại tài sản</FieldLabel>
        <input type="hidden" name="type" value={assetType} />
        <AssetTypeTiles
          value={assetType}
          onChange={changeAssetType}
          disabled={isPending}
        />
      </div>

      <div>
        <FieldLabel>Mã</FieldLabel>
        <Input
          type="text"
          name="symbol"
          placeholder="VD: FPT"
          className="h-11 rounded-xl font-mono font-semibold"
          required
          disabled={isPending}
        />
        <FieldHint>Nhập tay tự do — chưa validate với danh sách sàn.</FieldHint>
      </div>

      <div>
        <FieldLabel>Tên (tuỳ chọn)</FieldLabel>
        <Input
          type="text"
          name="name"
          placeholder="VD: FPT Corp"
          className="h-11 rounded-xl"
          disabled={isPending}
        />
      </div>

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
            onChange={(event) => setQuantity(event.target.value)}
            required
            disabled={isPending}
          />
        </div>
        <div>
          <FieldLabel>Đơn vị</FieldLabel>
          <Select
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="h-11 rounded-xl font-semibold"
            required
            disabled={isPending}
          >
            {UNIT_OPTIONS[assetType].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel>Giá vốn bình quân / đơn vị</FieldLabel>
        <MoneyInput
          name="pricePerUnit"
          placeholder="0"
          className="h-11 rounded-xl font-mono font-semibold"
          value={pricePerUnit}
          onChange={setPricePerUnit}
          required
          disabled={isPending}
        />
      </div>

      <div>
        <FieldLabel>Ngày chốt vị thế</FieldLabel>
        <Input
          type="date"
          name="date"
          defaultValue={todayInputValue()}
          className="h-11 rounded-xl font-mono font-semibold"
          required
          disabled={isPending}
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

      <div className="flex gap-2.5 pt-1">
        <Button
          type="submit"
          name="intent"
          value="save-and-add-another"
          variant="secondary"
          disabled={isPending}
          className="h-12 flex-1 rounded-[13px] text-[13.5px] font-semibold"
        >
          Lưu & thêm mã khác
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save"
          disabled={isPending}
          className="h-12 flex-1 rounded-[13px] text-[13.5px] font-semibold"
        >
          Xong
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
