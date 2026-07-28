import { describe, expect, test } from "vitest";

import { computeBondTermsPreview } from "./bond-terms-preview";

// Bộ số của mockup Phase 7 Screens 7a (TCB2528): mệnh giá 100tr, coupon 9%/năm,
// kỳ 6 tháng, kỳ đầu 15/01/2026, đáo hạn 15/01/2029.
const TCB2528 = {
  parValue: "100000000",
  couponRatePercent: "9",
  couponFrequencyMonths: "6",
  firstCouponDate: "2026-01-15",
  maturityDate: "2029-01-15",
};

describe("computeBondTermsPreview", () => {
  test("khớp đúng 3 con số card 'app suy ra' của mockup 7a", () => {
    const preview = computeBondTermsPreview({
      ...TCB2528,
      today: new Date("2026-03-01T00:00:00Z"),
    });

    expect(preview.couponPerPeriod).toBe("4500000");
    // 15/07/26, 15/01/27, 15/07/27, 15/01/28, 15/07/28, 15/01/29 = 6 kỳ.
    expect(preview.remainingPeriods).toBe(6);
    expect(preview.nextCouponDate).toBe("2026-07-15");
  });

  test("kỳ trùng đúng ngày đáo hạn vẫn được tính (trái tức kỳ cuối trả cùng gốc)", () => {
    const preview = computeBondTermsPreview({
      ...TCB2528,
      today: new Date("2028-08-01T00:00:00Z"),
    });

    expect(preview.remainingPeriods).toBe(1);
    expect(preview.nextCouponDate).toBe("2029-01-15");
  });

  test("đã qua đáo hạn -> không còn kỳ nào", () => {
    const preview = computeBondTermsPreview({
      ...TCB2528,
      today: new Date("2029-02-01T00:00:00Z"),
    });

    expect(preview.remainingPeriods).toBe(0);
    expect(preview.nextCouponDate).toBeNull();
  });

  test("hôm nay trước cả kỳ đầu -> kỳ kế tiếp chính là kỳ đầu", () => {
    const preview = computeBondTermsPreview({
      ...TCB2528,
      today: new Date("2025-06-01T00:00:00Z"),
    });

    expect(preview.nextCouponDate).toBe("2026-01-15");
    expect(preview.remainingPeriods).toBe(7);
  });

  test("zero-coupon (bỏ trống cụm coupon) -> chỉ còn mệnh giá, không suy lịch", () => {
    const preview = computeBondTermsPreview({
      parValue: "100000000",
      couponRatePercent: "",
      couponFrequencyMonths: "",
      firstCouponDate: "",
      maturityDate: "2029-01-15",
    });

    expect(preview.couponPerPeriod).toBeNull();
    expect(preview.remainingPeriods).toBeNull();
    expect(preview.nextCouponDate).toBeNull();
  });

  test("kỳ đầu rơi vào ngày 31 -> kẹp về ngày cuối tháng ngắn, không tràn tháng", () => {
    const preview = computeBondTermsPreview({
      parValue: "100000000",
      couponRatePercent: "10",
      couponFrequencyMonths: "1",
      firstCouponDate: "2026-01-31",
      maturityDate: "2026-04-30",
      today: new Date("2026-02-01T00:00:00Z"),
    });

    // 28/02 (kẹp), không phải 03/03 như phép cộng ngày thô của JS.
    expect(preview.nextCouponDate).toBe("2026-02-28");
  });

  test("mệnh giá/lãi suất chưa nhập -> không tính bừa số tiền", () => {
    const preview = computeBondTermsPreview({
      ...TCB2528,
      parValue: "",
    });

    expect(preview.couponPerPeriod).toBeNull();
  });
});
