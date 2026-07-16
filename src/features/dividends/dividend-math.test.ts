import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeCashDividend, computeStockDividend } from "./dividend-math";

describe("computeCashDividend", () => {
  // docs/domain/03-dividends.md "Ví dụ": FPT trả cổ tức tiền mặt 2.000/CP ×
  // 100 CP = gộp 200.000 → thuế 5% = 10.000 → net 190.000. 2.000/CP tương
  // đương 20% mệnh giá 10.000.
  test("khớp ví dụ domain — FPT 20% mệnh giá 10.000, 100 CP, thuế 5%", () => {
    const result = computeCashDividend({
      percent: new Decimal(20),
      parValue: new Decimal(10000),
      taxRatePercent: new Decimal(5),
      quantity: new Decimal(100),
    });

    expect(result.grossAmount.toString()).toBe("200000");
    expect(result.taxAmount.toString()).toBe("10000");
    expect(result.netAmount.toString()).toBe("190000");
  });

  test("netAmount luôn = grossAmount - taxAmount", () => {
    const result = computeCashDividend({
      percent: new Decimal(12.5),
      parValue: new Decimal(10000),
      taxRatePercent: new Decimal(5),
      quantity: new Decimal(3333),
    });

    expect(result.netAmount.toString()).toBe(
      result.grossAmount.minus(result.taxAmount).toString(),
    );
  });

  test("percent = 0 -> gross/tax/net đều 0", () => {
    const result = computeCashDividend({
      percent: new Decimal(0),
      parValue: new Decimal(10000),
      taxRatePercent: new Decimal(5),
      quantity: new Decimal(100),
    });

    expect(result.grossAmount.toString()).toBe("0");
    expect(result.taxAmount.toString()).toBe("0");
    expect(result.netAmount.toString()).toBe("0");
  });
});

describe("computeStockDividend", () => {
  // docs/domain/03-dividends.md "Ví dụ": FPT trả cổ tức cổ phiếu 10% với 100
  // cổ phần → stockQuantity = 10.
  test("khớp ví dụ domain — FPT 10%, 100 CP", () => {
    const result = computeStockDividend({
      percent: new Decimal(10),
      quantity: new Decimal(100),
    });

    expect(result.stockQuantity.toString()).toBe("10");
  });

  test("percent = 0 -> stockQuantity = 0", () => {
    const result = computeStockDividend({
      percent: new Decimal(0),
      quantity: new Decimal(100),
    });

    expect(result.stockQuantity.toString()).toBe("0");
  });
});
