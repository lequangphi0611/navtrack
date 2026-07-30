import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { resolveParValueAt, roundPercentLabel } from "./dividend-percent-label";

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
