import { describe, expect, test } from "vitest";

import {
  addMonthsUtc,
  buildCouponSchedule,
  computeCouponPeriodIndex,
  computeNextCouponDate,
  countRemainingCouponPeriods,
} from "./bond-schedule";

function utc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Bộ số của mockup Phase 7 (TCB2528): coupon 9%/năm, kỳ 6 tháng, kỳ đầu
// 15/01/2026, đáo hạn 15/01/2029 -> 7 mốc trả lãi (kể cả mốc trùng đáo hạn).
const TCB2528 = {
  couponFrequencyMonths: 6,
  firstCouponDate: utc("2026-01-15"),
  maturityDate: utc("2029-01-15"),
};

describe("addMonthsUtc", () => {
  test("kẹp về ngày cuối tháng khi tháng đích ngắn hơn", () => {
    expect(iso(addMonthsUtc(utc("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonthsUtc(utc("2024-01-31"), 1))).toBe("2024-02-29");
  });

  test("giữ nguyên ngày khi tháng đích đủ dài", () => {
    expect(iso(addMonthsUtc(utc("2026-01-15"), 6))).toBe("2026-07-15");
  });
});

describe("buildCouponSchedule", () => {
  test("liệt kê đủ mốc, TÍNH CẢ mốc trùng đúng ngày đáo hạn", () => {
    const schedule = buildCouponSchedule(TCB2528).map(iso);
    expect(schedule).toEqual([
      "2026-01-15",
      "2026-07-15",
      "2027-01-15",
      "2027-07-15",
      "2028-01-15",
      "2028-07-15",
      "2029-01-15",
    ]);
  });

  test("zero-coupon (thiếu kỳ trả lãi / ngày kỳ đầu) -> lịch rỗng", () => {
    expect(
      buildCouponSchedule({ ...TCB2528, couponFrequencyMonths: null }),
    ).toEqual([]);
    expect(buildCouponSchedule({ ...TCB2528, firstCouponDate: null })).toEqual(
      [],
    );
  });

  test("thiếu ngày đáo hạn -> rỗng, không sinh lịch vô hạn", () => {
    expect(buildCouponSchedule({ ...TCB2528, maturityDate: null })).toEqual([]);
  });
});

describe("computeNextCouponDate", () => {
  test("chưa ghi kỳ nào -> mốc đầu tiên còn ở phía trước", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      lastPaidCouponDate: null,
      today: utc("2026-03-01"),
    });
    expect(iso(next)).toBe("2026-07-15");
  });

  test("đã ghi kỳ 15/01 -> nhảy sang 15/07 dù hôm nay còn xa", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      lastPaidCouponDate: utc("2026-01-15"),
      today: utc("2026-01-20"),
    });
    expect(iso(next)).toBe("2026-07-15");
  });

  // Lý do cốt lõi của thiết kế "suy runtime" (docs/domain/10-cashflow-calendar.md):
  // tổ chức phát hành trả trễ 10 ngày KHÔNG được làm lịch trôi thêm 10 ngày.
  test("kỳ trả TRỄ so với hợp đồng không làm lệch kỳ sau", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      // Ghi nhận kỳ 15/01 nhưng thực nhận 25/01.
      lastPaidCouponDate: utc("2026-01-25"),
      today: utc("2026-02-01"),
    });
    // Vẫn đúng lịch hợp đồng, không phải 25/07.
    expect(iso(next)).toBe("2026-07-15");
  });

  // Ca thứ hai thiết kế cũ (cộng tay) làm sai: ghi bù một kỳ bỏ sót sẽ đẩy giá
  // trị về một kỳ ĐÃ về tay.
  test("ghi bù kỳ cũ không kéo lịch lùi về kỳ đã nhận", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      // Đã ghi tới 15/07/2027, giờ ghi bù kỳ 15/01/2027 -> lastPaid vẫn là max.
      lastPaidCouponDate: utc("2027-07-15"),
      today: utc("2027-08-01"),
    });
    expect(iso(next)).toBe("2028-01-15");
  });

  test("override của tổ chức phát hành thắng giá trị suy ra", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: utc("2026-08-01"),
      lastPaidCouponDate: null,
      today: utc("2026-03-01"),
    });
    expect(iso(next)).toBe("2026-08-01");
  });

  test("mốc rơi đúng hôm nay vẫn là kỳ sắp tới khi chưa ghi kỳ nào", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      lastPaidCouponDate: null,
      today: utc("2026-07-15"),
    });
    expect(iso(next)).toBe("2026-07-15");
  });

  test("đã ghi kỳ cuối -> hết kỳ, trả null", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      lastPaidCouponDate: utc("2029-01-15"),
      today: utc("2029-02-01"),
    });
    expect(next).toBeNull();
  });

  test("zero-coupon -> không có kỳ tới", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      couponFrequencyMonths: null,
      firstCouponDate: null,
      nextCouponDateOverride: null,
      lastPaidCouponDate: null,
      today: utc("2026-03-01"),
    });
    expect(next).toBeNull();
  });

  test("so sánh theo NGÀY, không theo giờ (Dividend.date có thể mang phần giờ)", () => {
    const next = computeNextCouponDate({
      ...TCB2528,
      nextCouponDateOverride: null,
      lastPaidCouponDate: new Date("2026-01-15T17:30:00.000Z"),
      today: new Date("2026-01-20T09:00:00.000Z"),
    });
    expect(iso(next)).toBe("2026-07-15");
  });
});

describe("computeCouponPeriodIndex", () => {
  test("đánh số kỳ 1-based theo lịch hợp đồng", () => {
    expect(computeCouponPeriodIndex(TCB2528, utc("2026-01-15"))).toBe(1);
    expect(computeCouponPeriodIndex(TCB2528, utc("2026-07-15"))).toBe(2);
    expect(computeCouponPeriodIndex(TCB2528, utc("2029-01-15"))).toBe(7);
  });

  test("ngày lệch hợp đồng -> không đánh số được (vẫn hợp lệ để ghi)", () => {
    expect(computeCouponPeriodIndex(TCB2528, utc("2026-07-20"))).toBeNull();
  });
});

describe("countRemainingCouponPeriods", () => {
  test("đếm từ kỳ kế tiếp tới hết đáo hạn", () => {
    expect(countRemainingCouponPeriods(TCB2528, utc("2026-03-01"))).toBe(6);
    expect(countRemainingCouponPeriods(TCB2528, utc("2028-08-01"))).toBe(1);
    expect(countRemainingCouponPeriods(TCB2528, utc("2029-02-01"))).toBe(0);
  });

  test("zero-coupon -> null (không phải 0)", () => {
    expect(
      countRemainingCouponPeriods(
        { ...TCB2528, couponFrequencyMonths: null },
        utc("2026-03-01"),
      ),
    ).toBeNull();
  });
});
