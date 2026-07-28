"use client";

import type { DividendType } from "@prisma/client";
import {
  Check,
  CheckCircle2,
  Coins,
  History,
  Layers,
  Settings2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  HoldingSwitcher,
  type HoldingSwitcherProps,
} from "@/features/dividends/components/HoldingSwitcher";
import type {
  DividendFormState,
  DividendHolding,
  DividendRecordedResult,
} from "@/features/dividends/types";
import { assertNever } from "@/lib/assert-never";
import { dividendTypeName } from "@/lib/dividend-label";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CashDividendFields } from "./CashDividendFields";
import { parseDecimalOrNull } from "./parse-decimal";
import { PriceAdjustmentCheckbox } from "./PriceAdjustmentCheckbox";
import { StockDividendFields } from "./StockDividendFields";

type DividendFormProps = {
  holding: DividendHolding;
  // LUÔN có mặt — mockup (Phase 4 Screens 4a/4c) hiện switcher bất kể lối vào
  // (khác plan ban đầu coi switcher optional, xem process/UI_phase_4.md).
  switcher: HoldingSwitcherProps;
  // Mệnh giá/CP cho preview CASH — sample cứng "10000" ở #51, #52 đọc Setting thật.
  faceValuePerShare: string;
  // % thuế minh hoạ, READ-ONLY — sample "5", #52 đọc resolveSetting("DIVIDEND_TAX_RATE", ngày chia).
  taxRatePercent: string;
  defaultDateInputValue: string; // yyyy-MM-dd, mặc định hôm nay
  historyHref: string; // icon "history" góc phải header — lịch sử cổ tức của holding này
  closeHref: string;
  hidden?: boolean;
  action: (
    prevState: DividendFormState,
    formData: FormData,
  ) => Promise<DividendFormState>;
};

const DIVIDEND_FORM_SUBTITLE: Record<DividendType, string> = {
  CASH: "Nhập % → tự tính tiền nhận về",
  STOCK: "Cổ phiếu → tăng số lượng nắm giữ",
  BOND_COUPON: "Chưa hỗ trợ",
};

const SUBMIT_BUTTON_CLASS: Record<DividendType, string> = {
  CASH: "bg-gain text-primary-foreground hover:bg-gain/85",
  STOCK: "bg-accent text-accent-foreground hover:bg-accent/85",
  BOND_COUPON: "bg-muted text-muted-foreground",
};

