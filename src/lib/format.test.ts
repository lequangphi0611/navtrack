import { describe, expect, test } from "vitest";

import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatQuantity,
} from "./format";

describe("formatMoney", () => {
  test("format số dương thành VND", () => {
    const formatted = formatMoney("10000000");
    expect(formatted).toMatch(/^10\.000\.000\s₫$/);
  });

  test("hidden = true trả về chuỗi che thay vì số tiền", () => {
    expect(formatMoney("10000000", { hidden: true })).toBe("••••••");
  });

  test("số âm vẫn format đúng dấu", () => {
    const formatted = formatMoney("-10000000");
    expect(formatted).toMatch(/^-10\.000\.000\s₫$/);
  });
});

describe("formatQuantity", () => {
  test("gắn đơn vị vào sau số lượng", () => {
    expect(formatQuantity("100", "cổ phần")).toBe("100 cổ phần");
  });

  test("giữ tối đa 4 chữ số thập phân", () => {
    expect(formatQuantity("1.5", "chỉ")).toBe("1,5 chỉ");
  });
});

describe("formatDate", () => {
  test("format dd/MM/yyyy theo giờ Asia/Ho_Chi_Minh", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00.000Z"))).toBe("01/01/2026");
  });

  test("nhận string ISO", () => {
    expect(formatDate("2026-07-09T00:00:00.000Z")).toBe("09/07/2026");
  });
});

describe("formatDayMonth", () => {
  test("format dd/MM theo giờ Asia/Ho_Chi_Minh, không kèm năm", () => {
    expect(formatDayMonth(new Date("2026-07-09T00:00:00.000Z"))).toBe("09/07");
  });
});
