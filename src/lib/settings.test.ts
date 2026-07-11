import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { parseSettingValue, pickEffectiveSetting } from "./settings";

describe("pickEffectiveSetting", () => {
  test("chọn dòng có effectiveFrom lớn nhất mà <= atDate", () => {
    const rows = [
      {
        value: "5",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2025-01-01"),
      },
      {
        value: "6",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2026-01-01"),
      },
    ];

    expect(pickEffectiveSetting(rows, new Date("2025-06-01"))?.value).toBe("5");
    expect(pickEffectiveSetting(rows, new Date("2026-06-01"))?.value).toBe("6");
  });

  test("không có dòng nào effectiveFrom <= atDate thì trả về null", () => {
    const rows = [
      {
        value: "5",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2026-01-01"),
      },
    ];

    expect(pickEffectiveSetting(rows, new Date("2025-01-01"))).toBeNull();
  });

  test("effectiveFrom trùng đúng atDate vẫn được chọn (so sánh <=, không phải <)", () => {
    const rows = [
      {
        value: "5",
        valueType: "DECIMAL" as const,
        effectiveFrom: new Date("2026-01-01"),
      },
    ];

    expect(pickEffectiveSetting(rows, new Date("2026-01-01"))?.value).toBe("5");
  });
});

describe("parseSettingValue", () => {
  test("DECIMAL", () => {
    expect(parseSettingValue("0.1", "DECIMAL")).toEqual(new Decimal("0.1"));
  });

  test("DECIMAL không hợp lệ ném lỗi thay vì trả NaN", () => {
    expect(() => parseSettingValue("not-a-number", "DECIMAL")).toThrow();
  });

  test("INT", () => {
    expect(parseSettingValue("10", "INT")).toBe(10);
  });

  test("INT không hợp lệ ném lỗi", () => {
    expect(() => parseSettingValue("not-a-number", "INT")).toThrow();
  });

  test("BOOLEAN", () => {
    expect(parseSettingValue("true", "BOOLEAN")).toBe(true);
    expect(parseSettingValue("false", "BOOLEAN")).toBe(false);
  });

  test("DATE", () => {
    expect(parseSettingValue("2026-01-01", "DATE")).toEqual(
      new Date("2026-01-01"),
    );
  });

  test("STRING", () => {
    expect(parseSettingValue("hello", "STRING")).toBe("hello");
  });
});
