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

  // Phase 5 (docs/domain/07-tax.md "Quy tắc & bất biến"): VN không đánh thuế
  // TNCN khi mua — server phải chặn taxAmount khác 0 cho BUY dù request tới
  // bằng cách nào (không tin client, form chỉ ẩn field ở UI). Nếu refine này
  // bị revert/xoá, test dưới sẽ fail vì input rõ ràng phải bị từ chối.
  test("BUY kèm taxAmount khác 0 bị từ chối (VN không đánh thuế khi mua)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "5200",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "taxAmount",
      );
      expect(issue?.message).toBe("Giao dịch mua không có thuế");
    }
  });

  test("BUY với taxAmount = 0 (mặc định) được chấp nhận", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      cashflowType: "BUY",
    });
    expect(result.success).toBe(true);
  });

  // buyHasNoTax so sánh bằng giá trị Decimal, không phải string "=== 0" —
  // các biểu diễn khác của 0 vẫn phải được chấp nhận cho BUY.
  test('BUY với taxAmount = "0.00" (biểu diễn khác của 0) được chấp nhận', () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "0.00",
    });
    expect(result.success).toBe(true);
  });

  test("SELL kèm taxAmount khác 0 được chấp nhận (thuế bán hợp lệ)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      cashflowType: "SELL",
      taxAmount: "5200",
    });
    expect(result.success).toBe(true);
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

  // Cùng bất biến với newHoldingSchema ở trên — addTransaction là đường ghi
  // giao dịch cho holding ĐÃ TỒN TẠI, cùng lỗ hổng nếu thiếu refine.
  test("BUY kèm taxAmount khác 0 bị từ chối", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "holding-1",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "1000",
    });
    expect(result.success).toBe(false);
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

  // Ca quan trọng nhất trong 3 schema: sửa MỘT giao dịch đã ghi từ SELL (có
  // taxAmount > 0) sang BUY qua form sửa — server phải chặn, không chỉ
  // newHoldingSchema/addTransactionSchema mới cần refine này.
  test("sửa giao dịch đổi cashflowType sang BUY nhưng vẫn còn taxAmount cũ -> bị từ chối", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "cf-1",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "5200",
    });
    expect(result.success).toBe(false);
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
