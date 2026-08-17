import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import type { HoldingValuation } from "@/lib/valuation";

import { computeAllocationGroupDetails } from "./allocation-group-pnl";

function holding(
  id: string,
  symbol: string,
  type: "STOCK" | "FUND" | "BOND" | "GOLD",
  totalCostBasis: string,
) {
  return {
    id,
    symbol,
    name: `${symbol} name`,
    type,
    unit: "cp",
    quantity: "100",
    avgCost: "10000",
    totalCostBasis,
  };
}

function valued(nav: number): HoldingValuation {
  return {
    status: "VALUED",
    nav: new Decimal(nav),
    price: new Decimal(nav),
    source: "AUTO",
    priceDate: new Date("2026-08-17"),
  };
}

const missingPrice: HoldingValuation = { status: "MISSING_PRICE" };

// Sample bám process/UI_allocation-group-pnl.md (mockup 130a):
//   STOCK  NAV=60.000.000  pnl=+8.000.000  -> costBasis=52.000.000  pnlPercent≈+15,4%
//   FUND   NAV=25.000.000  pnl=-2.500.000  -> costBasis=27.500.000  pnlPercent≈-9,1%
//   BOND   NAV=costBasis=20.000.000        -> pnl=0                 pnlPercent=0
//   GOLD   NAV=10.000.000  pnl=+1.800.000  -> costBasis=8.200.000   pnlPercent≈+22,0%
// Tổng NAV = 115.000.000 -> percent: 52,2% / 21,7% / 17,4% / 8,7%
const NAV_SUM = new Decimal(115_000_000);

function fullSampleHoldings() {
  return [
    holding("h-stock", "FPT", "STOCK", "52000000"),
    holding("h-fund", "VESAF", "FUND", "27500000"),
    holding("h-bond", "TPCP01", "BOND", "20000000"),
    holding("h-gold", "SJC", "GOLD", "8200000"),
  ];
}

function fullSampleValuations() {
  return new Map<string, HoldingValuation>([
    ["h-stock", valued(60_000_000)],
    ["h-fund", valued(25_000_000)],
    ["h-bond", valued(20_000_000)],
    ["h-gold", valued(10_000_000)],
  ]);
}