// Form ghi nhận cổ tức (mockup Phase 4 Screens, 4a Tiền mặt / 4c Cổ phiếu).
// Container chỉ giữ phần THẬT SỰ dùng chung (header, switcher, checkbox điều
// chỉnh giá, nút submit, wiring Server Action) và rẽ nhánh theo `type` ĐÚNG
// MỘT LẦN để chọn variant component nào render — phần biến thiên theo loại
// (preview, field ngày, card breakdown, alert...) tự chứa trong
// CashDividendFields/StockDividendFields, không rẽ nhánh lại ở đây (trước đây
// 9 chỗ switch/IIFE trên cùng biến `type`, xem docs/rules/
// component-architecture.md mục "Biến thiên theo enum nghiệp vụ lặp lại",
// process/DECISION.md 2026-07-28). Trạng thái thành công (4d) render INLINE
// thay vì route riêng — cùng pattern SnapshotFreezeSheet.isDone/SnapshotTodayCard.
function DividendForm({
  holding,
  switcher,
  faceValuePerShare,
  taxRatePercent,
  defaultDateInputValue,
  historyHref,
  closeHref,
  hidden = false,
  action,
}: DividendFormProps) {
  const [type, setType] = useState<DividendType>("CASH");
  const [percent, setPercent] = useState("");
  const [date, setDate] = useState(defaultDateInputValue);
  // Issue #61: ngày tiền/CP thực về TK — thuần thông tin, optional (không có
  // default như `date`, để trống là hợp lệ).
  const [paymentDate, setPaymentDate] = useState("");
  // Issue #61: mặc định false (chưa tick) -> Server Action tự tạo NavOverride
  // bù pha loãng. Submit qua hidden input chuỗi "true"/"false" bên dưới
  // (cùng pattern hidden input "type"), KHÔNG submit trực tiếp checkbox thô.
  const [priceAlreadyReflectsMarket, setPriceAlreadyReflectsMarket] =
    useState(false);
  // Giữ ở container (không local trong StockDividendFields) để KHÔNG mất giá
  // trị khi user chuyển sang CASH rồi quay lại STOCK — hành vi gốc trước khi
  // tách component.
  const [stockOverride, setStockOverride] = useState("");
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  // Chỉ STOCK tính được (so lệch tolerance số làm tròn) — StockDividendFields
  // báo ngược lên qua onValidityChange. Điều kiện disabled ở nút Submit tự bỏ
  // qua giá trị cũ khi `type !== "STOCK"`, không cần reset khi đổi tab.
  const [overrideInvalid, setOverrideInvalid] = useState(false);
  const [state, formAction, isPending] = useActionState(action, null);
  const isDone = state?.ok === true;

  const percentDecimal = parseDecimalOrNull(percent);
  const subtitle = DIVIDEND_FORM_SUBTITLE[type];

  const priceAdjustmentCheckbox = (
    <PriceAdjustmentCheckbox
      checked={priceAlreadyReflectsMarket}
      onChange={setPriceAlreadyReflectsMarket}
      disabled={isPending}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Ghi cổ tức"
        subtitle={isDone ? undefined : subtitle}
        backHref={closeHref}
        variant="close"
        trailing={
          <Link
            href={historyHref}
            aria-label="Lịch sử cổ tức"
            className="flex size-8 items-center justify-center rounded-[10px] bg-white/5 transition-colors hover:bg-white/10"
          >
            <History className="size-4.25 text-foreground-soft" />
          </Link>
        }
      />

      {isDone ? (
        <DividendSuccessContent result={state.result} />
      ) : (
        <form action={formAction} className="flex flex-col gap-4.5">
          <input type="hidden" name="holdingId" value={holding.id} />
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="priceAlreadyReflectsMarket"
            value={priceAlreadyReflectsMarket ? "true" : "false"}
          />

          <HoldingSwitcher {...switcher} hidden={hidden} />

          <SegmentedControl
            options={[
              { value: "CASH", label: "Tiền mặt" },
              { value: "STOCK", label: "Cổ phiếu" },
            ]}
            value={type}
            onChange={setType}
            stretch
            className="rounded-xl bg-card p-1 font-bold"
          />

          {(() => {
            switch (type) {
              case "CASH":
                return (
                  <CashDividendFields
                    holding={holding}
                    percent={percent}
                    onPercentChange={setPercent}
                    faceValuePerShare={faceValuePerShare}
                    taxRatePercent={taxRatePercent}
                    date={date}
                    onDateChange={setDate}
                    paymentDate={paymentDate}
                    onPaymentDateChange={setPaymentDate}
                    isPending={isPending}
                  >
                    {priceAdjustmentCheckbox}
                  </CashDividendFields>
                );
              case "STOCK":
                return (
                  <StockDividendFields
                    holding={holding}
                    percent={percent}
                    onPercentChange={setPercent}
                    date={date}
                    onDateChange={setDate}
                    paymentDate={paymentDate}
                    onPaymentDateChange={setPaymentDate}
                    isPending={isPending}
                    stockOverride={stockOverride}
                    onStockOverrideChange={setStockOverride}
                    showOverrideInput={showOverrideInput}
                    onShowOverrideInputChange={setShowOverrideInput}
                    onValidityChange={setOverrideInvalid}
                  >
                    {priceAdjustmentCheckbox}
                  </StockDividendFields>
                );
              case "BOND_COUPON":
                // Placeholder — không thể chạm tới qua UI (SegmentedControl
                // chỉ CASH/STOCK). Thêm BondCouponDividendFields khi #101
                // thật sự làm UI trái tức.
                return null;
              default:
                return assertNever(type);
            }
          })()}

          {state && !state.ok ? (
            <Alert
              variant="error"
              title="Không ghi được cổ tức"
              description={state.error}
            />
          ) : null}

          <Button
            type="submit"
            disabled={
              isPending ||
              !percentDecimal ||
              percentDecimal.lte(0) ||
              (type === "STOCK" && overrideInvalid)
            }
            className={cn(
              "h-13 w-full gap-2 rounded-2xl text-[14.5px] font-bold",
              SUBMIT_BUTTON_CLASS[type],
            )}
          >
            <Check className="size-5" />
            {isPending ? "Đang ghi…" : "Ghi cổ tức"}
          </Button>
        </form>
      )}
    </div>
  );
}

