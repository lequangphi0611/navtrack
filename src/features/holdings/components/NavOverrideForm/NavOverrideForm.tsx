"use client";

import { CalendarDays, History, Info, Pencil, Zap } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import type { AssetType } from "@/components/AssetTypeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { NavOverrideFormState } from "../../types";

// docs/domain/04-pricing-and-valuation.md: STOCK/FUND định giá tự động (vẫn cho
// sửa tay), BOND/GOLD mặc định nhập tay (nguồn tự động kém ổn định/chưa hỗ trợ).
const AUTO_SUPPORTED: Record<AssetType, boolean> = {
  STOCK: true,
  FUND: true,
  BOND: false,
  GOLD: false,
};

type NavOverrideFormProps = {
  holdingId: string;
  symbol: string;
  name: string | null;
  assetType: AssetType;
  unit: string;
  // Decimal đã serialize — số lượng đang giữ, dùng tính preview NAV mới.
  quantity: string;
  totalCostBasis: string;
  lastManualPrice?: { price: string; appliedDate: string };
  // yyyy-MM-dd cho <input type="date">, mặc định hôm nay — Container tính.
  defaultDateInputValue: string;
  // Đích nút đóng (X) — Container quyết định (hiện chưa có route NavOverride
  // thật, thường trỏ về chi tiết vị thế), xem process/UI_phase_2.md.
  closeHref: string;
  action: (
    prevState: NavOverrideFormState,
    formData: FormData,
  ) => Promise<NavOverrideFormState>;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function toPreviewAmount(quantity: string, price: string): number {
  const q = Number(quantity);
  const p = Number(price);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return 0;
  return q * p;
}

// Form nhập giá tay (NavOverride) — mockup 2d. Chỉ là component, KHÔNG có route
// thật; `action` là điểm nối business-implementer wire Server Action thật
// (saveNavOverride), khớp chữ ký useActionState.
function NavOverrideForm({
  holdingId,
  symbol,
  name,
  assetType,
  unit,
  quantity,
  totalCostBasis,
  lastManualPrice,
  defaultDateInputValue,
  closeHref,
  action,
}: NavOverrideFormProps) {
  const [price, setPrice] = useState("");
  const autoSupported = AUTO_SUPPORTED[assetType];
  const [state, formAction, isPending] = useActionState(action, null);

  const previewNav = toPreviewAmount(quantity, price);
  const previewCostBasis = Number(totalCostBasis);
  const previewPnl = previewNav > 0 ? previewNav - previewCostBasis : 0;
  const previewPnlPercent =
    previewNav > 0 && previewCostBasis > 0
      ? (previewPnl / previewCostBasis) * 100
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title={`Cập nhật giá — ${name ?? symbol}`}
        backHref={closeHref}
        variant="close"
      />

      <form action={formAction} className="mt-4.5 flex flex-col gap-4.5">
        <input type="hidden" name="holdingId" value={holdingId} />

        {!autoSupported ? (
          <Alert
            variant="info"
            title="Chưa có giá tự động"
            description={`${symbol} không có giá tự động từ vnstock — nhập tay giá thị trường theo ngày để định giá.`}
          />
        ) : null}

        <div>
          <FieldLabel>Nguồn giá</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-warning/40 bg-warning/14 px-2 py-2.75 text-[12.5px] font-semibold text-warning">
              <Pencil className="size-4" />
              Nhập tay
            </div>
            <div
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2.75 text-[12.5px] font-semibold text-muted-foreground",
                !autoSupported && "opacity-55",
              )}
            >
              <Zap className="size-4" />
              Tự động
            </div>
          </div>
          {!autoSupported ? (
            <div className="mt-1.5 text-[11px] text-muted-faint">
              Tự động chưa hỗ trợ cho loại tài sản này.
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Giá / {unit}</FieldLabel>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                name="price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0"
                className="h-11 rounded-xl border-warning/35 pr-8 font-mono font-semibold"
                required
                disabled={isPending}
              />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] text-muted-faint">
                ₫
              </span>
            </div>
          </div>
          <div>
            <FieldLabel>Áp dụng từ ngày</FieldLabel>
            <div className="relative">
              <Input
                type="date"
                name="date"
                defaultValue={defaultDateInputValue}
                className="h-11 rounded-xl pr-9 font-mono font-semibold"
                required
                disabled={isPending}
              />
              <CalendarDays className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-faint" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2.5 text-xs font-semibold text-muted-foreground">
            Xem trước định giá
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[12.5px] text-muted-faint">Số lượng</span>
            <span className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
              {formatQuantity(quantity, unit)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 py-1.5">
            <span className="text-[12.5px] text-muted-faint">NAV mới</span>
            <span className="font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
              {previewNav > 0 ? formatMoney(String(previewNav)) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 py-1.5">
            <span className="text-[12.5px] text-muted-faint">
              Lãi/lỗ so với vốn
            </span>
            <span
              className={cn(
                "font-mono text-[13.5px] font-semibold tabular-nums",
                previewPnl >= 0 ? "text-gain" : "text-destructive",
              )}
            >
              {previewNav > 0
                ? `${previewPnl >= 0 ? "+" : "−"}${formatMoney(String(Math.abs(previewPnl)))} (${previewPnl >= 0 ? "+" : "−"}${Math.abs(previewPnlPercent).toFixed(1)}%)`
                : "—"}
            </span>
          </div>
        </div>

        {lastManualPrice ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.25 py-2.75">
            <History className="size-4.25 text-muted-faint" />
            <div className="text-[11.5px] leading-relaxed text-muted-faint">
              Giá gần nhất:{" "}
              <span className="font-mono text-muted-foreground">
                {formatMoney(lastManualPrice.price)}
              </span>{" "}
              áp dụng {lastManualPrice.appliedDate}
            </div>
          </div>
        ) : null}

        {state && !state.ok ? (
          <div className="flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive/9 p-3.5">
            <Info className="mt-0.5 size-4.5 shrink-0 text-destructive" />
            <div className="text-xs text-destructive">{state.error}</div>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12.5 w-full rounded-[13px] bg-warning text-[14.5px] font-bold text-warning-foreground hover:bg-warning/85"
        >
          Lưu giá nhập tay
        </Button>
      </form>
    </div>
  );
}

export { NavOverrideForm };
export type { NavOverrideFormProps, NavOverrideFormState };
