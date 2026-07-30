"use client";

import type { BondIssuerType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calculator,
  FileText,
  Gavel,
  HelpCircle,
  Info,
  Landmark,
  Lightbulb,
} from "lucide-react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/format";

import { computeBondTermsPreview } from "./bond-terms-preview";

type BondTermsFieldsProps = {
  issuerType: BondIssuerType;
  onIssuerTypeChange: (value: BondIssuerType) => void;
  parValue: string;
  onParValueChange: (value: string) => void;
  couponRatePercent: string;
  onCouponRatePercentChange: (value: string) => void;
  couponFrequencyMonths: string;
  onCouponFrequencyMonthsChange: (value: string) => void;
  firstCouponDate: string; // yyyy-MM-dd
  onFirstCouponDateChange: (value: string) => void;
  maturityDate: string; // yyyy-MM-dd
  onMaturityDateChange: (value: string) => void;
  disabled?: boolean;
};

// Kỳ trả lãi phổ biến ở thị trường VN — vẫn là gợi ý, `BondTerms.couponFrequencyMonths`
// là Int nên giá trị khác nhập được qua form sửa vị thế nếu sau này cần.
const COUPON_FREQUENCY_OPTIONS = [
  { value: "3", label: "3 tháng/lần" },
  { value: "6", label: "6 tháng/lần" },
  { value: "12", label: "12 tháng/lần" },
];

