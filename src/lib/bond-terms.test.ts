import { describe, expect, test } from "vitest";

import { assertBondHoldingType } from "./bond-terms";
import { AppError } from "./settings-resolution";

describe("assertBondHoldingType", () => {
  test("throws AppError khi holdingType khác BOND", () => {
    expect(() => assertBondHoldingType("STOCK")).toThrow(AppError);
  });

  test("không throw khi holdingType là BOND", () => {
    expect(() => assertBondHoldingType("BOND")).not.toThrow();
  });
});
