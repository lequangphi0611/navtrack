import { describe, expect, test } from "vitest";

import {
  addTransactionSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";

const validTransactionFields = {
  cashflowType: "BUY" as const,
  date: "2026-01-01",
  quantity: "100",
  pricePerUnit: "100000",
};

describe("newHoldingSchema", () => {
  test("chấp nhận input hợp lệ, feeAmount/taxAmount mặc định là 0", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feeAmount).toBe("0");
      expect(result.data.taxAmount).toBe("0");
    }
  });

  test("symbol rỗng bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "  ",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("type ngoài enum AssetType bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "CRYPTO",
      unit: "cổ phần",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("quantity = 0 bị từ chối (phải > 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      quantity: "0",
    });
    expect(result.success).toBe(false);
  });

  test("quantity âm bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      quantity: "-100",
    });
    expect(result.success).toBe(false);
  });

  test("quantity không phải số bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      quantity: "abc",
    });
    expect(result.success).toBe(false);
  });

  test("quantity có khoảng trắng thừa được trim và chấp nhận", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      quantity: "  100  ",
    });
    expect(result.success).toBe(true);
  });

  test("pricePerUnit = 0 bị từ chối (phải > 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      pricePerUnit: "0",
    });
    expect(result.success).toBe(false);
  });

  test("feeAmount = 0 hợp lệ (chỉ cấm âm, không cấm 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      feeAmount: "0",
    });
    expect(result.success).toBe(true);
  });

  test("feeAmount âm bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      feeAmount: "-1",
    });
    expect(result.success).toBe(false);
  });

  test("date không hợp lệ bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("addTransactionSchema", () => {
  test("thiếu holdingId bị từ chối", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("input hợp lệ được chấp nhận", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "holding-1",
      ...validTransactionFields,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateTransactionSchema", () => {
  test("thiếu cashflowId bị từ chối", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("cashflowType SELL với input hợp lệ được chấp nhận", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "cf-1",
      ...validTransactionFields,
      cashflowType: "SELL",
    });
    expect(result.success).toBe(true);
  });
});

describe("deleteTransactionSchema", () => {
  test("thiếu cashflowId bị từ chối", () => {
    expect(deleteTransactionSchema.safeParse({ cashflowId: "" }).success).toBe(
      false,
    );
  });

  test("có cashflowId được chấp nhận", () => {
    expect(
      deleteTransactionSchema.safeParse({ cashflowId: "cf-1" }).success,
    ).toBe(true);
  });
});

describe("navOverrideSchema", () => {
  test("input hợp lệ được chấp nhận", () => {
    const result = navOverrideSchema.safeParse({
      holdingId: "holding-1",
      price: "7720000",
      date: "2026-07-11",
    });
    expect(result.success).toBe(true);
  });

  test("thiếu holdingId bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "",
        price: "7720000",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("price = 0 bị từ chối (phải > 0)", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "0",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("price âm bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "-100",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("date không hợp lệ bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "7720000",
        date: "not-a-date",
      }).success,
    ).toBe(false);
  });
});