// Nhóm field "Điều khoản trái phiếu" (mockup Phase 7 Screens 7a) — lắp vào form
// tạo/sửa vị thế khi Holding.type = "BOND", KHÔNG phải route riêng. Presentational
// thuần: mọi state do form cha giữ, component chỉ hiển thị + tính preview
// client-side cho card "app suy ra" (cùng vai trò preview gross/tax/net trong
// CashDividendFields — Server Action tính lại độc lập khi lưu).
//
// Mệnh giá + loại tổ chức phát hành là BẮT BUỘC; cả cụm coupon (lãi suất, kỳ
// trả lãi, ngày kỳ đầu, ngày đáo hạn) bỏ trống được — đó là trái phiếu chiết
// khấu/zero-coupon, lợi tức chỉ phát sinh khi tất toán đáo hạn (mockup 7a note
// "help", docs/domain/03-dividends.md).
function BondTermsFields({
  issuerType,
  onIssuerTypeChange,
  parValue,
  onParValueChange,
  couponRatePercent,
  onCouponRatePercentChange,
  couponFrequencyMonths,
  onCouponFrequencyMonthsChange,
  firstCouponDate,
  onFirstCouponDateChange,
  maturityDate,
  onMaturityDateChange,
  disabled = false,
}: BondTermsFieldsProps) {
  const preview = computeBondTermsPreview({
    parValue,
    couponRatePercent,
    couponFrequencyMonths,
    firstCouponDate,
    maturityDate,
  });
  const hasSchedulePreview =
    preview.couponPerPeriod !== null || preview.nextCouponDate !== null;

  return (
    <div className="flex flex-col gap-4.5">
      <input type="hidden" name="bondIssuerType" value={issuerType} />

      <div className="flex gap-2.5 rounded-2xl border border-asset-bond/40 bg-linear-to-br from-asset-bond/16 to-card p-3.5">
        <FileText className="mt-px size-4.75 shrink-0 text-asset-bond" />
        <div>
          <div className="text-[12.5px] font-bold text-foreground">
            Điều khoản hợp đồng — nhập một lần
          </div>
          <div className="mt-0.75 text-[11px] leading-relaxed text-muted-foreground">
            Mệnh giá và lãi suất là điều khoản cố định của trái phiếu. Nhập ở
            đây <span className="text-foreground-soft">một lần duy nhất</span>;
            mỗi kỳ trái tức sau này app chỉ hỏi ngày.
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.75 flex items-center gap-1.75">
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            Loại tổ chức phát hành
          </span>
          <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">
            BẮT BUỘC
          </Badge>
        </div>
        <SegmentedControl
          options={[
            { value: "CORPORATE", label: "Doanh nghiệp" },
            { value: "GOVERNMENT", label: "Chính phủ" },
          ]}
          value={issuerType}
          onChange={onIssuerTypeChange}
          stretch
          className="rounded-xl bg-card p-1 font-bold"
        />
        <div className="mt-1.75 flex items-start gap-1.75 text-[11px] leading-relaxed text-muted-faint">
          <Gavel className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Lựa chọn này quyết định thuế lãi:{" "}
            <span className="text-muted-foreground">doanh nghiệp 5%</span> ·{" "}
            <span className="text-muted-foreground">chính phủ miễn thuế</span>{" "}
            (NĐ 253/2026). Không đổi được sau khi đã ghi trái tức.
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.75">
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            Mệnh giá một trái phiếu
          </span>
          <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">
            BẮT BUỘC
          </Badge>
        </div>
        <div className="relative">
          <Input
            type="text"
            inputMode="numeric"
            name="parValue"
            value={parValue}
            onChange={(event) => onParValueChange(event.target.value)}
            placeholder="0"
            className="h-15 rounded-2xl border-primary/40 pr-9 font-mono text-[26px] font-semibold"
            required
            disabled={disabled}
          />
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-lg text-muted-foreground">
            ₫
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-faint">
          <Info className="size-3.5 shrink-0" />
          Gốc nhận lại khi đáo hạn, và là cơ sở tính trái tức mỗi kỳ.
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            Coupon định kỳ
          </span>
          <Badge variant="neutral" className="px-2 py-0 text-[9.5px]">
            TUỲ CHỌN · BỎ TRỐNG ĐƯỢC
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="couponRatePercent"
              className="mb-1.5 block text-[12px] font-semibold text-muted-foreground"
            >
              Lãi suất coupon
            </label>
            <div className="relative">
              <Input
                id="couponRatePercent"
                type="text"
                inputMode="decimal"
                name="couponRatePercent"
                value={couponRatePercent}
                onChange={(event) =>
                  onCouponRatePercentChange(event.target.value)
                }
                placeholder="0"
                className="h-11 rounded-xl pr-14 font-mono text-base font-semibold"
                disabled={disabled}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] text-muted-foreground">
                %/năm
              </span>
            </div>
          </div>
          <div>
            <label
              htmlFor="couponFrequencyMonths"
              className="mb-1.5 block text-[12px] font-semibold text-muted-foreground"
            >
              Kỳ trả lãi
            </label>
            <Select
              id="couponFrequencyMonths"
              name="couponFrequencyMonths"
              value={couponFrequencyMonths}
              onChange={(event) =>
                onCouponFrequencyMonthsChange(event.target.value)
              }
              className="h-11 rounded-xl"
              disabled={disabled}
            >
              <option value="">Không trả định kỳ</option>
              {COUPON_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              Ngày trả lãi kỳ đầu
            </label>
            <DatePicker
              name="firstCouponDate"
              value={firstCouponDate}
              onChange={onFirstCouponDateChange}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              Ngày đáo hạn
            </label>
            <DatePicker
              name="maturityDate"
              value={maturityDate}
              onChange={onMaturityDateChange}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex gap-2.25 rounded-xl border border-border bg-white/3 p-3">
          <HelpCircle className="mt-0.5 size-4.25 shrink-0 text-muted-faint" />
          <div className="text-[11px] leading-relaxed text-muted-faint">
            Trái phiếu <span className="text-muted-foreground">chiết khấu</span>{" "}
            (zero-coupon) không trả lãi định kỳ — bỏ trống cả bốn field trên,
            chỉ cần mệnh giá và loại phát hành. Lợi tức sẽ được tính khi tất
            toán đáo hạn.
          </div>
        </div>
      </div>

      {hasSchedulePreview ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
            <Calculator className="size-3.75 text-primary" />
            Từ điều khoản này, app suy ra
          </div>
          <div className="flex items-center justify-between px-3.75 py-3">
            <span className="text-[13px] text-muted-foreground">
              Trái tức mỗi kỳ{" "}
              {preview.couponPerPeriod ? (
                <span className="text-[11px] text-muted-faint">
                  · {formatMoney(parValue || "0", { compact: true })} ×{" "}
                  {couponRatePercent}% × {couponFrequencyMonths}/12
                </span>
              ) : null}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {preview.couponPerPeriod
                ? formatMoney(preview.couponPerPeriod)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-3">
            <span className="text-[13px] text-muted-foreground">
              Số kỳ còn lại đến đáo hạn
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {preview.remainingPeriods === null
                ? "—"
                : `${preview.remainingPeriods} kỳ`}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/4.5 px-3.75 py-3">
            <span className="text-[13px] text-muted-foreground">
              Kỳ kế tiếp
            </span>
            <span className="font-mono text-sm font-semibold text-primary">
              {preview.nextCouponDate
                ? formatDate(preview.nextCouponDate)
                : "—"}
            </span>
          </div>
          <div className="flex items-start gap-2.25 border-t border-white/5 bg-white/2 px-3.75 py-2.75">
            <Lightbulb className="mt-0.5 size-3.75 shrink-0 text-muted-faint" />
            <span className="text-[10.5px] leading-relaxed text-muted-faint">
              App <span className="text-muted-foreground">không tự ghi</span>{" "}
              trái tức theo lịch — chỉ nhắc kỳ tới. Bạn vẫn là người xác nhận
              từng kỳ.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Icon minh hoạ loại tổ chức phát hành — MỘT chỗ khai báo dùng chung với
// BondTermsSummaryCard, để hai nơi không lệch nhau. Record đủ case theo
// BondIssuerType (docs/rules/typescript-style.md mục "Enum") nên thêm loại
// phát hành mới sẽ đỏ ngay ở đây.
const BOND_ISSUER_ICON: Record<BondIssuerType, LucideIcon> = {
  CORPORATE: Building2,
  GOVERNMENT: Landmark,
};

export { BondTermsFields, BOND_ISSUER_ICON };
export type { BondTermsFieldsProps };
