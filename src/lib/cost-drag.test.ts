import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  computeCostDrag,
  computeCostDragContributionPercent,
} from "./cost-drag";

describe("computeCostDrag", () => {
  // docs/domain/07-tax.md mục "Ví dụ" — "Chi phí ăn mòn": grossInvested
  // 500.000.000, Σ Cashflow.taxAmount = 1.200.000, Σ Cashflow.feeAmount =
  // 800.000, Σ Dividend.taxAmount = 300.000 -> costDragAmount = 2.300.000,
  // costDragPercent ≈ 0.46%.
  test("khớp ví dụ domain doc: grossInvested 500tr, tax 1.200.000, fee 800.000, dividend tax 300.000 -> ~0.46%", () => {
    const result = computeCostDrag(
      [
        {
          type: "BUY",
          amount: new Decimal(-500_000_000),
          taxAmount: new Decimal(0),
          feeAmount: new Decimal(0),
        },
        {
          type: "SELL",
          amount: new Decimal(1),
          taxAmount: new Decimal(1_200_000),
          feeAmount: new Decimal(800_000),
        },
      ],
      [{ taxAmount: new Decimal(300_000) }],
    );

    expect(result.grossInvested.toString()).toBe("500000000");
    expect(result.feeTotal.toString()).toBe("800000");
    expect(result.saleTaxTotal.toString()).toBe("1200000");
    expect(result.dividendTaxTotal.toString()).toBe("300000");
    expect(result.costDragAmount.toString()).toBe("2300000");
    expect(result.costDragPercent).toBeCloseTo(0.46, 2);
  });

  // process/DECISION.md 2026-07-17 (6) — mẫu số KHÔNG co lại khi bán nhiều.
  test("bán nhiều không làm costDragPercent phình vô lý (mẫu số là vốn GỘP, không phải vốn ròng)", () => {
    const result = computeCostDrag(
      [
        {
          type: "BUY",
          amount: new Decimal(-100_000_000),
          taxAmount: new Decimal(0),
          feeAmount: new Decimal(0),
        },
        {
          type: "SELL",
          amount: new Decimal(80_000_000),
          taxAmount: new Decimal(1_000_000),
          feeAmount: new Decimal(1_000_000),
        },
      ],
      [],
    );

    expect(result.grossInvested.toString()).toBe("100000000");
    expect(result.costDragAmount.toString()).toBe("2000000");
    // 2.000.000 / 100.000.000 = 2%, KHÔNG phải 2.000.000 / vốn ròng (~20tr) = 10%.
    expect(result.costDragPercent).toBeCloseTo(2, 4);
  });

  // Rủi ro nêu ở process/phase-5-plan-DRAFT.md mục "Rủi ro / ca biên cần test".
  test("chưa có lệnh mua nào -> grossInvested = 0, costDragPercent = 0 (không NaN/Infinity)", () => {
    const result = computeCostDrag([], []);

    expect(result.grossInvested.toString()).toBe("0");
    expect(result.costDragAmount.toString()).toBe("0");
    expect(result.costDragPercent).toBe(0);
    expect(Number.isFinite(result.costDragPercent)).toBe(true);
  });

  test("Dividend.taxAmount null coi như 0, không loại bỏ dòng khỏi tổng", () => {
    const result = computeCostDrag(
      [
        {
          type: "BUY",
          amount: new Decimal(-10_000_000),
          taxAmount: new Decimal(0),
          feeAmount: new Decimal(0),
        },
      ],
      [{ taxAmount: null }, { taxAmount: new Decimal(50_000) }],
    );

    expect(result.dividendTaxTotal.toString()).toBe("50000");
  });
});

describe("computeCostDragContributionPercent", () => {
  test("% đóng góp của một nguồn trên tổng costDragAmount", () => {
    expect(
      computeCostDragContributionPercent(
        new Decimal(800_000),
        new Decimal(2_600_000),
      ),
    ).toBeCloseTo(30.77, 2);
  });

  // Rủi ro nêu ở process/phase-5-plan-DRAFT.md — mẫu số KHÁC costDragPercent
  // (costDragAmount, không phải grossInvested), dễ nhầm.
  test("costDragAmount = 0 -> contributionPercent = 0, không chia 0", () => {
    expect(
      computeCostDragContributionPercent(new Decimal(0), new Decimal(0)),
    ).toBe(0);
  });
});
