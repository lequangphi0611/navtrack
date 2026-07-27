import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

import { buildDividendFormState } from "./build-dividend-form-state";

describe("buildDividendFormState — dựng DividendFormState từ kết quả recordDividend (issue #107)", () => {
  test("CASH đủ field (priceAdjustment, paymentDate, XIRR before/after, totalDividendReceived)", () => {
    const state = buildDividendFormState({
      type: "CASH",
      symbol: "VNM",
      unit: "CP",
      percent: "20",
      date: new Date("2024-03-01"),
      paymentDate: new Date("2024-03-20"),
      grossAmount: new Decimal(2_000_000),
      taxAmount: new Decimal(100_000),
      netAmount: new Decimal(1_900_000),
      priceAdjustment: {
        oldPrice: new Decimal(50_000),
        newPrice: new Decimal(48_000),
      },
      xirrBeforePercent: "12.5",
      xirrAfterPercent: "13.1",
      totalDividendReceived: new Decimal(5_000_000),
      holdingId: "holding-1",
    });

    expect(state).toEqual({
      ok: true,
      result: {
        symbol: "VNM",
        type: "CASH",
        percentLabel: "20",
        dateLabel: formatDate(new Date("2024-03-01")),
        grossAmount: "2000000",
        taxAmount: "100000",
        netAmount: "1900000",
        paymentDateLabel: formatDate(new Date("2024-03-20")),
        navOverrideAdjusted: true,
        oldPrice: "50000",
        newPrice: "48000",
        xirrBeforePercent: "12.5",
        xirrAfterPercent: "13.1",
        totalDividendReceived: "5000000",
        historyHref: ROUTES.dividendHistory("holding-1"),
        holdingHref: ROUTES.holdingDetail("holding-1"),
      },
    });
  });

  test("CASH thiếu XIRR (before/after = null) -> output KHÔNG có xirrBeforePercent/xirrAfterPercent", () => {
    const state = buildDividendFormState({
      type: "CASH",
      symbol: "VNM",
      unit: "CP",
      percent: "20",
      date: new Date("2024-03-01"),
      paymentDate: null,
      grossAmount: new Decimal(2_000_000),
      taxAmount: new Decimal(100_000),
      netAmount: new Decimal(1_900_000),
      xirrBeforePercent: null,
      xirrAfterPercent: null,
      totalDividendReceived: new Decimal(5_000_000),
      holdingId: "holding-1",
    });

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result).not.toHaveProperty("xirrBeforePercent");
    expect(state.result).not.toHaveProperty("xirrAfterPercent");
  });

  test("STOCK wasRounded=true -> output có rawAddedQuantity", () => {
    const state = buildDividendFormState({
      type: "STOCK",
      symbol: "VNM",
      unit: "CP",
      percent: "10",
      date: new Date("2024-03-01"),
      paymentDate: null,
      addedQuantity: new Decimal(100),
      afterQuantity: new Decimal(1100),
      wasRounded: true,
      rawStockQuantity: new Decimal("100.7"),
      xirrBeforePercent: null,
      xirrAfterPercent: null,
      totalDividendReceived: new Decimal(0),
      holdingId: "holding-1",
    });

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result.wasRounded).toBe(true);
    expect(state.result.rawAddedQuantity).toBe("100.7");
  });

  test("STOCK wasRounded=false -> output KHÔNG có rawAddedQuantity", () => {
    const state = buildDividendFormState({
      type: "STOCK",
      symbol: "VNM",
      unit: "CP",
      percent: "10",
      date: new Date("2024-03-01"),
      paymentDate: null,
      addedQuantity: new Decimal(100),
      afterQuantity: new Decimal(1100),
      wasRounded: false,
      rawStockQuantity: new Decimal(100),
      xirrBeforePercent: null,
      xirrAfterPercent: null,
      totalDividendReceived: new Decimal(0),
      holdingId: "holding-1",
    });

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result).not.toHaveProperty("rawAddedQuantity");
    expect(state.result.wasRounded).toBeUndefined();
  });

  test("STOCK không có priceAdjustment -> output KHÔNG có navOverrideAdjusted", () => {
    const state = buildDividendFormState({
      type: "STOCK",
      symbol: "VNM",
      unit: "CP",
      percent: "10",
      date: new Date("2024-03-01"),
      paymentDate: null,
      addedQuantity: new Decimal(100),
      afterQuantity: new Decimal(1100),
      wasRounded: false,
      rawStockQuantity: new Decimal(100),
      xirrBeforePercent: null,
      xirrAfterPercent: null,
      totalDividendReceived: new Decimal(0),
      holdingId: "holding-1",
    });

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result).not.toHaveProperty("navOverrideAdjusted");
    expect(state.result).not.toHaveProperty("oldPrice");
    expect(state.result).not.toHaveProperty("newPrice");
  });

  test("Thiếu paymentDate (null) -> output KHÔNG có paymentDateLabel", () => {
    const state = buildDividendFormState({
      type: "CASH",
      symbol: "VNM",
      unit: "CP",
      percent: "20",
      date: new Date("2024-03-01"),
      paymentDate: null,
      grossAmount: new Decimal(2_000_000),
      taxAmount: new Decimal(100_000),
      netAmount: new Decimal(1_900_000),
      xirrBeforePercent: null,
      xirrAfterPercent: null,
      totalDividendReceived: new Decimal(5_000_000),
      holdingId: "holding-1",
    });

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result).not.toHaveProperty("paymentDateLabel");
  });
});
