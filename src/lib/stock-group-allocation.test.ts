import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import type { HoldingValuation } from "@/lib/valuation";

import {
  computeStockGroupAllocation,
  type StockGroupAllocation,
} from "./stock-group-allocation";

function holding(
  id: string,
  symbol: string,
  type: "STOCK" | "FUND" | "BOND" | "GOLD" = "STOCK",
) {
  return {
    id,
    symbol,
    name: `${symbol} name`,
    type,
    unit: "cp",
    quantity: "100",
    avgCost: "10000",
    totalCostBasis: "1000000",
  };
}

function valued(nav: number): HoldingValuation {
  return {
    status: "VALUED",
    nav: new Decimal(nav),
    price: new Decimal(nav),
    source: "AUTO",
    priceDate: new Date("2026-08-16"),
  };
}

const missingPrice: HoldingValuation = { status: "MISSING_PRICE" };

describe("computeStockGroupAllocation", () => {
  test("mẫu số ví dụ issue #131: FPT/HPG/VNM/MWG, tổng NAV nhóm 404tr", () => {
    const holdings = [
      holding("h-fpt", "FPT"),
      holding("h-hpg", "HPG"),
      holding("h-vnm", "VNM"),
      holding("h-mwg", "MWG"),
    ];
    const valuations = new Map<string, HoldingValuation>([
      ["h-fpt", valued(180_000_000)],
      ["h-hpg", valued(95_000_000)],
      ["h-vnm", valued(74_000_000)],
      ["h-mwg", valued(55_000_000)],
    ]);

    const result = computeStockGroupAllocation(holdings, valuations);

    expect(result.groupNav.toNumber()).toBe(404_000_000);
    expect(result.missingPrice).toEqual([]);
    // Sắp giảm dần theo % — đối chiếu tay theo đúng số liệu issue #131.
    expect(result.entries.map((e) => e.symbol)).toEqual([
      "FPT",
      "HPG",
      "VNM",
      "MWG",
    ]);
    expect(result.entries[0]?.percentInGroup).toBeCloseTo(44.55, 2);
    expect(result.entries[1]?.percentInGroup).toBeCloseTo(23.51, 2);
    expect(result.entries[2]?.percentInGroup).toBeCloseTo(18.32, 2);
    expect(result.entries[3]?.percentInGroup).toBeCloseTo(13.61, 2);

    const total = result.entries.reduce((sum, e) => sum + e.percentInGroup, 0);
    expect(total).toBeCloseTo(100, 8);
  });

  test("mã MISSING_PRICE bị loại khỏi mẫu số, không suy diễn NAV=0", () => {
    const holdings = [
      holding("h-fpt", "FPT"),
      holding("h-vic", "VIC"), // thiếu giá — không tính vào mẫu số
    ];
    const valuations = new Map<string, HoldingValuation>([
      ["h-fpt", valued(180_000_000)],
      ["h-vic", missingPrice],
    ]);

    const result = computeStockGroupAllocation(holdings, valuations);

    expect(result.groupNav.toNumber()).toBe(180_000_000);
    expect(result.entries).toEqual([
      expect.objectContaining({ symbol: "FPT", percentInGroup: 100 }),
    ]);
    expect(result.missingPrice).toEqual([
      { holdingId: "h-vic", symbol: "VIC", name: "VIC name" },
    ]);
  });

  test("nhóm chỉ có 1 mã cổ phiếu -> 100% (đúng bản chất, không phải lỗi)", () => {
    const holdings = [holding("h-fpt", "FPT")];
    const valuations = new Map<string, HoldingValuation>([
      ["h-fpt", valued(180_000_000)],
    ]);

    const result: StockGroupAllocation = computeStockGroupAllocation(
      holdings,
      valuations,
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.percentInGroup).toBe(100);
  });

  test("loại holding không phải STOCK khỏi mẫu số dù có giá", () => {
    const holdings = [
      holding("h-fpt", "FPT"),
      holding("h-fund", "VESAF", "FUND"),
    ];
    const valuations = new Map<string, HoldingValuation>([
      ["h-fpt", valued(180_000_000)],
      ["h-fund", valued(999_999_999)],
    ]);

    const result = computeStockGroupAllocation(holdings, valuations);

    expect(result.groupNav.toNumber()).toBe(180_000_000);
    expect(result.entries.map((e) => e.symbol)).toEqual(["FPT"]);
  });

  test("rỗng khi nhóm cổ phiếu không có mã nào có giá", () => {
    const holdings = [holding("h-vic", "VIC")];
    const valuations = new Map<string, HoldingValuation>([
      ["h-vic", missingPrice],
    ]);

    const result = computeStockGroupAllocation(holdings, valuations);

    expect(result.groupNav.toNumber()).toBe(0);
    expect(result.entries).toEqual([]);
    expect(result.missingPrice).toEqual([
      { holdingId: "h-vic", symbol: "VIC", name: "VIC name" },
    ]);
  });
});
