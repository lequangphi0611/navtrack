"use client";

import Decimal from "decimal.js";
import {
  CalendarCheck,
  Calculator,
  Check,
  Diff,
  Gavel,
  Info,
  ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { formatMoney, formatQuantity } from "@/lib/format";
import { holdingDetailAfterTransaction } from "@/lib/routes";

import { settleMaturity } from "../../actions";
import {
  computeMaturitySettlementPreview,
  toDecimalOrZero,
} from "./maturity-settlement";

type MaturitySettlementHolding = {
  id: string;
  symbol: string;
  quantity: string; // toàn bộ đang giữ — prefill số lượng tất toán
  unit: string;
  avgCost: string; // giá vốn bình quân mỗi trái phiếu (gồm phí mua)
};

type MaturitySettlementFormProps = {
  holding: MaturitySettlementHolding;
  parValue: string; // mệnh giá — prefill "giá mỗi trái phiếu"
  maturityDateLabel: string; // "15/01/2029" cho banner
  defaultDateInputValue: string; // yyyy-MM-dd = ngày đáo hạn
  interestTaxRatePercent: string; // "5" (CORPORATE) | "0" (GOVERNMENT)
  closeHref: string;
};

type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

// Màn "Tất toán đáo hạn" (mockup Phase 7 Screens 7e mua đúng mệnh giá / 7f mua
// chiết khấu). MỌI field đều prefill sẵn và sửa được — giữ đúng ngôn ngữ "tự
// điền · sửa được" đã dùng ở màn ghi lệnh bán (Phase 5), vì ngày tiền thực về
// và số tiền tổ chức phát hành trả có thể lệch hợp đồng.
//
// Không nhận cờ boolean "mua chiết khấu" từ ngoài: biến thể par/discount suy
// thẳng từ so sánh giá vốn với giá nhận về, nên đổi số lượng/giá là UI tự đúng
// theo, không cần caller tính hộ rồi truyền vào (dễ lệch).
function MaturitySettlementForm({
  holding,
  parValue,
  maturityDateLabel,
  defaultDateInputValue,
  interestTaxRatePercent,
  closeHref,
}: MaturitySettlementFormProps) {
  const router = useRouter();

  // Gọi thẳng Server Action từ component (cùng pattern TransactionForm) thay vì
  // nhận `action` qua prop: form này chỉ có đúng MỘT hành động, và bridge
  // FormData -> payload là phần của chính form, không phải của route.
  async function submitSettlement(
    _prevState: FormState,
    formData: FormData,
  ): Promise<FormState> {
    const result = await settleMaturity({
      holdingId: holding.id,
      date: formData.get("date"),
      quantity: formData.get("quantity"),
      pricePerUnit: formData.get("pricePerUnit"),
      taxAmount: formData.get("taxAmount") || undefined,
      note: formData.get("note") || undefined,
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

  const [state, formAction, isPending] = useActionState(submitSettlement, null);

  const [date, setDate] = useState(defaultDateInputValue);
  const [quantity, setQuantity] = useState(holding.quantity);
  const [pricePerUnit, setPricePerUnit] = useState(parValue);
  // Thuế sửa tay được (tổ chức phát hành có thể đã khấu trừ khác) — giữ ở đây
  // để breakdown "Thực nhận" phản ánh đúng số user vừa sửa.
  const [manualTaxAmount, setManualTaxAmount] = useState<string | null>(null);

  const preview = computeMaturitySettlementPreview({
    quantity,
    pricePerUnit,
    avgCost: holding.avgCost,
    interestTaxRatePercent,
  });
  const effectiveTaxAmount = manualTaxAmount ?? preview.taxAmount;
  // Tiền luôn tính bằng Decimal, không float (docs/rules — "Tiền luôn Decimal").
  const netProceeds = new Decimal(preview.grossProceeds)
    .minus(toDecimalOrZero(effectiveTaxAmount))
    .toString();
  const isAtPar = !preview.hasTaxableInterest;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Tất toán đáo hạn"
        subtitle={`${holding.symbol} · nhận lại gốc từ tổ chức phát hành`}
        backHref={closeHref}
        variant="close"
      />

      <form action={formAction} className="flex flex-col gap-4.5">
        <input type="hidden" name="holdingId" value={holding.id} />

        <div className="flex gap-2.5 rounded-2xl border border-asset-bond/42 bg-linear-to-br from-asset-bond/18 to-card p-3.5">
          <CalendarCheck className="mt-px size-4.75 shrink-0 text-asset-bond" />
          <div>
            <div className="text-[12.5px] font-bold text-foreground">
              Đã tới ngày đáo hạn {maturityDateLabel}
            </div>
            <div className="mt-0.75 text-[11px] leading-relaxed text-muted-foreground">
              Mọi ô dưới đây{" "}
              <span className="text-foreground-soft">đã điền sẵn</span> theo hợp
              đồng và số đang giữ — sửa được nếu thực tế khác.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_8.25rem] gap-2.5">
          <div>
            <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
              Ngày tất toán
            </label>
            <DatePicker
              name="date"
              value={date}
              onChange={setDate}
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label
              htmlFor="maturityQuantity"
              className="mb-2 block text-[12.5px] font-semibold text-muted-foreground"
            >
              Số lượng
            </label>
            <div className="relative">
              <Input
                id="maturityQuantity"
                type="text"
                inputMode="decimal"
                name="quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-11 rounded-xl pr-16 font-mono text-[15px] font-semibold"
                required
                disabled={isPending}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[10.5px] text-muted-faint">
                / {formatQuantity(holding.quantity, holding.unit)}
              </span>
            </div>
          </div>
        </div>
        <div className="-mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-faint">
          <Info className="mt-0.5 size-3.25 shrink-0" />
          <span>
            Mặc định tất toán{" "}
            <span className="text-muted-foreground">toàn bộ</span> số đang giữ ·
            vị thế sẽ chuyển sang tab Đã đóng.
          </span>
        </div>

        <div>
          <label
            htmlFor="maturityPricePerUnit"
            className="mb-2 block text-[12.5px] font-semibold text-muted-foreground"
          >
            Giá mỗi trái phiếu{" "}
            <span className="font-normal text-muted-faint">· tiền nhận về</span>
          </label>
          <div className="relative">
            <Input
              id="maturityPricePerUnit"
              type="text"
              inputMode="numeric"
              name="pricePerUnit"
              value={pricePerUnit}
              onChange={(event) => setPricePerUnit(event.target.value)}
              className="h-15 rounded-2xl border-primary/40 pr-28 font-mono text-[24px] font-semibold"
              required
              disabled={isPending}
            />
            {pricePerUnit === parValue ? (
              <Badge className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[9px] tracking-wide">
                = MỆNH GIÁ
              </Badge>
            ) : null}
          </div>
        </div>

        {/* 7f — khối giải thích ĐỨNG TRƯỚC thẻ thuế: mockup coi đây là màn quan
            trọng nhất về mặt truyền đạt, người dùng phải hiểu vì sao có thuế
            trước khi nhìn thấy con số bị trừ. */}
        {preview.hasTaxableInterest ? (
          <div className="overflow-hidden rounded-2xl border border-warning/32 bg-linear-to-br from-warning/9 to-card">
            <div className="flex items-center gap-1.75 border-b border-white/6 px-3.75 py-2.75">
              <Diff className="size-4 text-warning" />
              <span className="text-xs font-bold text-warning">
                Vì sao lần này có thuế
              </span>
            </div>
            <div className="flex items-center justify-between px-3.75 py-2.75">
              <span className="text-[12.5px] text-muted-foreground">
                Giá vốn mỗi trái phiếu
              </span>
              <span className="font-mono text-[13.5px] font-semibold text-foreground">
                {formatMoney(holding.avgCost)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
              <span className="text-[12.5px] text-muted-foreground">
                Nhận về theo mệnh giá
              </span>
              <span className="font-mono text-[13.5px] font-semibold text-foreground">
                {formatMoney(pricePerUnit || "0")}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/6 bg-warning/8 px-3.75 py-3">
              <span className="text-[12.5px] font-semibold text-warning">
                Chênh lệch = lãi{" "}
                <span className="text-[11px] font-normal text-muted-faint">
                  · mỗi {holding.unit}
                </span>
              </span>
              <span className="font-mono text-[15px] font-bold text-warning">
                {formatMoney(preview.interestPerUnit)}
              </span>
            </div>
            <div className="flex gap-2.25 border-t border-white/5 px-3.75 py-2.75">
              <Gavel className="mt-0.5 size-3.75 shrink-0 text-muted-faint" />
              <span className="text-[10.5px] leading-relaxed text-muted-faint">
                Mua chiết khấu → phần chênh giữa giá mua và mệnh giá được coi là{" "}
                <span className="text-muted-foreground">lãi trái phiếu</span>,
                chịu{" "}
                <span className="text-muted-foreground">
                  thuế {interestTaxRatePercent}%
                </span>
                . Đây <span className="text-muted-foreground">không phải</span>{" "}
                thuế chuyển nhượng 0,1% — đáo hạn vẫn không bị áp thuế bán.
              </span>
            </div>
          </div>
        ) : null}

        <AutoFilledAmountCard
          icon={ReceiptText}
          label={isAtPar ? "Thuế" : "Thuế lợi tức"}
          fieldName="taxAmount"
          computedAmount={preview.taxAmount}
          formulaLabel={
            isAtPar
              ? undefined
              : `${formatQuantity(quantity || "0", holding.unit)} × ${formatMoney(preview.interestPerUnit)} × ${interestTaxRatePercent}%`
          }
          reasonBadge={
            isAtPar ? (
              <Badge variant="neutral" className="text-[10px]">
                <Gavel />
                Không phải chuyển nhượng
              </Badge>
            ) : null
          }
          note={
            isAtPar
              ? "Đáo hạn là tổ chức phát hành trả lại gốc, không phải chuyển nhượng nên không chịu thuế bán 0,1%. Mua đúng mệnh giá nên cũng không phát sinh lãi chịu thuế."
              : undefined
          }
          onValueChange={setManualTaxAmount}
          emphasized={!isAtPar}
          disabled={isPending}
        />

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
            <Calculator className="size-3.75 text-primary" />
            Tiền nhận về
          </div>
          <div className="flex items-center justify-between px-3.75 py-2.75">
            <span className="text-[13px] text-muted-foreground">
              Gốc theo mệnh giá{" "}
              <span className="text-[11px] text-muted-faint">
                · {formatQuantity(quantity || "0", holding.unit)} ×{" "}
                {formatMoney(pricePerUnit || "0", { compact: true })}
              </span>
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatMoney(preview.grossProceeds)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
            <span className="text-[13px] text-muted-foreground">
              Lợi tức chịu thuế
            </span>
            <span
              className={
                preview.hasTaxableInterest
                  ? "font-mono text-sm font-semibold text-warning"
                  : "font-mono text-sm font-semibold text-muted-foreground"
              }
            >
              {formatMoney(preview.taxableInterest)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
            <span className="text-[13px] text-muted-foreground">
              {isAtPar ? "Thuế" : "Thuế lợi tức"}{" "}
              {isAtPar ? null : (
                <span className="text-[11px] text-muted-faint">
                  · {interestTaxRatePercent}%
                </span>
              )}
            </span>
            <span
              className={
                isAtPar
                  ? "font-mono text-sm font-semibold text-muted-foreground"
                  : "font-mono text-sm font-semibold text-destructive"
              }
            >
              {isAtPar ? "" : "−"}
              {formatMoney(effectiveTaxAmount)}
            </span>
          </div>
          {/* Dòng này KHÔNG phải trang trí: người dùng quen bán cổ phiếu sẽ đi
              tìm thuế 0,1% và tưởng app quên — nói thẳng là không áp dụng. */}
          <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
            <span className="text-[13px] text-muted-foreground">
              Thuế chuyển nhượng 0,1%
            </span>
            <span className="font-mono text-[13.5px] font-semibold text-muted-faint">
              không áp dụng
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/7 bg-gain/7 px-3.75 py-3.25">
            <span className="text-[13.5px] font-semibold text-gain">
              Thực nhận
            </span>
            <span className="font-mono text-lg font-bold text-gain">
              {formatMoney(netProceeds)}
            </span>
          </div>
        </div>

        {state && !state.ok ? (
          <Alert
            variant="error"
            title="Không ghi được tất toán"
            description={state.error ?? "Thử lại sau ít phút."}
          />
        ) : null}

        <Button
          type="submit"
          disabled={isPending || quantity === "" || pricePerUnit === ""}
          className="h-13 w-full gap-2 rounded-2xl bg-asset-bond text-[14.5px] font-bold text-primary-foreground hover:bg-asset-bond/85"
        >
          <Check className="size-5" />
          {isPending ? "Đang ghi…" : "Ghi tất toán"}
        </Button>
      </form>
    </div>
  );
}

export { MaturitySettlementForm };
export type { MaturitySettlementFormProps, MaturitySettlementHolding };
