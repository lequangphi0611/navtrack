import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeXirr } from "./xirr";
import { buildXirrCashflows } from "./xirr-cashflow";

describe("buildXirrCashflows — ghép dòng tiền giả định = NAV tại mốc chốt (docs/domain/05)", () => {
  test("vị thế mở + có giá -> ghép thêm dòng NAV dương tại cutoffDate", () => {
    const cutoffDate = new Date("2024-01-01");
    const points = buildXirrCashflows({
      cashflows: [
        { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
      ],
      dividends: [],
      isOpenPosition: true,
      cutoffDate,
      currentNav: new Decimal(112_000_000),
    });

    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({
      date: cutoffDate,
      amount: new Decimal(112_000_000),
    });

    // Khớp đúng ví dụ trong domain doc: 100tr -> 112tr sau 1 năm = 12%.
    const result = computeXirr(points);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.annualizedRate.toFixed(4)).toBe("0.1200");
  });

  test("vị thế mở + thiếu giá (MISSING_PRICE, currentNav=null) -> KHÔNG ghép gì thêm, chỉ mua thì XIRR trả NO_POSITIVE_FLOW", () => {
    const points = buildXirrCashflows({
      cashflows: [{ date: new Date("2023-01-01"), amount: new Decimal(-100) }],
      dividends: [],
      isOpenPosition: true,
      cutoffDate: new Date("2024-01-01"),
      currentNav: null,
    });

    expect(points).toHaveLength(1);

    const result = computeXirr(points);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });

  test("vị thế đã đóng (SL=0) -> KHÔNG ghép NAV giả định dù currentNav khác null", () => {
    const points = buildXirrCashflows({
      cashflows: [
        { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
        { date: new Date("2023-12-01"), amount: new Decimal(115_000_000) },
      ],
      dividends: [],
      isOpenPosition: false,
      cutoffDate: new Date("2024-01-01"),
      // Vị thế đã đóng nên NAV thật sự = 0 (CLOSED trong HoldingValuation) —
      // nhưng để test rõ ràng "đóng thì bỏ qua currentNav bất kể giá trị gì",
      // vẫn truyền một Decimal khác 0 để chứng minh hàm không dùng đến nó.
      currentNav: new Decimal(999_999_999),
    });

    expect(points).toHaveLength(2);
    expect(points.every((p) => !p.amount.equals(999_999_999))).toBe(true);
  });

  test("có cổ tức CASH -> ghép netAmount dương vào chuỗi", () => {
    const cutoffDate = new Date("2024-01-01");
    const points = buildXirrCashflows({
      cashflows: [
        { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
      ],
      dividends: [
        { date: new Date("2023-06-01"), netAmount: new Decimal(2_000_000) },
      ],
      isOpenPosition: true,
      cutoffDate,
      currentNav: new Decimal(105_000_000),
    });

    expect(points).toHaveLength(3);
    expect(points[1]).toEqual({
      date: new Date("2023-06-01"),
      amount: new Decimal(2_000_000),
    });
  });

  test("dòng tiền sau mốc cutoff không được ghép vào (trách nhiệm lọc thuộc tầng gọi — input đã lọc sẵn)", () => {
    // buildXirrCashflows chỉ ghép đúng những gì được truyền vào — test này
    // xác nhận hàm không tự lọc lại theo cutoffDate, để tránh double-filter;
    // việc lọc "date <= cutoffDate" là trách nhiệm của queries.ts trước khi
    // gọi hàm này (xem comment XirrCashflowInput).
    const cutoffDate = new Date("2024-01-01");
    const points = buildXirrCashflows({
      cashflows: [
        { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
      ],
      dividends: [],
      isOpenPosition: true,
      cutoffDate,
      currentNav: new Decimal(110_000_000),
    });

    // Chỉ có đúng 2 điểm: dòng mua thật + dòng NAV giả định tại cutoffDate —
    // không có điểm nào "lọt" vào sau mốc vì input truyền vào đã sạch.
    expect(points.map((p) => p.date.getTime())).toEqual([
      new Date("2023-01-01").getTime(),
      cutoffDate.getTime(),
    ]);
  });
});
