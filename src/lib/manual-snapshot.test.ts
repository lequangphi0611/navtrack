import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { planManualSnapshot } from "./manual-snapshot";
import type { HoldingValuation } from "./valuation";

function valuedResult(
  nav: string,
  source: "AUTO" | "MANUAL" = "AUTO",
): HoldingValuation {
  return {
    status: "VALUED",
    nav: new Decimal(nav),
    price: new Decimal(nav),
    source,
    priceDate: new Date("2026-07-15T00:00:00.000Z"),
  };
}

const missing: HoldingValuation = { status: "MISSING_PRICE" };

describe("planManualSnapshot", () => {
  test("mọi holding đều VALUED — ghi đủ dòng, tổng đúng, không PARTIAL", () => {
    const valuations = new Map<string, HoldingValuation>([
      ["h1", valuedResult("1000000", "AUTO")],
      ["h2", valuedResult("2500000", "MANUAL")],
    ]);

    const plan = planManualSnapshot(["h1", "h2"], valuations);

    expect(plan.holdingWrites).toEqual([
      { holdingId: "h1", value: new Decimal("1000000"), source: "AUTO" },
      { holdingId: "h2", value: new Decimal("2500000"), source: "MANUAL" },
    ]);
    expect(plan.missingHoldingIds).toEqual([]);
    expect(plan.aggregate).not.toBeNull();
    expect(plan.aggregate?.value.toString()).toBe("3500000");
    expect(plan.aggregate?.isPartial).toBe(false);
  });

  test("mix VALUED/MISSING_PRICE — PARTIAL, đúng danh sách missingHoldingIds, tổng chỉ cộng phần đã biết", () => {
    const valuations = new Map<string, HoldingValuation>([
      ["h1", valuedResult("1000000")],
      ["h2", missing],
      ["h3", valuedResult("500000")],
    ]);

    const plan = planManualSnapshot(["h1", "h2", "h3"], valuations);

    expect(plan.holdingWrites.map((w) => w.holdingId)).toEqual(["h1", "h3"]);
    expect(plan.missingHoldingIds).toEqual(["h2"]);
    expect(plan.aggregate).not.toBeNull();
    expect(plan.aggregate?.value.toString()).toBe("1500000");
    expect(plan.aggregate?.isPartial).toBe(true);
  });

  test("toàn bộ MISSING_PRICE — aggregate null, không ghi dòng tổng", () => {
    const valuations = new Map<string, HoldingValuation>([
      ["h1", missing],
      ["h2", missing],
    ]);

    const plan = planManualSnapshot(["h1", "h2"], valuations);

    expect(plan.holdingWrites).toEqual([]);
    expect(plan.missingHoldingIds).toEqual(["h1", "h2"]);
    expect(plan.aggregate).toBeNull();
  });

  test("danh sách holding rỗng — aggregate = 0, isPartial false (số thật, vẫn ghi)", () => {
    const plan = planManualSnapshot([], new Map());

    expect(plan.holdingWrites).toEqual([]);
    expect(plan.missingHoldingIds).toEqual([]);
    expect(plan.aggregate).toEqual({ value: new Decimal(0), isPartial: false });
  });

  test("holdingId không có trong map valuations (phòng thủ) — coi như thiếu giá, không throw", () => {
    const plan = planManualSnapshot(["h1"], new Map());

    expect(plan.holdingWrites).toEqual([]);
    expect(plan.missingHoldingIds).toEqual(["h1"]);
    expect(plan.aggregate).toBeNull();
  });
});
