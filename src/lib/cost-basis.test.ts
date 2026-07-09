import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeCashflowAmount, derivePosition } from "./cost-basis";

describe("computeCashflowAmount", () => {
  test("BUY: amount âm, gồm cả phí", () => {
    const amount = computeCashflowAmount({
      type: "BUY",
      quantity: new Decimal(100),
      pricePerUnit: new Decimal(100_000),
      feeAmount: new Decimal(0),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("-10000000");
  });

  test("SELL: amount dương, trừ phí và thuế", () => {
    const amount = computeCashflowAmount({
      type: "SELL",
      quantity: new Decimal(50),
      pricePerUnit: new Decimal(130_000),
      feeAmount: new Decimal(0),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("6500000");
  });

  test("BUY có phí: trừ thêm vào tiền bỏ ra", () => {
    const amount = computeCashflowAmount({
      type: "BUY",
      quantity: new Decimal(100),
      pricePerUnit: new Decimal(100_000),
      feeAmount: new Decimal(20_000),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("-10020000");
  });

  test("SELL có phí + thuế: trừ khỏi tiền nhận", () => {
    const amount = computeCashflowAmount({
      type: "SELL",
      quantity: new Decimal(50),
      pricePerUnit: new Decimal(130_000),
      feeAmount: new Decimal(10_000),
      taxAmount: new Decimal(6_500),
    });
    expect(amount.toString()).toBe("6483500");
  });
});

describe("derivePosition", () => {
  test("ví dụ FPT: mua-mua-bán một phần, giá vốn bình quân đúng theo domain doc", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
      {
        type: "BUY",
        date: new Date("2026-02-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(120_000),
      },
      {
        type: "SELL",
        date: new Date("2026-03-01"),
        quantity: new Decimal(50),
        pricePerUnit: new Decimal(130_000),
      },
    ]);

    expect(position.quantity.toString()).toBe("150");
    expect(position.avgCost.toString()).toBe("110000");
    expect(position.wentNegative).toBe(false);
  });

  test("giá vốn bình quân sau lần mua đầu tiên bằng đúng giá mua", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
    ]);

    expect(position.avgCost.toString()).toBe("100000");
  });

  test("bán vượt số lượng đang giữ tại thời điểm bán -> wentNegative = true", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
      {
        type: "SELL",
        date: new Date("2026-02-01"),
        quantity: new Decimal(150),
        pricePerUnit: new Decimal(120_000),
      },
    ]);

    expect(position.wentNegative).toBe(true);
  });

  test("bán hết rồi mua lại: giá vốn bình quân bắt đầu lại từ đầu", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
      {
        type: "SELL",
        date: new Date("2026-02-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(120_000),
      },
      {
        type: "BUY",
        date: new Date("2026-03-01"),
        quantity: new Decimal(50),
        pricePerUnit: new Decimal(200_000),
      },
    ]);

    expect(position.quantity.toString()).toBe("50");
    expect(position.avgCost.toString()).toBe("200000");
    expect(position.wentNegative).toBe(false);
  });

  test("bán đúng hết số lượng đang giữ -> quantity và avgCost về 0", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
      {
        type: "SELL",
        date: new Date("2026-02-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(120_000),
      },
    ]);

    expect(position.quantity.toString()).toBe("0");
    expect(position.avgCost.toString()).toBe("0");
    expect(position.wentNegative).toBe(false);
  });

  test("số lượng thập phân (vàng tính theo chỉ) tính giá vốn bình quân đúng", () => {
    const position = derivePosition([
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal("0.5"),
        pricePerUnit: new Decimal(6_000_000),
      },
      {
        type: "BUY",
        date: new Date("2026-02-01"),
        quantity: new Decimal("0.25"),
        pricePerUnit: new Decimal(6_400_000),
      },
    ]);

    expect(position.quantity.toString()).toBe("0.75");
    // (0.5*6,000,000 + 0.25*6,400,000) / 0.75 = 6,133,333.33...
    expect(position.avgCost.toFixed(2)).toBe("6133333.33");
  });

  test("không có giao dịch nào -> vị thế rỗng", () => {
    const position = derivePosition([]);

    expect(position.quantity.toString()).toBe("0");
    expect(position.avgCost.toString()).toBe("0");
    expect(position.wentNegative).toBe(false);
  });

  test("thứ tự nhập không theo ngày vẫn được phát lại đúng theo ngày", () => {
    const position = derivePosition([
      {
        type: "SELL",
        date: new Date("2026-03-01"),
        quantity: new Decimal(50),
        pricePerUnit: new Decimal(130_000),
      },
      {
        type: "BUY",
        date: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(100_000),
      },
      {
        type: "BUY",
        date: new Date("2026-02-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(120_000),
      },
    ]);

    expect(position.quantity.toString()).toBe("150");
    expect(position.avgCost.toString()).toBe("110000");
  });
});