describe("computeAllocationGroupDetails", () => {
  test("mẫu đầy đủ dữ liệu (mockup 130a) — 4 nhóm khớp số tính tay", () => {
    const result = computeAllocationGroupDetails(
      fullSampleHoldings(),
      fullSampleValuations(),
      NAV_SUM,
    );

    expect(result.map((r) => r.type)).toEqual([
      "STOCK",
      "FUND",
      "BOND",
      "GOLD",
    ]);

    const stock = result.find((r) => r.type === "STOCK");
    expect(stock?.navAmount.toNumber()).toBe(60_000_000);
    expect(stock?.costBasisPriced.toNumber()).toBe(52_000_000);
    expect(stock?.pnlAmount.toNumber()).toBe(8_000_000);
    // 8.000.000 / 52.000.000 * 100 = 15,3846...%
    expect(stock?.pnlPercent).toBeCloseTo(15.38, 2);
    // 60.000.000 / 115.000.000 * 100 = 52,1739...%
    expect(stock?.percent).toBeCloseTo(52.17, 2);
    expect(stock?.navIsPartial).toBe(false);
    expect(stock?.pricedCount).toBe(1);
    expect(stock?.totalCount).toBe(1);
    expect(stock?.missingSymbols).toEqual([]);

    const fund = result.find((r) => r.type === "FUND");
    expect(fund?.navAmount.toNumber()).toBe(25_000_000);
    expect(fund?.costBasisPriced.toNumber()).toBe(27_500_000);
    expect(fund?.pnlAmount.toNumber()).toBe(-2_500_000);
    // -2.500.000 / 27.500.000 * 100 = -9,0909...%
    expect(fund?.pnlPercent).toBeCloseTo(-9.09, 2);
    // 25.000.000 / 115.000.000 * 100 = 21,7391...%
    expect(fund?.percent).toBeCloseTo(21.74, 2);

    const bond = result.find((r) => r.type === "BOND");
    expect(bond?.navAmount.toNumber()).toBe(20_000_000);
    expect(bond?.costBasisPriced.toNumber()).toBe(20_000_000);
    expect(bond?.pnlAmount.toNumber()).toBe(0);
    expect(bond?.pnlPercent).toBe(0);
    // 20.000.000 / 115.000.000 * 100 = 17,3913...%
    expect(bond?.percent).toBeCloseTo(17.39, 2);

    const gold = result.find((r) => r.type === "GOLD");
    expect(gold?.navAmount.toNumber()).toBe(10_000_000);
    expect(gold?.costBasisPriced.toNumber()).toBe(8_200_000);
    expect(gold?.pnlAmount.toNumber()).toBe(1_800_000);
    // 1.800.000 / 8.200.000 * 100 = 21,9512...%
    expect(gold?.pnlPercent).toBeCloseTo(21.95, 2);
    // 10.000.000 / 115.000.000 * 100 = 8,6956...%
    expect(gold?.percent).toBeCloseTo(8.7, 2);
  });

  test("mã thiếu giá trong nhóm (mockup 130b) — loại khỏi NAV/lãi-lỗ nhưng KHÔNG đổi percent", () => {
    // Nhóm STOCK: 2 mã đã có giá (giống hệt sample đầy đủ, NAV=60tr/cost=52tr)
    // + 1 mã MISSING_PRICE (MWG) không đóng góp gì.
    const holdingsWithMissing = [
      holding("h-stock-1", "FPT", "STOCK", "30000000"),
      holding("h-stock-2", "HPG", "STOCK", "22000000"),
      holding("h-stock-mwg", "MWG", "STOCK", "999999999"), // cost basis không dùng vì thiếu giá
      holding("h-fund", "VESAF", "FUND", "27500000"),
      holding("h-bond", "TPCP01", "BOND", "20000000"),
      holding("h-gold", "SJC", "GOLD", "8200000"),
    ];
    const valuationsWithMissing = new Map<string, HoldingValuation>([
      ["h-stock-1", valued(35_000_000)],
      ["h-stock-2", valued(25_000_000)],
      ["h-stock-mwg", missingPrice],
      ["h-fund", valued(25_000_000)],
      ["h-bond", valued(20_000_000)],
      ["h-gold", valued(10_000_000)],
    ]);

    const resultWithMissing = computeAllocationGroupDetails(
      holdingsWithMissing,
      valuationsWithMissing,
      NAV_SUM,
    );
    const stockWithMissing = resultWithMissing.find((r) => r.type === "STOCK");
    expect(stockWithMissing?.navAmount.toNumber()).toBe(60_000_000);
    expect(stockWithMissing?.costBasisPriced.toNumber()).toBe(52_000_000);
    expect(stockWithMissing?.navIsPartial).toBe(true);
    expect(stockWithMissing?.pricedCount).toBe(2);
    expect(stockWithMissing?.totalCount).toBe(3);
    expect(stockWithMissing?.missingSymbols).toEqual(["MWG"]);

    // So sánh với trường hợp KHÔNG có MWG (chỉ 2 mã đã có giá, cùng navSum) —
    // percent phải giống hệt vì tử số (navAmount) không đổi và navSum là tham
    // số ngoài, không phụ thuộc mã thiếu giá trong CHÍNH nhóm này.
    const resultWithoutMissing = computeAllocationGroupDetails(
      fullSampleHoldings(),
      fullSampleValuations(),
      NAV_SUM,
    );
    const stockWithoutMissing = resultWithoutMissing.find(
      (r) => r.type === "STOCK",
    );
    expect(stockWithMissing?.percent).toBeCloseTo(
      stockWithoutMissing?.percent ?? NaN,
      10,
    );
  });

  test("nhóm 100% mã MISSING_PRICE bị loại hẳn khỏi kết quả", () => {
    const holdings = [
      ...fullSampleHoldings(),
      holding("h-gold-2", "SJC02", "GOLD", "5000000"),
    ];
    // Ghi đè toàn bộ GOLD thành thiếu giá — xoá h-gold khỏi valued, thêm mã
    // GOLD thứ 2 cũng thiếu giá.
    const valuations = new Map<string, HoldingValuation>([
      ["h-stock", valued(60_000_000)],
      ["h-fund", valued(25_000_000)],
      ["h-bond", valued(20_000_000)],
      ["h-gold", missingPrice],
      ["h-gold-2", missingPrice],
    ]);

    const result = computeAllocationGroupDetails(
      holdings,
      valuations,
      new Decimal(105_000_000), // NAV toàn danh mục không còn phần GOLD (thiếu giá cả nhóm)
    );

    expect(result.map((r) => r.type)).toEqual(["STOCK", "FUND", "BOND"]);
    expect(result.find((r) => r.type === "GOLD")).toBeUndefined();
  });

  test("costBasisPriced = 0 -> pnlPercent = 0, không throw/NaN/Infinity", () => {
    const holdings = [holding("h-gold", "SJC", "GOLD", "0")];
    const valuations = new Map<string, HoldingValuation>([
      ["h-gold", valued(500_000)],
    ]);

    const result = computeAllocationGroupDetails(
      holdings,
      valuations,
      new Decimal(500_000),
    );

    const gold = result.find((r) => r.type === "GOLD");
    expect(gold?.costBasisPriced.toNumber()).toBe(0);
    expect(gold?.pnlAmount.toNumber()).toBe(500_000);
    expect(gold?.pnlPercent).toBe(0);
    expect(Number.isFinite(gold?.pnlPercent)).toBe(true);
  });

  test("tổng toàn trang: Σ pnlAmount / Σ costBasisPriced qua 4 nhóm sample ≈ +6,8%", () => {
    const result = computeAllocationGroupDetails(
      fullSampleHoldings(),
      fullSampleValuations(),
      NAV_SUM,
    );

    const totalPnlAmount = result.reduce(
      (sum, r) => sum.plus(r.pnlAmount),
      new Decimal(0),
    );
    const totalCostBasisPriced = result.reduce(
      (sum, r) => sum.plus(r.costBasisPriced),
      new Decimal(0),
    );

    // Σ pnlAmount = 8.000.000 - 2.500.000 + 0 + 1.800.000 = 7.300.000
    expect(totalPnlAmount.toNumber()).toBe(7_300_000);
    // Σ costBasisPriced = 52.000.000 + 27.500.000 + 20.000.000 + 8.200.000 = 107.700.000
    expect(totalCostBasisPriced.toNumber()).toBe(107_700_000);

    const totalPnlPercent = totalCostBasisPriced.isZero()
      ? 0
      : totalPnlAmount.div(totalCostBasisPriced).mul(100).toNumber();
    // 7.300.000 / 107.700.000 * 100 = 6,7780...%
    expect(totalPnlPercent).toBeCloseTo(6.78, 2);
  });
});
