import { describe, expect, test } from "vitest";

import { groupHoldingsByType } from "./group-holdings";
import type { HoldingSummary } from "./types";

function makeHolding(overrides: Partial<HoldingSummary>): HoldingSummary {
  return {
    id: "id",
    symbol: "FPT",
    name: null,
    type: "STOCK",
    unit: "cổ phần",
    quantity: "100",
    avgCost: "100000",
    totalCostBasis: "10000000",
    ...overrides,
  };
}

describe("groupHoldingsByType", () => {
  test("gom theo type, thứ tự cố định STOCK, FUND, BOND, GOLD", () => {
    const holdings = [
      makeHolding({ id: "1", symbol: "SJC", type: "GOLD" }),
      makeHolding({ id: "2", symbol: "TCB", type: "BOND" }),
      makeHolding({ id: "3", symbol: "FPT", type: "STOCK" }),
      makeHolding({ id: "4", symbol: "DCDS", type: "FUND" }),
    ];

    const groups = groupHoldingsByType(holdings);

    expect(groups.map((g) => g.type)).toEqual([
      "STOCK",
      "FUND",
      "BOND",
      "GOLD",
    ]);
  });

  test("bỏ qua nhóm rỗng", () => {
    const holdings = [makeHolding({ id: "1", type: "STOCK" })];

    const groups = groupHoldingsByType(holdings);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.type).toBe("STOCK");
  });

  test("tính đúng tổng totalCostBasis mỗi nhóm", () => {
    const holdings = [
      makeHolding({ id: "1", type: "STOCK", totalCostBasis: "1000000" }),
      makeHolding({ id: "2", type: "STOCK", totalCostBasis: "2500000" }),
      makeHolding({ id: "3", type: "FUND", totalCostBasis: "500000" }),
    ];

    const groups = groupHoldingsByType(holdings);

    expect(groups.find((g) => g.type === "STOCK")?.totalCostBasis).toBe(
      "3500000",
    );
    expect(groups.find((g) => g.type === "FUND")?.totalCostBasis).toBe(
      "500000",
    );
  });

  test("giữ nguyên các holding trong nhóm (không sắp xếp lại)", () => {
    const holdings = [
      makeHolding({ id: "1", symbol: "VNM", type: "STOCK" }),
      makeHolding({ id: "2", symbol: "FPT", type: "STOCK" }),
    ];

    const groups = groupHoldingsByType(holdings);

    expect(groups[0]?.holdings.map((h) => h.symbol)).toEqual(["VNM", "FPT"]);
  });

  test("input rỗng trả về mảng rỗng", () => {
    expect(groupHoldingsByType([])).toEqual([]);
  });
});