// Nhãn "Cổ tức tiền mặt"/"Cổ tức cổ phiếu" theo DividendType — ghép từ
// dividendTypeName() (src/lib/dividend-label.ts, MỘT nguồn sự thật cho tên
// loại), không tự khai lại tên loại ở đây. BOND_COUPON không ghép "Cổ tức"
// (đây là trái tức, không phải cổ tức) — giữ switch exhaustive để compiler
// bắt lỗi ngay khi thêm giá trị DividendType mới.
function dividendTypeLabel(type: DividendType): string {
  switch (type) {
    case "CASH":
    case "STOCK":
      return `Cổ tức ${dividendTypeName(type).toLowerCase()}`;
    case "BOND_COUPON":
      return dividendTypeName(type);
    default:
      return assertNever(type);
  }
}

// Icon minh hoạ dòng "Tổng cổ tức đã nhận" — cùng lý do exhaustive như trên.
function DividendReceivedIcon({ type }: { type: DividendType }) {
  switch (type) {
    case "CASH":
      return <Coins className="size-4.5 shrink-0 text-accent" />;
    case "STOCK":
      return <Layers className="size-4.5 shrink-0 text-accent" />;
    case "BOND_COUPON":
      return <Coins className="size-4.5 shrink-0 text-accent" />;
    default:
      return assertNever(type);
  }
}

// Khối số liệu chính (net CASH hoặc số lượng sau nhận STOCK) — tách theo
// switch exhaustive trên result.type, giữ nguyên 100% nội dung hiển thị của
// từng nhánh cũ.
function DividendMainCard({ result }: { result: DividendRecordedResult }) {
  switch (result.type) {
    case "CASH":
      return (
        <div className="rounded-2xl border border-gain/28 bg-linear-to-br from-gain/12 to-card p-4.5 text-center">
          <div className="text-xs font-semibold text-gain">
            Thực nhận vào tài khoản
          </div>
          <div className="mt-1.25 font-mono text-[28px] font-bold tracking-tight text-gain">
            {result.netAmount ? formatMoney(result.netAmount) : "—"}
          </div>
          {result.grossAmount && result.taxAmount ? (
            <div className="mt-1.25 font-mono text-[11px] text-muted-faint">
              gộp {formatMoney(result.grossAmount)} − thuế{" "}
              {formatMoney(result.taxAmount)}
            </div>
          ) : null}
        </div>
      );
    case "STOCK":
      return (
        <div className="rounded-2xl border border-accent/28 bg-linear-to-br from-accent/12 to-card p-4.5 text-center">
          <div className="text-xs font-semibold text-accent">
            Số lượng sau khi nhận
          </div>
          <div className="mt-1.25 font-mono text-[28px] font-bold tracking-tight text-accent">
            {result.afterQuantity && result.unit
              ? formatQuantity(result.afterQuantity, result.unit)
              : "—"}
          </div>
          {result.addedQuantity && result.unit ? (
            <div className="mt-1.25 font-mono text-[11px] text-muted-faint">
              +{formatQuantity(result.addedQuantity, result.unit)} thưởng
            </div>
          ) : null}
          {result.wasRounded && result.rawAddedQuantity && result.unit ? (
            <div className="mt-0.75 font-mono text-[11px] text-muted-faint">
              Đã làm tròn xuống từ{" "}
              {formatQuantity(result.rawAddedQuantity, result.unit)}
            </div>
          ) : null}
        </div>
      );
    case "BOND_COUPON":
      // Placeholder — recordDividend() (actions.ts) trả lỗi lường trước cho
      // BOND_COUPON trước khi tới DividendFormState.ok=true, nên nhánh này
      // không thực sự render được ở UI hiện tại (issue #101 sẽ implement).
      return null;
    default:
      return assertNever(result.type);
  }
}

