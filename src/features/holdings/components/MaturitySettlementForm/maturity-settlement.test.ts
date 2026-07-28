import { describe, expect, test } from "vitest";

import { computeMaturitySettlementPreview } from "./maturity-settlement";

describe("computeMaturitySettlementPreview", () => {
  test("mua đúng mệnh giá -> lợi tức 0, thuế 0 (mockup 7e)", () => {
    const preview = computeMaturitySettlementPreview({
      quantity: "2",
      pricePerUnit: "100000000",
      avgCost: "100000000",
      interestTaxRatePercent: "5",
    });

    expect(preview.grossProceeds).toBe("200000000");
    expect(preview.taxableInterest).toBe("0");
    expect(preview.taxAmount).toBe("0");
    expect(preview.netProceeds).toBe("200000000");
    expect(preview.hasTaxableInterest).toBe(false);
  });

  test("mua chiết khấu -> chênh lệch chịu thuế lãi 5% (mockup 7f)", () => {
    const preview = computeMaturitySettlementPreview({
      quantity: "2",
      pricePerUnit: "100000000",
      avgCost: "92000000",
      interestTaxRatePercent: "5",
    });

    expect(preview.interestPerUnit).toBe("8000000");
    expect(preview.taxableInterest).toBe("16000000");
    expect(preview.taxAmount).toBe("800000");
    expect(preview.netProceeds).toBe("199200000");
    expect(preview.hasTaxableInterest).toBe(true);
  });

  test("trái phiếu Chính phủ mua chiết khấu -> có lợi tức nhưng thuế 0", () => {
    const preview = computeMaturitySettlementPreview({
      quantity: "2",
      pricePerUnit: "100000000",
      avgCost: "92000000",
      interestTaxRatePercent: "0",
    });

    expect(preview.taxableInterest).toBe("16000000");
    expect(preview.taxAmount).toBe("0");
    expect(preview.netProceeds).toBe("200000000");
  });

  test("mua cao hơn mệnh giá (lỗ) -> lợi tức chịu thuế không âm", () => {
    const preview = computeMaturitySettlementPreview({
      quantity: "2",
      pricePerUnit: "100000000",
      avgCost: "105000000",
      interestTaxRatePercent: "5",
    });

    expect(preview.taxableInterest).toBe("0");
    expect(preview.taxAmount).toBe("0");
    // Lỗ không sinh thuế, nhưng tiền nhận về vẫn theo mệnh giá.
    expect(preview.netProceeds).toBe("200000000");
  });

  test("field còn trống khi user đang gõ -> không vỡ, trả 0", () => {
    const preview = computeMaturitySettlementPreview({
      quantity: "",
      pricePerUnit: "",
      avgCost: "92000000",
      interestTaxRatePercent: "5",
    });

    expect(preview.grossProceeds).toBe("0");
    expect(preview.taxAmount).toBe("0");
  });
});
