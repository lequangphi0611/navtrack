import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { buildQuantityTimeline } from "./position-trail";
import type { PositionTrailEvent } from "./position-trail";

function d(days: number): Date {
  return new Date(`2024-01-${String(days).padStart(2, "0")}T00:00:00.000Z`);
}

describe("buildQuantityTimeline", () => {
  test("BUY -> SELL -> STOCK dividend cộng dồn đúng thứ tự", () => {
    const events: PositionTrailEvent[] = [
      {
        id: "buy-1",
        date: d(1),
        createdAt: d(1),
        delta: new Decimal(100),
      },
      {
        id: "sell-1",
        date: d(5),
        createdAt: d(5),
        delta: new Decimal(-30),
      },
      {
        id: "div-stock-1",
        date: d(10),
        createdAt: d(10),
        // 10% cổ tức cổ phiếu trên 70 CP đang giữ.
        delta: new Decimal(7),
      },
    ];

    const timeline = buildQuantityTimeline(events);

    expect(timeline.get("buy-1")).toEqual({
      before: new Decimal(0),
      after: new Decimal(100),
    });
    expect(timeline.get("sell-1")).toEqual({
      before: new Decimal(100),
      after: new Decimal(70),
    });
    expect(timeline.get("div-stock-1")).toEqual({
      before: new Decimal(70),
      after: new Decimal(77),
    });
  });

  test("Dividend CASH giữ chỗ (delta=0), không đổi số lượng", () => {
    const events: PositionTrailEvent[] = [
      { id: "buy-1", date: d(1), createdAt: d(1), delta: new Decimal(100) },
      { id: "div-cash-1", date: d(3), createdAt: d(3), delta: new Decimal(0) },
      { id: "sell-1", date: d(5), createdAt: d(5), delta: new Decimal(-20) },
    ];

    const timeline = buildQuantityTimeline(events);

    expect(timeline.get("div-cash-1")).toEqual({
      before: new Decimal(100),
      after: new Decimal(100),
    });
    expect(timeline.get("sell-1")?.after).toEqual(new Decimal(80));
  });

  test("trùng ngày -> dùng createdAt rồi id để phá vỡ thứ tự", () => {
    const events: PositionTrailEvent[] = [
      {
        id: "b",
        date: d(1),
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
        delta: new Decimal(10),
      },
      {
        id: "a",
        date: d(1),
        createdAt: new Date("2024-01-01T09:00:00.000Z"),
        delta: new Decimal(5),
      },
    ];

    const timeline = buildQuantityTimeline(events);

    // createdAt sớm hơn ("a") phải được áp trước, dù id "a" > "b" theo alpha
    // nếu chỉ so sánh id.
    expect(timeline.get("a")).toEqual({
      before: new Decimal(0),
      after: new Decimal(5),
    });
    expect(timeline.get("b")).toEqual({
      before: new Decimal(5),
      after: new Decimal(15),
    });
  });

  test("probe event (delta=0) tại một ngày giữa lịch sử -> before = SL tại ngày đó", () => {
    const events: PositionTrailEvent[] = [
      { id: "buy-1", date: d(1), createdAt: d(1), delta: new Decimal(100) },
      { id: "buy-2", date: d(10), createdAt: d(10), delta: new Decimal(50) },
      {
        id: "__probe__",
        date: d(5),
        createdAt: new Date(8640000000000000),
        delta: new Decimal(0),
      },
    ];

    const timeline = buildQuantityTimeline(events);

    expect(timeline.get("__probe__")?.before).toEqual(new Decimal(100));
  });

  test("input rỗng trả về Map rỗng", () => {
    expect(buildQuantityTimeline([]).size).toBe(0);
  });
});
