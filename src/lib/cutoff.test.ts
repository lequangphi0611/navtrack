import { describe, expect, test } from "vitest";

import { resolveCutoffDate } from "./cutoff";

describe("resolveCutoffDate", () => {
  test("TODAY -> cuối ngày của now truyền vào", () => {
    const now = new Date("2026-07-12T08:30:00");
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.getFullYear()).toBe(2026);
    expect(resolved.getMonth()).toBe(6); // tháng 7 (0-index)
    expect(resolved.getDate()).toBe(12);
    expect(resolved.getHours()).toBe(23);
    expect(resolved.getMinutes()).toBe(59);
    expect(resolved.getSeconds()).toBe(59);
    expect(resolved.getMilliseconds()).toBe(999);
  });

  test("END_OF_MONTH -> ngày cuối cùng của tháng hiện tại (tháng 2 nhuận)", () => {
    const now = new Date("2028-02-10T00:00:00"); // 2028 là năm nhuận
    const resolved = resolveCutoffDate({ key: "END_OF_MONTH" }, now);

    expect(resolved.getFullYear()).toBe(2028);
    expect(resolved.getMonth()).toBe(1); // tháng 2
    expect(resolved.getDate()).toBe(29);
    expect(resolved.getHours()).toBe(23);
    expect(resolved.getMinutes()).toBe(59);
  });

  test("END_OF_MONTH -> tháng 12 vẫn đúng năm hiện tại, không tràn qua năm sau", () => {
    const now = new Date("2026-12-15T00:00:00");
    const resolved = resolveCutoffDate({ key: "END_OF_MONTH" }, now);

    expect(resolved.getFullYear()).toBe(2026);
    expect(resolved.getMonth()).toBe(11);
    expect(resolved.getDate()).toBe(31);
  });

  test("END_OF_YEAR -> 31/12 cuối ngày của năm hiện tại", () => {
    const now = new Date("2026-03-01T00:00:00");
    const resolved = resolveCutoffDate({ key: "END_OF_YEAR" }, now);

    expect(resolved.getFullYear()).toBe(2026);
    expect(resolved.getMonth()).toBe(11);
    expect(resolved.getDate()).toBe(31);
    expect(resolved.getHours()).toBe(23);
  });

  test("CUSTOM -> cuối ngày của date truyền vào, không phụ thuộc now", () => {
    const now = new Date("2026-07-12T00:00:00");
    const custom = new Date("2025-01-15T09:00:00");
    const resolved = resolveCutoffDate({ key: "CUSTOM", date: custom }, now);

    expect(resolved.getFullYear()).toBe(2025);
    expect(resolved.getMonth()).toBe(0);
    expect(resolved.getDate()).toBe(15);
    expect(resolved.getHours()).toBe(23);
    expect(resolved.getMinutes()).toBe(59);
  });

  test("không truyền now -> mặc định dùng ngày hệ thống hiện tại", () => {
    const resolved = resolveCutoffDate({ key: "TODAY" });
    const systemNow = new Date();

    expect(resolved.getFullYear()).toBe(systemNow.getFullYear());
    expect(resolved.getMonth()).toBe(systemNow.getMonth());
    expect(resolved.getDate()).toBe(systemNow.getDate());
  });
});
