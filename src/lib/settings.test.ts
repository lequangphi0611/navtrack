import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  parseSettingValue,
  pickEffectiveSetting,
  requireDecimalSetting,
  SETTING_KEYS,
} from "./settings";
import type { SettingKey } from "./settings";

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

// requireDecimalSetting thu hẹp Map trả về của resolveSettings() (issue #77 —
// gộp N key cùng atDate vào 1 query, dùng ở recordDividend/dividends "new"
// pages thay 2 lệnh resolveDecimalSetting song song trước đây). Nếu phần thu
// hẹp này bị revert về `as Decimal` ẩu, test "ném lỗi..." bên dưới sẽ không
// còn phát hiện được giá trị sai kiểu (DB hỏng: cột valueType lệch so với dữ
// liệu thật) — mất luôn tín hiệu "thiếu cấu hình là lỗi, không phải mặc định"
// mà docs/domain/09-settings.md yêu cầu.
describe("requireDecimalSetting", () => {
  test("trả về đúng Decimal khi Map có giá trị kiểu Decimal cho key", () => {
    const settings = new Map<SettingKey, ReturnType<typeof parseSettingValue>>([
      [SETTING_KEYS.DIVIDEND_PAR_VALUE, new Decimal("10000")],
    ]);

    const result = requireDecimalSetting(
      settings,
      SETTING_KEYS.DIVIDEND_PAR_VALUE,
    );

    expect(result).toBeInstanceOf(Decimal);
    expect(result.toString()).toBe("10000");
  });

  test("ném AppError khi giá trị trong Map không phải Decimal (vd STRING/số nguyên)", () => {
    const settings = new Map<SettingKey, ReturnType<typeof parseSettingValue>>([
      [SETTING_KEYS.DIVIDEND_TAX_RATE, 5],
    ]);

    expect(() =>
      requireDecimalSetting(settings, SETTING_KEYS.DIVIDEND_TAX_RATE),
    ).toThrow(/không phải kiểu DECIMAL/);
  });

  test("ném AppError khi key không tồn tại trong Map (thiếu resolve, không mặc định undefined)", () => {
    const settings = new Map<
      SettingKey,
      ReturnType<typeof parseSettingValue>
    >();

    expect(() =>
      requireDecimalSetting(settings, SETTING_KEYS.DIVIDEND_PAR_VALUE),
    ).toThrow(/không phải kiểu DECIMAL/);
  });
});
