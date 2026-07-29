"use client";

import Decimal from "decimal.js";
import { Calculator, Gavel, Info, ReceiptText, TrendingUp } from "lucide-react";
import { useState } from "react";

import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import type {
  BondCouponContext,
  DividendHolding,
} from "@/features/dividends/types";
import { formatMoney, formatQuantity } from "@/lib/format";

import { BondTermsSummaryCard } from "./BondTermsSummaryCard";
import { FieldLabel } from "./FieldLabel";
import { InfoNote } from "./InfoNote";
import { parseDecimalOrNull } from "./parse-decimal";
import { PaymentDateField } from "./PaymentDateField";
import { PreviewBreakdownCard } from "./PreviewBreakdownCard";

type BondCouponFieldsProps = {
  holding: DividendHolding;
  // terms ĐÃ được DividendForm khẳng định khác null trước khi render component
  // này (thiếu điều khoản -> BondTermsMissingNotice, mockup 7g).
  bond: BondCouponContext & { terms: NonNullable<BondCouponContext["terms"]> };
  date: string;
  onDateChange: (value: string) => void;
  paymentDate: string;
  onPaymentDateChange: (value: string) => void;
  isPending: boolean;
};

// Toàn bộ phần biến thiên theo DividendType="BOND_COUPON" của DividendForm
// (mockup Phase 7 Screens 7b doanh nghiệp / 7c chính phủ) — variant thứ ba
// song song CashDividendFields/StockDividendFields, dùng lại nguyên các atom
// dùng chung (FieldLabel/PaymentDateField/PreviewBreakdownCard/InfoNote).
//
// Khác hẳn hai loại kia ở một điểm nghiệp vụ: KHÔNG có ô nhập % — mệnh giá và
// lãi suất là điều khoản cố định đọc từ BondTerms, form chỉ hỏi NGÀY trả lãi
// (process/phase-7.md mục 4, process/DECISION.md 2026-07-25 (2)).
//
// Biến thể miễn thuế nhận biết bằng `issuerType === "GOVERNMENT"`, KHÔNG bằng
// việc so taxRatePercent === "0" — thuế 0 do luật khác hẳn thuế 0 do thiếu
// cấu hình, và chỉ issuerType mới nói được điều đó.
function BondCouponFields({
  holding,
  bond,
  date,
  onDateChange,
  paymentDate,
  onPaymentDateChange,
  isPending,
}: BondCouponFieldsProps) {
  const { terms, taxRatePercent, couponPeriodLabel, bondTermsHref } = bond;
  const isTaxExempt = terms.issuerType === "GOVERNMENT";

  // Preview client-side minh hoạ — Server Action (#58) tự tính lại gross/tax/
  // net độc lập từ BondTerms khi lưu, KHÔNG tin số này.
  const quantity = new Decimal(holding.quantity);
  const parValue = new Decimal(terms.parValue);
  const couponRate = parseDecimalOrNull(terms.couponRatePercent ?? "");
  const couponPerPeriod =
    couponRate && terms.couponFrequencyMonths
      ? parValue
          .mul(couponRate)
          .div(100)
          .mul(terms.couponFrequencyMonths)
          .div(12)
      : null;
  const grossAmount = couponPerPeriod ? couponPerPeriod.mul(quantity) : null;
  const computedTaxAmount = grossAmount
    ? grossAmount.mul(taxRatePercent).div(100)
    : null;

  // Thuế sửa tay được (tổ chức phát hành có thể đã khấu trừ khác) — giữ giá trị
  // hiệu lực ở đây để dòng "Thực nhận" bên dưới phản ánh đúng số user vừa sửa,
  // thay vì hiển thị net tính theo số tự động đã bị thay.
  const [effectiveTaxAmount, setEffectiveTaxAmount] = useState<string | null>(
    null,
  );
  const taxAmount =
    parseDecimalOrNull(effectiveTaxAmount ?? "") ?? computedTaxAmount;
  const netAmount =
    grossAmount && taxAmount ? grossAmount.minus(taxAmount) : null;

  return (
    <>
      <BondTermsSummaryCard
        terms={terms}
        quantityLabel={formatQuantity(holding.quantity, holding.unit)}
        editHref={bondTermsHref}
        footnote={
          isTaxExempt
            ? undefined
            : "Không phải nhập lại mệnh giá hay % mỗi kỳ — số tiền tính thẳng từ hợp đồng."
        }
      />

      <div>
        <FieldLabel>
          Ngày trả lãi{" "}
          <span className="font-normal text-muted-faint">· theo hợp đồng</span>
        </FieldLabel>
        <div className="relative">
          <DatePicker
            name="date"
            value={date}
            onChange={onDateChange}
            required
            disabled={isPending}
          />
          {couponPeriodLabel ? (
            <Badge className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[9px] tracking-wide">
              {couponPeriodLabel}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-faint">
          <Info className="mt-0.5 size-3.25 shrink-0" />
          <span>
            Suy từ kỳ đầu theo hợp đồng — sửa được nếu tổ chức trả lệch ngày.
          </span>
        </div>
      </div>

      <PaymentDateField
        value={paymentDate}
        onChange={onPaymentDateChange}
        disabled={isPending}
      >
        Ngày tiền về tài khoản. Chỉ để tham khảo — mọi tính toán bám{" "}
        <span className="text-muted-foreground">ngày trả lãi</span>.
      </PaymentDateField>

      <AutoFilledAmountCard
        icon={ReceiptText}
        label="Thuế lãi trái phiếu"
        fieldName="taxAmount"
        computedAmount={computedTaxAmount ? computedTaxAmount.toString() : "0"}
        formulaLabel={
          isTaxExempt
            ? undefined
            : `${grossAmount ? formatMoney(grossAmount.toString()) : "—"} × ${taxRatePercent}%`
        }
        reasonBadge={
          isTaxExempt ? (
            <Badge variant="accent" className="text-[10px]">
              Miễn thuế · NĐ 253/2026
            </Badge>
          ) : null
        }
        onValueChange={setEffectiveTaxAmount}
        emphasized={!isTaxExempt}
        disabled={isPending}
        // Chưa sửa tay -> KHÔNG gửi `taxAmount`, để `recordDividend` tự tính
        // theo `quantityAtDate`. Số ở đây tính theo `holding.quantity` (SL
        // HIỆN TẠI) nên lệch khi ghi bù một kỳ cũ mà SL đã đổi từ đó tới nay —
        // gửi lên sẽ ra `netAmount = gross(theo ngày trả lãi) − tax(theo SL
        // hiện tại)`, sai tiền không tín hiệu (review PR #102).
        submitWhenAuto={false}
      />

      <PreviewBreakdownCard
        icon={Calculator}
        iconClassName="text-primary"
        title="Tự tính số tiền nhận về"
        rows={[
          {
            label: "Lãi gộp",
            sublabel: `· ${formatQuantity(holding.quantity, holding.unit)} × ${
              couponPerPeriod ? formatMoney(couponPerPeriod.toString()) : "—"
            }`,
            value: grossAmount ? formatMoney(grossAmount.toString()) : "—",
          },
          {
            label: "Thuế lãi trái phiếu",
            sublabel: `· ${taxRatePercent}%`,
            value: taxAmount
              ? isTaxExempt
                ? formatMoney(taxAmount.toString())
                : `−${formatMoney(taxAmount.toString())}`
              : "—",
            valueClassName: isTaxExempt ? undefined : "text-destructive",
          },
        ]}
        footer={{
          label: "Thực nhận",
          value: netAmount ? formatMoney(netAmount.toString()) : "—",
          bgClassName: "bg-gain/7",
          textClassName: "text-gain",
        }}
      />

      <InfoNote
        icon={Gavel}
        iconClassName={isTaxExempt ? "text-accent" : "text-asset-bond"}
        containerClassName={
          isTaxExempt
            ? "border-accent/30 bg-accent/9"
            : "border-asset-bond/35 bg-asset-bond/12"
        }
      >
        {isTaxExempt ? (
          <>
            <span className="text-foreground-soft">
              Thuế 0 ₫ là đúng quy định
            </span>
            , không phải app thiếu cấu hình. Lãi trái phiếu Chính phủ được miễn
            thuế TNCN theo{" "}
            <span className="text-foreground-soft">
              Nghị định 253/2026/NĐ-CP
            </span>{" "}
            — thực nhận bằng đúng lãi gộp.
          </>
        ) : (
          <>
            Trái phiếu{" "}
            <span className="text-foreground-soft">doanh nghiệp</span> → lãi
            chịu{" "}
            <span className="text-foreground-soft">
              thuế TNCN {taxRatePercent}%
            </span>
            , tổ chức phát hành thường khấu trừ tại nguồn.
          </>
        )}
      </InfoNote>

      <InfoNote
        icon={TrendingUp}
        iconClassName="text-gain"
        containerClassName="border-gain/22 bg-gain/7 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      >
        Thực nhận{" "}
        <span className="text-foreground-soft">
          {netAmount
            ? formatMoney(netAmount.toString(), { compact: true })
            : "—"}
        </span>{" "}
        vào chuỗi dòng tiền để tính lợi suất (XIRR) — số minh hoạ, Server Action
        sẽ tính lại.
      </InfoNote>
    </>
  );
}

export { BondCouponFields };
export type { BondCouponFieldsProps };
