import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  buildPositionEvents,
  buildQuantityTimeline,
  cashflowPositionDelta,
  dividendPositionDelta,
  PENDING_EVENT_CREATED_AT,
  SETTLEMENT_RANK,
} from "./position-trail";
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
        createdAt: PENDING_EVENT_CREATED_AT,
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

// Quy tắc dấu delta — nguồn DUY NHẤT dùng ở derivePosition() (lib/cost-basis.ts)
// và buildPositionEvents() bên dưới (docs/rules/clean-code.md mục 1).
describe("cashflowPositionDelta", () => {
  test("BUY -> delta dương", () => {
    const delta = cashflowPositionDelta({
      type: "BUY",
      quantity: new Decimal(100),
    });
    expect(delta.toString()).toBe("100");
  });

  test("SELL -> delta âm", () => {
    const delta = cashflowPositionDelta({
      type: "SELL",
      quantity: new Decimal(30),
    });
    expect(delta.toString()).toBe("-30");
  });

  test("MATURITY hành xử như SELL -> delta âm (process/phase-7.md mục 2)", () => {
    const delta = cashflowPositionDelta({
      type: "MATURITY",
      quantity: new Decimal(40),
    });
    expect(delta.toString()).toBe("-40");
  });
});

describe("dividendPositionDelta", () => {
  test("STOCK -> delta = stockQuantity", () => {
    const delta = dividendPositionDelta({
      type: "STOCK",
      stockQuantity: new Decimal(7),
    });
    expect(delta.toString()).toBe("7");
  });

  test("CASH -> delta 0 (không đổi SL)", () => {
    const delta = dividendPositionDelta({ type: "CASH", stockQuantity: null });
    expect(delta.toString()).toBe("0");
  });

  test("BOND_COUPON -> delta 0 (trái tức là dòng tiền, không đổi SL)", () => {
    const delta = dividendPositionDelta({
      type: "BOND_COUPON",
      stockQuantity: null,
    });
    expect(delta.toString()).toBe("0");
  });
});

describe("buildPositionEvents", () => {
  test("trộn Cashflow + Dividend theo đúng quy tắc delta, marker giữ delta=0", () => {
    const events = buildPositionEvents({
      cashflows: [
        {
          id: "buy-1",
          type: "BUY",
          date: d(1),
          createdAt: d(1),
          quantity: new Decimal(100),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: d(5),
          createdAt: d(5),
          quantity: new Decimal(20),
        },
      ],
      dividends: [
        {
          id: "div-stock-1",
          type: "STOCK",
          date: d(3),
          createdAt: d(3),
          stockQuantity: new Decimal(10),
        },
        {
          id: "div-cash-1",
          type: "CASH",
          date: d(4),
          createdAt: d(4),
          stockQuantity: null,
        },
      ],
      markers: [{ id: "marker-1", date: d(6), createdAt: d(6) }],
    });

    const byId = new Map(events.map((e) => [e.id, e.delta.toString()]));
    expect(byId.get("buy-1")).toBe("100");
    expect(byId.get("sell-1")).toBe("-20");
    expect(byId.get("div-stock-1")).toBe("10");
    expect(byId.get("div-cash-1")).toBe("0");
    expect(byId.get("marker-1")).toBe("0");

    // Trộn xong phải phát lại đúng qua buildQuantityTimeline (marker chỉ để đọc,
    // không đổi SL): 100 (buy) +10 (div STOCK) -20 (sell) = 90 tại marker.
    const timeline = buildQuantityTimeline(events);
    expect(timeline.get("marker-1")?.before.toString()).toBe("90");
  });

  test("markers mặc định rỗng khi không truyền", () => {
    const events = buildPositionEvents({ cashflows: [], dividends: [] });
    expect(events).toEqual([]);
  });
});

