import { describe, expect, test } from "vitest";

import { cashflowActionLabel } from "./cashflow-label";

describe("cashflowActionLabel", () => {
  test("BUY -> Mua", () => {
    expect(cashflowActionLabel("BUY")).toBe("Mua");
  });

  test("SELL -> Bán", () => {
    expect(cashflowActionLabel("SELL")).toBe("Bán");
  });

  test("MATURITY -> Đáo hạn", () => {
    expect(cashflowActionLabel("MATURITY")).toBe("Đáo hạn");
  });
});
