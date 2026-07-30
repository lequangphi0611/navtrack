import type Decimal from "decimal.js";

import {
  buildCouponSchedule,
  startOfUtcDay,
  type BondCouponScheduleTerms,
} from "@/lib/bond-schedule";
import { parseDecimalOrNull } from "@/lib/parse-decimal";

// Preview client-side cho card "Từ điều khoản này, app suy ra" (mockup Phase 7
// Screens 7a) — CHỈ để user đối chiếu ngay lúc gõ, cùng vai trò với phần tự
// tính gross/tax/net trong CashDividendFields. Server Action tính lại độc lập
// khi lưu, KHÔNG tin số ở đây.
//
// Phép tính LỊCH (cộng tháng, dựng chuỗi mốc trả lãi) đã chuyển sang
// `src/lib/bond-schedule.ts` ở issue #58 — dùng chung với tầng server
// (recordDividend) và Phase 8. File này giữ đúng phần riêng của form: parse
// chuỗi input thô "yyyy-MM-dd"/số người dùng đang gõ (có thể dở dang, sai định
// dạng) rồi format ngược ra chuỗi để hiển thị.
//
// Ngày làm việc hoàn toàn theo UTC (cùng quy ước lib/bond-schedule.ts).

type BondTermsPreviewInput = {
  parValue: string;
  couponRatePercent: string;
  couponFrequencyMonths: string;
  firstCouponDate: string; // yyyy-MM-dd, "" = chưa nhập
  maturityDate: string; // yyyy-MM-dd, "" = chưa nhập
  // Mốc "hôm nay" để suy kỳ kế tiếp — nhận qua tham số để test được, mặc định
  // là thời điểm chạy.
  today?: Date;
};

type BondTermsPreview = {
  // Trái tức một kỳ trên TOÀN BỘ mệnh giá một trái phiếu (chưa nhân số lượng
  // đang giữ) — null khi thiếu lãi suất/kỳ trả lãi (trái phiếu zero-coupon).
  couponPerPeriod: string | null;
  // Số kỳ trả lãi còn lại tính TỪ kỳ kế tiếp tới ngày đáo hạn (tính cả mốc
  // trùng ngày đáo hạn) — null khi thiếu ngày kỳ đầu hoặc ngày đáo hạn.
  remainingPeriods: number | null;
  // Mốc trả lãi đầu tiên còn ở phía trước tính từ `today` — null khi thiếu
  // ngày kỳ đầu/kỳ trả lãi, hoặc mọi kỳ đã qua ngày đáo hạn.
  nextCouponDate: string | null; // yyyy-MM-dd
};

function parsePositiveDecimal(value: string): Decimal | null {
  const parsed = parseDecimalOrNull(value);
  return parsed && parsed.gt(0) ? parsed : null;
}

function parseUtcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : new Date(time);
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeBondTermsPreview({
  parValue,
  couponRatePercent,
  couponFrequencyMonths,
  firstCouponDate,
  maturityDate,
  today = new Date(),
}: BondTermsPreviewInput): BondTermsPreview {
  const par = parsePositiveDecimal(parValue);
  const rate = parsePositiveDecimal(couponRatePercent);
  const frequency = parsePositiveDecimal(couponFrequencyMonths);
  const frequencyMonths = frequency ? frequency.toNumber() : null;

  const couponPerPeriod =
    par && rate && frequencyMonths
      ? par.mul(rate).div(100).mul(frequencyMonths).div(12).toString()
      : null;

  const terms: BondCouponScheduleTerms = {
    couponFrequencyMonths: frequencyMonths,
    firstCouponDate: parseUtcDate(firstCouponDate),
    maturityDate: parseUtcDate(maturityDate),
  };

  const schedule = buildCouponSchedule(terms);
  if (schedule.length === 0) {
    return { couponPerPeriod, remainingPeriods: null, nextCouponDate: null };
  }

  // Ngưỡng ở màn NHẬP ĐIỀU KHOẢN là "hôm nay" (khác computeNextCouponDate ở
  // tầng ghi, nơi ngưỡng là kỳ đã trả gần nhất): card này chỉ mô tả hợp đồng,
  // chưa biết gì về lịch sử Dividend đã ghi.
  const todayTime = startOfUtcDay(today).getTime();
  const upcoming = schedule.filter((date) => date.getTime() > todayTime);
  const next = upcoming[0];

  return {
    couponPerPeriod,
    remainingPeriods: upcoming.length,
    nextCouponDate: next ? toDateInputValue(next) : null,
  };
}

export { computeBondTermsPreview };
export type { BondTermsPreview, BondTermsPreviewInput };
