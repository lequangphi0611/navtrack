"use client";

import Decimal from "decimal.js";
import type { DividendType } from "@prisma/client";
import {
  Calculator,
  Check,
  CheckCircle2,
  Coins,
  History,
  Info,
  Layers,
  Lock,
  Pencil,
  Settings2,
  Sigma,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert } from "@/components/Alert";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  HoldingSwitcher,
  type HoldingSwitcherProps,
} from "@/features/dividends/components/HoldingSwitcher";
import {
  computeStockDividend,
  isStockQuantityOverrideValid,
} from "@/features/dividends/dividend-math";
import type {
  DividendFormState,
  DividendHolding,
  DividendRecordedResult,
} from "@/features/dividends/types";
import { assertNever } from "@/lib/assert-never";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[12.5px] font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

// Nhãn/màu theo DividendType — Record<DividendType, ...> (docs/rules/typescript-style.md
// mục "Enum") thay cho ternary `isCash ? ... : ...` lặp lại nhiều lần: thiếu
// một giá trị enum sẽ lỗi compile ngay thay vì âm thầm coi mọi giá trị khác
// CASH là STOCK.
const PERCENT_FIELD_LABEL: Record<DividendType, string> = {
  CASH: "Tỷ lệ cổ tức (% mệnh giá)",
  STOCK: "Tỷ lệ cổ tức cổ phiếu (%)",
};

const DIVIDEND_FORM_SUBTITLE: Record<DividendType, string> = {
  CASH: "Nhập % → tự tính tiền nhận về",
  STOCK: "Cổ phiếu → tăng số lượng nắm giữ",
};

const SUBMIT_BUTTON_CLASS: Record<DividendType, string> = {
  CASH: "bg-gain text-primary-foreground hover:bg-gain/85",
  STOCK: "bg-accent text-accent-foreground hover:bg-accent/85",
};

