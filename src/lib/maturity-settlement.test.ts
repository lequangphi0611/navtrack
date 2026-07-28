import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeMaturitySettlement } from "./maturity-settlement";

// Bộ số bám đúng docs/domain/07-tax.md mục "Ví dụ" + mockup Phase 7 7e/7f.
describe("computeMaturitySettlement", () => {
  // 7e — mua ĐÚNG mệnh giá: không phát sinh lợi tức, thuế ra 0 một cách TỰ
  // NHIÊN từ công thức tổng quát (không phải nhánh riêng "đáo hạn thì thuế 0").
  test("mua đúng mệnh giá -> lợi tức 0, thuế 0, thực nhận đủ gốc", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(2),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("100000000"),
      interestTaxRatePercent: new Decimal("5"),
    });

    expect(result.grossProceeds.toString()).toBe("200000000");
    expect(result.taxableInterest.toString()).toBe("0");
    expect(result.taxAmount.toString()).toBe("0");
    expect(result.netProceeds.toString()).toBe("200000000");
    expect(result.hasTaxableInterest).toBe(false);
  });

  // 7f — mua CHIẾT KHẤU: toàn bộ lợi tức nằm ở phần chênh và chịu thuế lãi 5%.
  test("mua chiết khấu -> lợi tức chịu thuế 5%, thực nhận 199,2tr", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(2),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("92000000"),
      interestTaxRatePercent: new Decimal("5"),
    });

    expect(result.interestPerUnit.toString()).toBe("8000000");
    expect(result.taxableInterest.toString()).toBe("16000000");
    expect(result.taxAmount.toString()).toBe("800000");
    expect(result.netProceeds.toString()).toBe("199200000");
    expect(result.hasTaxableInterest).toBe(true);
  });

  // Sai lầm mà chính issue #101 nêu tên: ghi đáo hạn bằng một dòng SELL sẽ áp
  // SALE_TAX_BOND 0,1% trên TOÀN BỘ mệnh giá hoàn trả. Test này khoá lại việc
  // thuế phải tính trên LỢI TỨC, không phải trên giá trị giao dịch.
  test("thuế tính trên lợi tức, KHÔNG phải trên giá trị hoàn trả", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(1),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("92000000"),
      interestTaxRatePercent: new Decimal("5"),
    });

    // 5% × 8.000.000 lợi tức = 400.000...
    expect(result.taxAmount.toString()).toBe("400000");
    // ...chứ KHÔNG phải 0,1% × 100.000.000 = 100.000 (ca ghi nhầm bằng SELL),
    // cũng không phải 5% × 100.000.000 = 5.000.000 (ca đánh thuế trên gốc).
    expect(result.taxAmount.toString()).not.toBe("100000");
    expect(result.taxAmount.toString()).not.toBe("5000000");
  });

  test("trái phiếu Chính phủ mua chiết khấu -> miễn thuế, thực nhận đủ gốc", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(2),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("92000000"),
      interestTaxRatePercent: new Decimal("0"),
    });

    expect(result.taxableInterest.toString()).toBe("16000000");
    expect(result.taxAmount.toString()).toBe("0");
    expect(result.netProceeds.toString()).toBe("200000000");
  });

  // avgCost đã GỒM phí mua (docs/domain/07-tax.md) nên mua đúng mệnh giá vẫn ra
  // avgCost > parValue — chênh lệch ÂM, phải kẹp về 0, không thành "thuế âm"
  // (một khoản hoàn thuế không tồn tại).
  test("mua cao hơn mệnh giá (lỗ) -> lợi tức kẹp về 0, không có thuế âm", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(1),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("100300000"),
      interestTaxRatePercent: new Decimal("5"),
    });

    expect(result.interestPerUnit.toString()).toBe("0");
    expect(result.taxAmount.toString()).toBe("0");
    expect(result.netProceeds.toString()).toBe("100000000");
    expect(result.hasTaxableInterest).toBe(false);
  });

  test("tất toán một phần -> mọi số tỷ lệ theo số lượng thực ghi", () => {
    const result = computeMaturitySettlement({
      quantity: new Decimal(1),
      pricePerUnit: new Decimal("100000000"),
      avgCost: new Decimal("92000000"),
      interestTaxRatePercent: new Decimal("5"),
    });

    expect(result.grossProceeds.toString()).toBe("100000000");
    expect(result.taxableInterest.toString()).toBe("8000000");
    expect(result.netProceeds.toString()).toBe("99600000");
  });
});
