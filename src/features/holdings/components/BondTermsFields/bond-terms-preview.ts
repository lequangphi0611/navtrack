import Decimal from "decimal.js";

// Preview client-side cho card "Từ điều khoản này, app suy ra" (mockup Phase 7
// Screens 7a) — CHỈ để user đối chiếu ngay lúc gõ, cùng vai trò với phần tự
// tính gross/tax/net trong CashDividendFields. Bản domain thật (dùng chung cho
// Phase 8 "kỳ trả lãi tới") thuộc issue #58 và sẽ sống ở tầng server; khi có,
// component chuyển sang nhận số qua props thay vì tự tính ở đây.
//
// Ngày làm việc hoàn toàn theo UTC (cùng quy ước computeHoldingPeriodLabel,
// src/lib/holding-period.ts) — chuỗi "yyyy-MM-dd" vào, "yyyy-MM-dd" ra.

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

// Trần lặp khi dò mốc coupon — chặn vòng lặp vô hạn nếu người dùng gõ ngày
// đáo hạn cách kỳ đầu hàng thế kỷ (vd nhầm 2029 thành 2929).
const MAX_COUPON_PERIODS = 1200;

function parsePositiveDecimal(value: string): Decimal | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    const parsed = new Decimal(trimmed.replace(",", "."));
    return parsed.isFinite() && parsed.gt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function parseUtcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? null : new Date(time);
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Cộng tháng theo lịch, kẹp về ngày cuối tháng khi tháng đích ngắn hơn (31/01
// + 1 tháng = 28/02, không tràn sang 03/03 như phép cộng ngày thô của JS).
function addMonthsUtc(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

// Mọi mốc trả lãi theo lịch hợp đồng: firstCouponDate + k × frequency, dừng ở
// ngày đáo hạn (tính cả mốc trùng đúng ngày đáo hạn — trái tức kỳ cuối thường
// được trả cùng lúc với gốc, xem mockup 7e toast gợi ý).
function buildCouponSchedule(
  firstCouponDate: Date,
  frequencyMonths: number,
  maturityDate: Date,
): Date[] {
  const schedule: Date[] = [];
  for (let index = 0; index < MAX_COUPON_PERIODS; index += 1) {
    const date = addMonthsUtc(firstCouponDate, index * frequencyMonths);
    if (date.getTime() > maturityDate.getTime()) break;
    schedule.push(date);
  }
  return schedule;
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

  const first = parseUtcDate(firstCouponDate);
  const maturity = parseUtcDate(maturityDate);

  if (!first || !maturity || !frequencyMonths) {
    return { couponPerPeriod, remainingPeriods: null, nextCouponDate: null };
  }

  const schedule = buildCouponSchedule(first, frequencyMonths, maturity);
  const upcoming = schedule.filter((date) => date.getTime() > today.getTime());
  const next = upcoming[0];

  return {
    couponPerPeriod,
    remainingPeriods: upcoming.length,
    nextCouponDate: next ? toDateInputValue(next) : null,
  };
}

export { computeBondTermsPreview };
export type { BondTermsPreview, BondTermsPreviewInput };