// Parse lenient — input "percent" gõ tay có thể rỗng/dở dang lúc user đang gõ;
// new Decimal() throw trên chuỗi không hợp lệ (khác Number() trả NaN êm), nên
// phải try/catch thay vì để lỗi văng ra ngoài React render (cùng pattern
// NavOverrideForm.tsx).
function parseDecimalOrNull(value: string): Decimal | null {
  if (value.trim() === "") return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

// Form ghi nhận cổ tức (mockup Phase 4 Screens, 4a Tiền mặt / 4c Cổ phiếu — MỘT
// component dùng chung cho cả 2, chỉ khác nhánh hiển thị theo `type`). Trạng
// thái thành công (4d) render INLINE thay vì route riêng — cùng pattern
// SnapshotFreezeSheet.isDone/SnapshotTodayCard, tránh phải quyết định "có
// router.push hay không" (decision (d) cũ trong plan, nay không còn cần thiết).
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
  const [stockOverride, setStockOverride] = useState("");
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [state, formAction, isPending] = useActionState(action, null);
  const isDone = state?.ok === true;

  const percentDecimal = parseDecimalOrNull(percent);
  const quantity = new Decimal(holding.quantity);

  // Preview CASH — chỉ minh hoạ client-side, Server Action (#52) tự tính lại
  // gross/tax/net độc lập, KHÔNG tin số này khi lưu.
  // Preview STOCK — dùng chung dividend-math.ts với Server Action (tránh drift
  // giữa 2 nơi tính công thức), stockQuantity đã floor (cổ phiếu không chia
  // lẻ). rawStockQuantity là mốc so sánh tolerance cho override.
  // switch exhaustive thay `isCash ? ... : ...` — mỗi loại chỉ tính preview
  // của chính nó, compiler bắt lỗi ngay nếu Prisma thêm DividendType mới mà
  // chỗ này chưa xử lý.
  let pricePerShare: Decimal | null = null;
  let stockDividend: ReturnType<typeof computeStockDividend> | null = null;
  switch (type) {
    case "CASH":
      pricePerShare = percentDecimal
        ? new Decimal(faceValuePerShare).mul(percentDecimal).div(100)
        : null;
      break;
    case "STOCK":
      stockDividend = percentDecimal
        ? computeStockDividend({ percent: percentDecimal, quantity })
        : null;
      break;
    default:
      assertNever(type);
  }
  const grossAmount = pricePerShare ? pricePerShare.mul(quantity) : null;
  const taxAmount = grossAmount
    ? grossAmount.mul(taxRatePercent).div(100)
    : null;
  const netAmount =
    grossAmount && taxAmount ? grossAmount.minus(taxAmount) : null;
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

  const subtitle = DIVIDEND_FORM_SUBTITLE[type];

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

          <div>
            <FieldLabel>{PERCENT_FIELD_LABEL[type]}</FieldLabel>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                name="percent"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                placeholder="0"
                className="h-15 rounded-2xl border-primary/40 pr-9 text-[26px] font-mono font-semibold"
                required
                disabled={isPending}
              />
              <span className="absolute top-1/2 right-4 -translate-y-1/2 text-base font-medium text-muted-foreground">
                %
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11.5px] text-muted-faint">
              <Sigma className="size-3.5 shrink-0" />
              {(() => {
                switch (type) {
                  case "CASH":
                    return (
                      <span>
                        {percent || "0"}% × {formatMoney(faceValuePerShare)}{" "}
                        mệnh giá ={" "}
                        <span className="text-primary">
                          {pricePerShare
                            ? `${formatMoney(pricePerShare.toString())}/${holding.unit}`
                            : "—"}
                        </span>
                      </span>
                    );
                  case "STOCK":
                    return (
                      <span>
                        {percent || "0"}% ×{" "}
                        {formatQuantity(holding.quantity, holding.unit)} ={" "}
                        <span className="text-primary">
                          {addedQuantity
                            ? formatQuantity(
                                addedQuantity.toString(),
                                holding.unit,
                              )
                            : "—"}
                        </span>{" "}
                        thưởng
                      </span>
                    );
                  default:
                    return assertNever(type);
                }
              })()}
            </div>

            {(() => {
              switch (type) {
                case "CASH":
                  return null;
                case "STOCK":
                  return (
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
                            setShowOverrideInput(false);
                            setStockOverride("");
                          }}
                          className="flex w-fit items-center gap-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                          Bỏ chỉnh sửa, dùng số hệ thống tính
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowOverrideInput(true)}
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
                            onChange={(event) =>
                              setStockOverride(event.target.value)
                            }
                            placeholder={
                              stockDividend
                                ? stockDividend.stockQuantity.toString()
                                : "0"
                            }
                            className="h-11 rounded-xl font-mono font-semibold"
                            disabled={isPending}
                          />
                          {overrideInvalid && stockDividend ? (
                            <p className="mt-1.5 text-[11.5px] text-destructive">
                              Chỉ được lệch tối đa 2 đơn vị so với số tính từ %
                              (
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
                  );
                default:
                  return assertNever(type);
              }
            })()}
          </div>

          {(() => {
            switch (type) {
              case "CASH":
                return (
                  <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2.5">
                    <div>
                      <FieldLabel>Ngày nhận</FieldLabel>
                      <DatePicker
                        name="date"
                        value={date}
                        onChange={setDate}
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
                );
              case "STOCK":
                return (
                  <div>
                    <FieldLabel>Ngày nhận</FieldLabel>
                    <DatePicker
                      name="date"
                      value={date}
                      onChange={setDate}
                      required
                      disabled={isPending}
                    />
                  </div>
                );
              default:
                return assertNever(type);
            }
          })()}

          <div>
            <FieldLabel>
              Ngày thanh toán{" "}
              <span className="font-normal text-muted-faint">· tuỳ chọn</span>
            </FieldLabel>
            <DatePicker
              name="paymentDate"
              value={paymentDate}
              onChange={setPaymentDate}
              disabled={isPending}
            />
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-faint">
              <Info className="mt-0.5 size-3.25 shrink-0" />
              <span>
                {(() => {
                  switch (type) {
                    case "CASH":
                      return (
                        <>
                          Ngày tiền thực về tài khoản. Dùng làm mốc tính XIRR
                          (bỏ trống thì tính theo ngày chia). Không ảnh hưởng
                          giá điều chỉnh — mốc đó vẫn luôn bám ngày chia.
                        </>
                      );
                    case "STOCK":
                      return (
                        <>
                          Ngày {holding.unit} thực về tài khoản. Không dùng để
                          tính XIRR hay giá điều chỉnh — mọi tính toán bám ngày
                          chia.
                        </>
                      );
                    default:
                      return assertNever(type);
                  }
                })()}
              </span>
            </div>
          </div>

          {(() => {
            switch (type) {
              case "CASH":
                return (
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
                      <Calculator className="size-3.75 text-primary" />
                      Tự tính số tiền nhận về
                    </div>
                    <div className="flex items-center justify-between px-3.75 py-2.75">
                      <span className="text-[13px] text-muted-foreground">
                        Cổ tức gộp{" "}
                        <span className="text-[11px] text-muted-faint">
                          · {formatQuantity(holding.quantity, holding.unit)} ×{" "}
                          {pricePerShare
                            ? formatMoney(pricePerShare.toString())
                            : "—"}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {grossAmount
                          ? formatMoney(grossAmount.toString())
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
                      <span className="text-[13px] text-muted-foreground">
                        Thuế TNCN{" "}
                        <span className="text-[11px] text-muted-faint">
                          · {taxRatePercent}%
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-destructive">
                        {taxAmount
                          ? `−${formatMoney(taxAmount.toString())}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/7 bg-gain/7 px-3.75 py-3.25">
                      <span className="text-[13.5px] font-semibold text-gain">
                        Thực nhận (net)
                      </span>
                      <span className="font-mono text-lg font-bold text-gain">
                        {netAmount ? formatMoney(netAmount.toString()) : "—"}
                      </span>
                    </div>
                  </div>
                );
              case "STOCK":
                return (
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
                      <Calculator className="size-3.75 text-accent" />
                      Số lượng nắm giữ thay đổi
                    </div>
                    <div className="flex items-center justify-between px-3.75 py-2.75">
                      <span className="text-[13px] text-muted-foreground">
                        Đang nắm giữ
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatQuantity(holding.quantity, holding.unit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-2.75">
                      <span className="text-[13px] text-muted-foreground">
                        CP thưởng{" "}
                        <span className="text-[11px] text-muted-faint">
                          · {formatQuantity(holding.quantity, holding.unit)} ×{" "}
                          {percent || "0"}%
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-accent">
                        {addedQuantity
                          ? `+${formatQuantity(addedQuantity.toString(), holding.unit)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/7 bg-accent/8 px-3.75 py-3.25">
                      <span className="text-[13.5px] font-semibold text-accent">
                        Sau khi ghi
                      </span>
                      <span className="font-mono text-lg font-bold text-accent">
                        {afterQuantity
                          ? formatQuantity(
                              afterQuantity.toString(),
                              holding.unit,
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              default:
                return assertNever(type);
            }
          })()}

          {/* Issue #61: checkbox điều khiển việc Server Action có tự tạo
              NavOverride bù pha loãng hay không — áp dụng cho cả CASH/STOCK.
              Submit qua hidden input "true"/"false" ở đầu form, không phải
              chính input này. */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
              <Settings2 className="size-3.75 text-accent" />
              Giá điều chỉnh kỹ thuật
              <span className="ml-auto text-[10.5px] font-medium text-muted-faint">
                ngày chia
              </span>
            </div>
            <label className="relative flex cursor-pointer items-start gap-2.75 px-3.75 py-3.25">
              <input
                type="checkbox"
                checked={priceAlreadyReflectsMarket}
                onChange={(event) =>
                  setPriceAlreadyReflectsMarket(event.target.checked)
                }
                className="peer sr-only"
                disabled={isPending}
              />
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-white/4 transition-colors peer-checked:border-accent peer-checked:bg-accent">
                <Check className="size-3.5 text-accent-foreground opacity-0 transition-opacity peer-checked:opacity-100" />
              </span>
              <span className="flex-1">
                <span className="block text-[12.5px] font-semibold text-muted-foreground">
                  Giá hiện tại đã phản ánh đợt chia này
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-faint">
                  Bỏ trống → hệ thống tự tính và ghi giá điều chỉnh tại ngày
                  chia. Tick nếu giá đang niêm yết đã đúng (vd job cập nhật giá
                  đã chạy lại).
                </span>
              </span>
            </label>
          </div>

          {(() => {
            switch (type) {
              case "CASH":
                return (
                  <div className="flex gap-2.25 rounded-xl border border-gain/22 bg-gain/7 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
                    <TrendingUp className="mt-0.5 size-4.25 shrink-0 text-gain" />
                    <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Net{" "}
                      <span className="text-foreground-soft">
                        {netAmount
                          ? formatMoney(netAmount.toString(), {
                              compact: true,
                            })
                          : "—"}
                      </span>{" "}
                      ghi làm{" "}
                      <span className="text-foreground-soft">
                        dòng tiền dương
                      </span>{" "}
                      trong chuỗi XIRR — số minh hoạ, Server Action sẽ tính lại.
                    </div>
                  </div>
                );
              case "STOCK":
                return (
                  <div className="flex gap-2.25 rounded-xl border border-border bg-card p-3">
                    <Info className="mt-0.5 size-4.25 shrink-0 text-muted-faint" />
                    <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Cổ tức cổ phiếu{" "}
                      <span className="text-foreground-soft">
                        không phát sinh dòng tiền
                      </span>{" "}
                      → không vào XIRR. Giá vốn/{holding.unit} giữ nguyên, số
                      lượng {holding.unit} tăng thêm tương ứng.
                    </div>
                  </div>
                );
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
              overrideInvalid
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

// Nhãn "Cổ tức tiền mặt"/"Cổ tức cổ phiếu" theo DividendType — switch
// exhaustive để compiler bắt lỗi ngay khi thêm BOND_COUPON/MATURITY (issue
// #101), thay vì ternary nhị phân âm thầm coi mọi giá trị khác CASH là STOCK.
function dividendTypeLabel(type: DividendType): string {
  switch (type) {
    case "CASH":
      return "Cổ tức tiền mặt";
    case "STOCK":
      return "Cổ tức cổ phiếu";
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
