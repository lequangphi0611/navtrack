// Lịch trả lãi trái phiếu — SUY RUNTIME từ `BondTerms.firstCouponDate`, không
// bao giờ lưu sẵn một giá trị cộng tay (docs/domain/10-cashflow-calendar.md mục
// "Suy ra kỳ trả lãi tới", quyết định 2026-07-25). Lý do đảo thiết kế cũ
// (`nextCouponDate += frequency` sau mỗi lần ghi): lịch trôi dần khi tổ chức
// phát hành trả trễ, và ghi bù một kỳ bỏ sót sẽ đẩy giá trị về một kỳ ĐÃ nhận.
//
// Thuần (không đụng DB, không phụ thuộc Prisma) — dùng chung cho tầng server
// (recordDividend, issue #58), preview client-side (BondTermsFields) và Phase 8
// (lịch dòng tiền sắp tới), đúng tinh thần "chỉ đẩy lên lib/ chung khi thực sự
// tái dùng ở nhiều feature" (docs/rules/project-structure.md).
//
// Mọi phép tính ngày theo UTC (cùng quy ước computeHoldingPeriodLabel,
// src/lib/holding-period.ts) — tránh lệch một ngày theo timezone máy chạy.

// Trần lặp khi dò mốc coupon — chặn vòng lặp vô hạn nếu người dùng gõ ngày đáo
// hạn cách kỳ đầu hàng thế kỷ (vd nhầm 2029 thành 2929). 1200 kỳ = 100 năm khi
// trả hàng tháng, rộng hơn mọi trái phiếu thật.
const MAX_COUPON_PERIODS = 1200;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Cộng tháng theo LỊCH, kẹp về ngày cuối tháng khi tháng đích ngắn hơn (31/01
// + 1 tháng = 28/02, không tràn sang 03/03 như phép cộng ngày thô của JS).
export function addMonthsUtc(date: Date, months: number): Date {
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

// Cắt về 00:00:00.000 UTC — so sánh mốc lịch phải theo NGÀY, không theo giờ
// (Dividend.date lưu ở DB có thể mang phần giờ khác nhau tuỳ nguồn ghi).
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export type BondCouponScheduleTerms = {
  couponFrequencyMonths: number | null;
  firstCouponDate: Date | null;
  maturityDate: Date | null;
};

// Toàn bộ mốc trả lãi theo lịch HỢP ĐỒNG: firstCouponDate + k × frequency.
// Dừng ở ngày đáo hạn và TÍNH CẢ mốc trùng đúng ngày đáo hạn — trái tức kỳ cuối
// thường được trả cùng lúc với gốc (docs/domain/10-cashflow-calendar.md "Ca
// biên"). Không có `maturityDate` -> không biết dừng ở đâu, trả rỗng thay vì
// sinh lịch vô hạn (thiếu field optional là bình thường, holding chỉ đơn giản
// không xuất hiện ở mục tương ứng).
export function buildCouponSchedule(terms: BondCouponScheduleTerms): Date[] {
  const { firstCouponDate, couponFrequencyMonths, maturityDate } = terms;
  if (
    !firstCouponDate ||
    !couponFrequencyMonths ||
    couponFrequencyMonths <= 0
  ) {
    return [];
  }
  if (!maturityDate) return [];

  const first = startOfUtcDay(firstCouponDate);
  const maturity = startOfUtcDay(maturityDate);

  const schedule: Date[] = [];
  for (let index = 0; index < MAX_COUPON_PERIODS; index += 1) {
    const date = addMonthsUtc(first, index * couponFrequencyMonths);
    if (date.getTime() > maturity.getTime()) break;
    schedule.push(date);
  }
  return schedule;
}

export type NextCouponDateInput = BondCouponScheduleTerms & {
  // Tổ chức phát hành đổi lịch thực tế -> THẮNG giá trị suy ra (cùng tinh thần
  // NavOverride: giá trị tự động là gợi ý, không khoá).
  nextCouponDateOverride: Date | null;
  // max(date) của Dividend{type: BOND_COUPON} đã ghi cho holding này — null khi
  // chưa ghi kỳ nào. Caller đọc từ DB, hàm này không tự truy vấn.
  lastPaidCouponDate: Date | null;
  today: Date;
};

// Kỳ trả lãi TỚI. Neo theo lịch hợp đồng (firstCouponDate), KHÔNG theo ngày
// nhận thực tế — một kỳ trả trễ không làm lệch các kỳ sau.
//
// Ngưỡng so sánh là `lastPaidCouponDate ?? hôm qua`: khi chưa ghi kỳ nào, mốc
// rơi ĐÚNG hôm nay vẫn được coi là "sắp tới" (chưa ghi thì vẫn còn phải ghi),
// nên so với hôm qua chứ không phải hôm nay.
export function computeNextCouponDate(input: NextCouponDateInput): Date | null {
  if (input.nextCouponDateOverride) {
    return startOfUtcDay(input.nextCouponDateOverride);
  }

  const schedule = buildCouponSchedule(input);
  if (schedule.length === 0) return null;

  const threshold = input.lastPaidCouponDate
    ? startOfUtcDay(input.lastPaidCouponDate)
    : new Date(startOfUtcDay(input.today).getTime() - MS_PER_DAY);

  return schedule.find((date) => date.getTime() > threshold.getTime()) ?? null;
}

// Số thứ tự kỳ (1-based) của một ngày trả lãi trong lịch hợp đồng — dùng cho
// badge "KỲ 2 · TỰ ĐIỀN" (mockup 7b). Trả null khi ngày không rơi đúng một mốc
// nào của lịch (user tự sửa sang ngày lệch hợp đồng — hợp lệ, chỉ là không đánh
// số được).
export function computeCouponPeriodIndex(
  terms: BondCouponScheduleTerms,
  couponDate: Date,
): number | null {
  const schedule = buildCouponSchedule(terms);
  const target = startOfUtcDay(couponDate).getTime();
  const index = schedule.findIndex((date) => date.getTime() === target);
  return index === -1 ? null : index + 1;
}

// Số kỳ trả lãi CÒN LẠI tính từ kỳ tới đến hết đáo hạn — card "app suy ra" (7a).
export function countRemainingCouponPeriods(
  terms: BondCouponScheduleTerms,
  today: Date,
): number | null {
  const schedule = buildCouponSchedule(terms);
  if (schedule.length === 0) return null;
  const threshold = startOfUtcDay(today).getTime();
  return schedule.filter((date) => date.getTime() > threshold).length;
}
