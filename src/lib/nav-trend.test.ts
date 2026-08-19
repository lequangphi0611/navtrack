import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { buildNavTrendSeries, groupSnapshotRowsByType } from "./nav-trend";

const d = (value: string) => new Decimal(value);

describe("buildNavTrendSeries", () => {
  test("rỗng -> chỉ còn điểm 'hôm nay' động, changePercent = 0", () => {
    const today = new Date("2026-08-18T00:00:00.000Z");
    const result = buildNavTrendSeries([], d("100000000"), today);

    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({
      date: today.toISOString(),
      value: "100000000",
      changePercentFromStart: 0,
    });
    expect(result.changePercent).toBe(0);
  });

  test("1 điểm lịch sử + chưa có frozen hôm nay -> nối thêm điểm động hôm nay", () => {
    const today = new Date("2026-08-18T00:00:00.000Z");
    const rows = [
      { date: new Date("2026-08-01T00:00:00.000Z"), value: d("100000000") },
    ];
    const result = buildNavTrendSeries(rows, d("110000000"), today);

    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.changePercentFromStart).toBe(0);
    expect(result.points[1]?.changePercentFromStart).toBeCloseTo(10, 8);
    expect(result.changePercent).toBeCloseTo(10, 8);
  });

  test("đã có frozen row đúng hôm nay -> KHÔNG nối thêm điểm động trùng ngày", () => {
    const today = new Date("2026-08-18T00:00:00.000Z");
    const rows = [
      { date: new Date("2026-08-01T00:00:00.000Z"), value: d("100000000") },
      { date: today, value: d("120000000") },
    ];
    const result = buildNavTrendSeries(rows, d("999999999"), today);

    expect(result.points).toHaveLength(2);
    expect(result.points[1]?.value).toBe("120000000");
    expect(result.points[1]?.changePercentFromStart).toBeCloseTo(20, 8);
  });

  test("startValue = 0 -> changePercentFromStart luôn 0 (tránh chia 0)", () => {
    const today = new Date("2026-08-18T00:00:00.000Z");
    const rows = [
      { date: new Date("2026-08-01T00:00:00.000Z"), value: d("0") },
    ];
    const result = buildNavTrendSeries(rows, d("50000000"), today);

    expect(result.points[0]?.changePercentFromStart).toBe(0);
    expect(result.points[1]?.changePercentFromStart).toBe(0);
    expect(result.changePercent).toBe(0);
  });
});

describe("groupSnapshotRowsByType", () => {
  const day = (iso: string) => new Date(iso);

  test("2 holding cùng loại cùng ngày -> cộng dồn thành 1 điểm", () => {
    const rows = [
      {
        date: day("2026-08-01T00:00:00.000Z"),
        value: d("100"),
        type: "STOCK" as const,
      },
      {
        date: day("2026-08-01T00:00:00.000Z"),
        value: d("50"),
        type: "STOCK" as const,
      },
    ];
    const result = groupSnapshotRowsByType(rows);

    expect(result.STOCK).toHaveLength(1);
    expect(result.STOCK[0]?.value.toString()).toBe("150");
    expect(result.FUND).toEqual([]);
    expect(result.BOND).toEqual([]);
    expect(result.GOLD).toEqual([]);
  });

  test("kết quả sort tăng dần theo ngày, kể cả khi input không theo thứ tự", () => {
    const rows = [
      {
        date: day("2026-08-10T00:00:00.000Z"),
        value: d("200"),
        type: "GOLD" as const,
      },
      {
        date: day("2026-08-01T00:00:00.000Z"),
        value: d("100"),
        type: "GOLD" as const,
      },
    ];
    const result = groupSnapshotRowsByType(rows);

    expect(result.GOLD.map((p) => p.date.toISOString())).toEqual([
      day("2026-08-01T00:00:00.000Z").toISOString(),
      day("2026-08-10T00:00:00.000Z").toISOString(),
    ]);
  });

  test("ca MISSING_PRICE — ngày thiếu row của một holding KHÔNG bị suy diễn thành 0", () => {
    // Holding A (STOCK) chốt đủ 2 ngày; Holding B (STOCK, cùng loại) thiếu giá
    // ngày 08-05 nên KHÔNG có row nào ghi cho nó hôm đó — tổng ngày 08-05 chỉ
    // gồm A, KHÔNG bị cộng thêm 0 giả định cho B.
    const rows = [
      {
        date: day("2026-08-01T00:00:00.000Z"),
        value: d("100"),
        type: "STOCK" as const,
      }, // A
      {
        date: day("2026-08-01T00:00:00.000Z"),
        value: d("50"),
        type: "STOCK" as const,
      }, // B
      {
        date: day("2026-08-05T00:00:00.000Z"),
        value: d("120"),
        type: "STOCK" as const,
      }, // A only, B missing price
    ];
    const result = groupSnapshotRowsByType(rows);

    expect(result.STOCK).toHaveLength(2);
    expect(result.STOCK[0]?.value.toString()).toBe("150"); // 100 + 50
    expect(result.STOCK[1]?.value.toString()).toBe("120"); // chỉ A, không cộng 0 cho B
  });

  test("ca bán sạch một mã — mảng dừng ở ngày cuối còn dữ liệu, không tự chèn điểm 0", () => {
    const rows = [
      {
        date: day("2026-06-01T00:00:00.000Z"),
        value: d("100"),
        type: "BOND" as const,
      },
      {
        date: day("2026-07-01T00:00:00.000Z"),
        value: d("110"),
        type: "BOND" as const,
      },
      // Vị thế đóng sau 07-01 — không còn row nào được ghi tiếp cho BOND.
    ];
    const result = groupSnapshotRowsByType(rows);

    expect(result.BOND).toHaveLength(2);
    expect(result.BOND[result.BOND.length - 1]?.value.toString()).toBe("110");
    expect(result.BOND.some((p) => p.value.isZero())).toBe(false);
  });
});