// Issue #101 — trái tức kỳ cuối trùng ngày đáo hạn (docs/domain/03-dividends.md
// "Ca biên", process/phase-7.md mục 3). Đây là ca sai ÂM THẦM: không có lỗi,
// không có cảnh báo, chỉ ra 0 đồng — nên phải khoá bằng test.
describe("thứ tự Dividend vs Cashflow{MATURITY} cùng ngày", () => {
  // MATURITY được ghi TRƯỚC (createdAt sớm hơn) nhưng vẫn phải xếp SAU trái
  // tức cùng ngày — nếu tie-break vẫn theo createdAt như trước, "SL tại ngày
  // trả lãi" đọc ra 0 và trái tức kỳ cuối tính ra 0 đồng.
  test("MATURITY xếp sau trái tức dù được ghi trước", () => {
    const events = buildPositionEvents({
      cashflows: [
        {
          id: "buy-1",
          type: "BUY",
          date: d(1),
          createdAt: d(1),
          quantity: new Decimal(2),
        },
        {
          id: "maturity-1",
          type: "MATURITY",
          date: d(15),
          // Ghi lúc 10:00 — SỚM hơn trái tức bên dưới.
          createdAt: new Date("2024-01-20T10:00:00.000Z"),
          quantity: new Decimal(2),
        },
      ],
      dividends: [
        {
          id: "coupon-cuoi",
          type: "BOND_COUPON",
          date: d(15),
          // Ghi lúc 11:00 — MUỘN hơn maturity ở trên.
          createdAt: new Date("2024-01-20T11:00:00.000Z"),
          stockQuantity: null,
        },
      ],
    });

    const timeline = buildQuantityTimeline(events);

    // Trái tức đọc số dư TRƯỚC khi tất toán -> 2 trái phiếu, không phải 0.
    expect(timeline.get("coupon-cuoi")?.before.toString()).toBe("2");
    // Tất toán mới là sự kiện đưa số lượng về 0.
    expect(timeline.get("maturity-1")?.before.toString()).toBe("2");
    expect(timeline.get("maturity-1")?.after.toString()).toBe("0");
  });

  // Probe "đang ghi trái tức" (PENDING_EVENT_CREATED_AT — createdAt xa nhất có
  // thể) vẫn phải đứng trước MATURITY đã ghi cùng ngày: hạng thắng createdAt.
  test("probe ghi trái tức đọc SL trước MATURITY đã tồn tại cùng ngày", () => {
    const events = buildPositionEvents({
      cashflows: [
        {
          id: "buy-1",
          type: "BUY",
          date: d(1),
          createdAt: d(1),
          quantity: new Decimal(2),
        },
        {
          id: "maturity-1",
          type: "MATURITY",
          date: d(15),
          createdAt: d(15),
          quantity: new Decimal(2),
        },
      ],
      dividends: [],
      markers: [
        { id: "probe", date: d(15), createdAt: PENDING_EVENT_CREATED_AT },
      ],
    });

    const timeline = buildQuantityTimeline(events);
    expect(timeline.get("probe")?.before.toString()).toBe("2");
  });

  // Candidate MATURITY (đang ghi, chưa lưu DB) phải đứng SAU trái tức cùng ngày
  // đã ghi trước đó — caller truyền rank qua marker.
  test("candidate MATURITY nhận SETTLEMENT_RANK đứng sau dividend cùng ngày", () => {
    const events = buildPositionEvents({
      cashflows: [
        {
          id: "buy-1",
          type: "BUY",
          date: d(1),
          createdAt: d(1),
          quantity: new Decimal(2),
        },
      ],
      dividends: [
        {
          id: "coupon-cuoi",
          type: "BOND_COUPON",
          date: d(15),
          createdAt: PENDING_EVENT_CREATED_AT,
          stockQuantity: null,
        },
      ],
      markers: [
        {
          id: "candidate-maturity",
          date: d(15),
          createdAt: d(15),
          rank: SETTLEMENT_RANK,
        },
      ],
    });

    const timeline = buildQuantityTimeline(events);
    expect(timeline.get("candidate-maturity")?.before.toString()).toBe("2");
  });
});
