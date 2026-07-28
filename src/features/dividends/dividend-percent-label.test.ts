import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  deriveCouponFrequencyMonths,
  resolveParValueAt,
  roundPercentLabel,
} from "./dividend-percent-label";

describe("resolveParValueAt — mệnh giá hiệu lực tại một ngày (effective-dated)", () => {
  test("chọn đúng dòng hiệu lực gần nhất <= atDate", () => {
    const rows = [
      {
        value: "10000",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2024-01-01"),
      },
      {
        value: "12000",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2025-01-01"),
      },
    ];

    expect(resolveParValueAt(rows, new Date("2025-06-01")).toString()).toBe(
      "12000",
    );
    expect(resolveParValueAt(rows, new Date("2024-06-01")).toString()).toBe(
      "10000",
    );
  });

  test("không có dòng nào hiệu lực -> throw AppError SETTING_NOT_FOUND", () => {
    const rows = [
      {
        value: "10000",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2026-01-01"),
      },
    ];

    expect(() => resolveParValueAt(rows, new Date("2024-01-01"))).toThrowError(
      expect.objectContaining({ code: "SETTING_NOT_FOUND" }),
    );
  });

  test("dòng hiệu lực không phải kiểu DECIMAL -> throw AppError INVALID_SETTING_VALUE", () => {
    const rows = [
      {
        value: "true",
        valueType: "BOOLEAN" as const,
        effectiveFrom: new Date("2024-01-01"),
      },
    ];

    expect(() => resolveParValueAt(rows, new Date("2024-06-01"))).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTING_VALUE" }),
    );
  });
});

describe("roundPercentLabel — percentLabel suy ngược từ dữ liệu đã lưu", () => {
  test("tính đúng %, làm tròn về số nguyên gần nhất (ROUND_HALF_UP)", () => {
    expect(roundPercentLabel(new Decimal(15), new Decimal(1000))).toBe("2");
  });

  test("làm tròn lên đúng ở mốc x.5% (ROUND_HALF_UP, không round-to-even)", () => {
    // 25 / 1000 * 100 = 2.5% -> ROUND_HALF_UP luôn làm tròn lên thành 3.
    expect(roundPercentLabel(new Decimal(25), new Decimal(1000))).toBe("3");
  });

  test("mẫu số = 0 -> trả '0' thay vì chia cho 0", () => {
    expect(roundPercentLabel(new Decimal(100), new Decimal(0))).toBe("0");
  });
});

// Phase 7 (issue #58) — kỳ trả lãi của một dòng trái tức đã ghi suy NGƯỢC từ
// dữ liệu đã đóng băng trên chính dòng đó, KHÔNG đọc BondTerms hiện tại. Đây là
// cách đáp ứng tiêu chí phase "sửa BondTerms không làm đổi số tiền/NHÃN của các
// trái tức đã ghi" mà không cần thêm cột.
describe("deriveCouponFrequencyMonths", () => {
  // Bộ số mockup: 2 trái phiếu par 100tr, coupon 9%/năm, kỳ 6 tháng -> gộp 9tr.
  const TCB2528 = {
    grossAmount: new Decimal(9_000_000),
    parValueApplied: new Decimal(100_000_000),
    couponRatePercentApplied: new Decimal(9),
    quantityAtDate: new Decimal(2),
  };

  test("suy đúng kỳ 6 tháng từ gộp/mệnh giá/lãi suất/SL", () => {
    expect(deriveCouponFrequencyMonths(TCB2528)).toBe(6);
  });

  test("suy đúng kỳ 12 tháng (gộp gấp đôi cùng bộ thông số)", () => {
    expect(
      deriveCouponFrequencyMonths({
        ...TCB2528,
        grossAmount: new Decimal(18_000_000),
      }),
    ).toBe(12);
  });

  test("kỳ 3 tháng", () => {
    expect(
      deriveCouponFrequencyMonths({
        ...TCB2528,
        grossAmount: new Decimal(4_500_000),
      }),
    ).toBe(3);
  });

  // Số tiền đã bị sửa tay khỏi công thức -> không bịa ra một kỳ trả lãi không
  // có thật, thà ẩn phần "· kỳ N tháng" đi.
  test("số tiền lệch công thức -> null thay vì làm tròn bừa", () => {
    expect(
      deriveCouponFrequencyMonths({
        ...TCB2528,
        grossAmount: new Decimal(7_777_777),
      }),
    ).toBeNull();
  });

  test("SL tại ngày ghi = 0 -> null, không chia cho 0", () => {
    expect(
      deriveCouponFrequencyMonths({
        ...TCB2528,
        quantityAtDate: new Decimal(0),
      }),
    ).toBeNull();
  });
});
