import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  computeCashDividend,
  computeCashDividendPriceAdjustment,
  computeStockDividend,
  computeStockDividendPriceAdjustment,
  isStockQuantityOverrideValid,
  STOCK_DIVIDEND_ROUNDING_TOLERANCE,
} from "./dividend-math";

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
  // cổ phần → stockQuantity = 10 (tròn sẵn, không lệch raw).
  test("khớp ví dụ domain — FPT 10%, 100 CP", () => {
    const result = computeStockDividend({
      percent: new Decimal(10),
      quantity: new Decimal(100),
    });

    expect(result.rawStockQuantity.toString()).toBe("10");
    expect(result.stockQuantity.toString()).toBe("10");
    expect(result.wasRounded).toBe(false);
  });

  test("percent = 0 -> stockQuantity = 0", () => {
    const result = computeStockDividend({
      percent: new Decimal(0),
      quantity: new Decimal(100),
    });

    expect(result.stockQuantity.toString()).toBe("0");
    expect(result.wasRounded).toBe(false);
  });

  // Cổ phiếu không chia lẻ -> phần lẻ phải bị làm tròn xuống (floor), không
  // làm tròn gần nhất/lên. 105 CP × 12% = 12.6 -> floor 12.
  test("có phần lẻ -> stockQuantity làm tròn XUỐNG (floor), wasRounded = true", () => {
    const result = computeStockDividend({
      percent: new Decimal(12),
      quantity: new Decimal(105),
    });

    expect(result.rawStockQuantity.toString()).toBe("12.6");
    expect(result.stockQuantity.toString()).toBe("12");
    expect(result.wasRounded).toBe(true);
  });

  test("tròn sẵn (không phần lẻ) -> wasRounded = false", () => {
    const result = computeStockDividend({
      percent: new Decimal(10),
      quantity: new Decimal(100),
    });

    expect(result.rawStockQuantity.toString()).toBe("10");
    expect(result.stockQuantity.toString()).toBe("10");
    expect(result.wasRounded).toBe(false);
  });
});

describe("isStockQuantityOverrideValid", () => {
  test("override trùng khớp raw -> hợp lệ", () => {
    expect(
      isStockQuantityOverrideValid(new Decimal(12), new Decimal(12.6)),
    ).toBe(true);
  });

  test("override lệch trong tolerance -> hợp lệ", () => {
    // raw = 12.6, override = 14 -> lệch 1.4 < 2
    expect(
      isStockQuantityOverrideValid(new Decimal(14), new Decimal(12.6)),
    ).toBe(true);
  });

  test("override lệch vượt tolerance -> không hợp lệ", () => {
    // raw = 12.6, override = 15 -> lệch 2.4 > 2
    expect(
      isStockQuantityOverrideValid(new Decimal(15), new Decimal(12.6)),
    ).toBe(false);
  });

  test("đúng biên bằng tolerance (2) -> hợp lệ (inclusive)", () => {
    const raw = new Decimal(10);
    const override = raw.plus(STOCK_DIVIDEND_ROUNDING_TOLERANCE); // 12

    expect(isStockQuantityOverrideValid(override, raw)).toBe(true);
  });

  test("vượt biên đúng 1 đơn vị (tolerance + 1) -> không hợp lệ", () => {
    const raw = new Decimal(10);
    const override = raw.plus(STOCK_DIVIDEND_ROUNDING_TOLERANCE).plus(1); // 13

    expect(isStockQuantityOverrideValid(override, raw)).toBe(false);
  });

  test("override nhỏ hơn raw quá tolerance -> không hợp lệ (đối xứng 2 chiều)", () => {
    const raw = new Decimal(10);
    const override = raw.minus(STOCK_DIVIDEND_ROUNDING_TOLERANCE).minus(1); // 7

    expect(isStockQuantityOverrideValid(override, raw)).toBe(false);
  });
});

describe("computeStockDividendPriceAdjustment", () => {
  // Issue #61: giữ nguyên tổng giá trị — giá_mới = giá_cũ × SL_trước / SL_sau.
  test("ca thường — oldPrice=100, SL 100 -> 110", () => {
    const result = computeStockDividendPriceAdjustment({
      oldPrice: new Decimal(100),
      quantityBefore: new Decimal(100),
      quantityAfter: new Decimal(110),
    });

    expect(result?.toString()).toBe(
      new Decimal(100).mul(100).div(110).toString(),
    );
  });

  test("quantityAfter = 0 -> null (không điều chỉnh được)", () => {
    const result = computeStockDividendPriceAdjustment({
      oldPrice: new Decimal(100),
      quantityBefore: new Decimal(100),
      quantityAfter: new Decimal(0),
    });

    expect(result).toBeNull();
  });
});

describe("computeCashDividendPriceAdjustment", () => {
  // Issue #61: trừ cổ tức GỘP (trước thuế) trên mỗi cổ phần khỏi giá cũ.
  test("ca thường — oldPrice=100.000, grossAmount=200.000, SL=100 -> 98.000", () => {
    const result = computeCashDividendPriceAdjustment({
      oldPrice: new Decimal(100000),
      grossAmount: new Decimal(200000),
      quantityAtDate: new Decimal(100),
    });

    expect(result?.toString()).toBe("98000");
  });

  test("quantityAtDate = 0 -> null (không điều chỉnh được)", () => {
    const result = computeCashDividendPriceAdjustment({
      oldPrice: new Decimal(100000),
      grossAmount: new Decimal(200000),
      quantityAtDate: new Decimal(0),
    });

    expect(result).toBeNull();
  });
});
