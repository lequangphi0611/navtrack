import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { resolvePrice, valuateHolding } from "./valuation";

describe("resolvePrice", () => {
  test("có cả NavOverride lẫn PriceQuote -> chọn NavOverride (MANUAL), kể cả khi PriceQuote mới hơn", () => {
    const resolved = resolvePrice(
      { date: new Date("2026-06-30"), price: new Decimal(7_720_000) },
      { date: new Date("2026-07-11"), price: new Decimal(178_900) },
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.source).toBe("MANUAL");
    expect(resolved?.price.toString()).toBe("7720000");
    expect(resolved?.priceDate).toEqual(new Date("2026-06-30"));
  });

  test("chỉ có PriceQuote -> AUTO", () => {
    const resolved = resolvePrice(null, {
      date: new Date("2026-07-10"),
      price: new Decimal(178_900),
    });

    expect(resolved?.source).toBe("AUTO");
    expect(resolved?.price.toString()).toBe("178900");
    expect(resolved?.priceDate).toEqual(new Date("2026-07-10"));
  });

  test("chỉ có NavOverride -> MANUAL", () => {
    const resolved = resolvePrice(
      { date: new Date("2026-07-01"), price: new Decimal(80_000_000) },
      null,
    );

    expect(resolved?.source).toBe("MANUAL");
    expect(resolved?.price.toString()).toBe("80000000");
  });

  test("không có nguồn nào -> null", () => {
    expect(resolvePrice(null, null)).toBeNull();
  });
});

describe("valuateHolding", () => {
  test("SL > 0, có giá -> VALUED, nav = quantity * price", () => {
    const valuation = valuateHolding(new Decimal(4200), {
      price: new Decimal(178_900),
      source: "AUTO",
      priceDate: new Date("2026-07-10"),
    });

    expect(valuation.status).toBe("VALUED");
    if (valuation.status === "VALUED") {
      expect(valuation.nav.toString()).toBe("751380000");
      expect(valuation.source).toBe("AUTO");
      expect(valuation.priceDate).toEqual(new Date("2026-07-10"));
    }
  });

  test("SL > 0, không có giá -> MISSING_PRICE, không phải NAV=0", () => {
    const valuation = valuateHolding(new Decimal(45), null);

    expect(valuation.status).toBe("MISSING_PRICE");
  });

  test("SL = 0, không có giá -> CLOSED, nav=0", () => {
    const valuation = valuateHolding(new Decimal(0), null);

    expect(valuation.status).toBe("CLOSED");
    if (valuation.status === "CLOSED") {
      expect(valuation.nav.toString()).toBe("0");
    }
  });

  test("SL = 0, vẫn có giá -> CLOSED, nav=0 (giá không còn ý nghĩa với vị thế đã đóng)", () => {
    const valuation = valuateHolding(new Decimal(0), {
      price: new Decimal(178_900),
      source: "AUTO",
      priceDate: new Date("2026-07-10"),
    });

    expect(valuation.status).toBe("CLOSED");
    if (valuation.status === "CLOSED") {
      expect(valuation.nav.toString()).toBe("0");
    }
  });
});