// Nội dung "Đã ghi cổ tức" (mockup 4d) — render inline thay vì route riêng
// (xem docstring DividendForm). Không hiển thị dòng "Snapshot MANUAL đã chốt
// tự động" của mockup — thuộc Phase 3, việc auto-snapshot khi ghi cổ tức chưa
// được xác nhận trong scope Phase 4 (xem process/UI_phase_4.md).
function DividendSuccessContent({
  result,
}: {
  result: DividendRecordedResult;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="mt-2 flex flex-col items-center gap-3.5">
        <div className="flex size-19 items-center justify-center rounded-full border border-gain/35 bg-gain/14">
          <CheckCircle2 className="size-10.5 text-gain" />
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">
            Đã ghi cổ tức {result.symbol}
          </div>
          <div className="mt-0.75 text-[12.5px] text-muted-faint">
            {dividendTypeLabel(result.type)} {result.percentLabel}% ·{" "}
            {result.dateLabel}
          </div>
          {result.paymentDateLabel ? (
            <div className="mt-0.5 text-[11px] text-muted-faint">
              Thanh toán {result.paymentDateLabel}
            </div>
          ) : null}
        </div>
      </div>

      <DividendMainCard result={result} />

      {/* Issue #61: chỉ hiện khi Server Action thực sự tự tạo/ghi đè
          NavOverride (navOverrideAdjusted=true) — không hiện gì khi user đã
          tick "giá hiện tại đã phản ánh đợt chia này". */}
      {result.navOverrideAdjusted && result.oldPrice && result.newPrice ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
            <Settings2 className="size-3.75 text-accent" />
            Giá đã tự động điều chỉnh
          </div>
          <div className="flex items-center justify-between px-3.75 py-3.25">
            <span className="text-[13px] text-muted-foreground">
              Giá tham chiếu
            </span>
            <span className="font-mono text-[13.5px] font-semibold text-foreground">
              {formatMoney(result.oldPrice)} → {formatMoney(result.newPrice)}
            </span>
          </div>
        </div>
      ) : null}

      {result.xirrBeforePercent && result.xirrAfterPercent ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
            Ảnh hưởng lên hiệu suất
          </div>
          <div className="flex items-center gap-2.5 px-3.75 py-3.25">
            <TrendingUp className="size-4.5 shrink-0 text-gain" />
            <span className="flex-1 text-[13px] text-muted-foreground">
              XIRR danh mục
            </span>
            <span className="font-mono text-[13.5px] font-semibold text-gain">
              {result.xirrBeforePercent}% → {result.xirrAfterPercent}%
            </span>
          </div>
          {result.totalDividendReceived ? (
            <div className="flex items-center gap-2.5 border-t border-white/4.5 px-3.75 py-3.25">
              <DividendReceivedIcon type={result.type} />
              <span className="flex-1 text-[13px] text-muted-foreground">
                Tổng cổ tức {result.symbol} đã nhận
              </span>
              <span className="font-mono text-[13.5px] font-semibold text-foreground">
                {formatMoney(result.totalDividendReceived, { compact: true })}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5">
        <Link
          href={result.historyHref}
          className={cn(buttonVariants(), "h-12.5 w-full gap-2 font-bold")}
        >
          <History className="size-4.5" />
          Xem lịch sử cổ tức
        </Link>
        <Link
          href={result.holdingHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-12.5 w-full font-semibold",
          )}
        >
          Về chi tiết {result.symbol}
        </Link>
      </div>
    </div>
  );
}

export { DividendForm };
export type { DividendFormProps };
