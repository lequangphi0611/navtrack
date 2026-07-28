import { describe, expect, test } from "vitest";

import { dividendTypeName } from "./dividend-label";

describe("dividendTypeName", () => {
  test("CASH -> Tiền mặt", () => {
    expect(dividendTypeName("CASH")).toBe("Tiền mặt");
  });

  test("STOCK -> Cổ phiếu", () => {
    expect(dividendTypeName("STOCK")).toBe("Cổ phiếu");
  });

  test("BOND_COUPON -> Trái tức", () => {
    expect(dividendTypeName("BOND_COUPON")).toBe("Trái tức");
  });
});
