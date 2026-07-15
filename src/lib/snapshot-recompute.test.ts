import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  computeRecomputedComparison,
  RECOMPUTE_DELTA_THRESHOLD,
  type RecomputeHoldingInput,
} from "./snapshot-recompute";

describe("computeRecomputedComparison", () => {
  test("giá không đổi từ lúc chốt — delta 0, trả null (3c, không hiện khối so sánh)", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(100),
        currentPrice: new Decimal(100),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1000000),
      "11/07",
    );

    expect(result).toBeNull();
  });

  test("delta dưới ngưỡng 1 VND — vẫn trả null (tránh 3f giả do sai số làm tròn)", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(100),
        // Lệch cực nhỏ, không đủ tạo ra chênh lệch >= 1đ ở tổng.
        currentPrice: new Decimal("100.0000001"),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1000000),
      "11/07",
    );

    expect(result).toBeNull();
  });

  test("delta đúng bằng ngưỡng (1 VND) — KHÔNG trả null (ngưỡng dùng lt, không phải lte)", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(100),
        currentPrice: new Decimal(100).plus(
          RECOMPUTE_DELTA_THRESHOLD.div(10000),
        ), // quantity=10000 -> delta đúng 1đ
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1000000),
      "11/07",
    );

    expect(result).not.toBeNull();
    expect(result?.deltaAmount).toBe("1");
  });

  test("giá tăng — trả đúng recomputedValue/deltaAmount/deltaNote (3f)", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000), // quantity = 1000000/100 = 10000
        historicalPrice: new Decimal(100),
        currentPrice: new Decimal(110),
      },
      {
        frozenValue: new Decimal(500000), // quantity = 500000/50 = 10000
        historicalPrice: new Decimal(50),
        currentPrice: new Decimal(50),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1500000),
      "11/07",
    );

    // 10000*110 + 10000*50 = 1100000 + 500000 = 1600000
    expect(result).toEqual({
      recomputedValue: "1600000",
      deltaAmount: "100000",
      deltaNote: "nếu dùng giá 11/07",
    });
  });

  test("giá giảm — deltaAmount âm", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(100),
        currentPrice: new Decimal(90),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1000000),
      "11/07",
    );

    expect(result?.recomputedValue).toBe("900000");
    expect(result?.deltaAmount).toBe("-100000");
  });

  test("thiếu historicalPrice — fallback giữ nguyên frozenValue cho holding đó, không NaN/throw", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: null,
        currentPrice: new Decimal(200),
      },
      {
        frozenValue: new Decimal(500000),
        historicalPrice: new Decimal(50),
        currentPrice: new Decimal(60),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(1500000),
      "11/07",
    );

    // Holding 1 giữ nguyên 1000000 (thiếu giá lịch sử), holding 2 recompute
    // = (500000/50)*60 = 600000. Tổng = 1600000.
    expect(result?.recomputedValue).toBe("1600000");
  });

  test("thiếu currentPrice — fallback giữ nguyên frozenValue cho holding đó", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(100),
        currentPrice: null,
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(900000),
      "11/07",
    );

    expect(result?.recomputedValue).toBe("1000000");
    expect(result?.deltaAmount).toBe("100000");
  });

  test("historicalPrice = 0 — fallback giữ nguyên frozenValue (tránh chia 0)", () => {
    const holdings: RecomputeHoldingInput[] = [
      {
        frozenValue: new Decimal(1000000),
        historicalPrice: new Decimal(0),
        currentPrice: new Decimal(200),
      },
    ];

    const result = computeRecomputedComparison(
      holdings,
      new Decimal(900000),
      "11/07",
    );

    expect(result?.recomputedValue).toBe("1000000");
  });

  test("danh sách holdings rỗng — recomputedValue 0, delta so với frozenAggregateValue", () => {
    const result = computeRecomputedComparison([], new Decimal(500), "11/07");

    expect(result).toEqual({
      recomputedValue: "0",
      deltaAmount: "-500",
      deltaNote: "nếu dùng giá 11/07",
    });
  });
});
