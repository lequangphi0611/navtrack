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

// Phase 7 (issue #58) — trái tức. Điểm dễ sai nhất của phase này KHÔNG phải
// công thức tiền mà là việc nhánh BOND_COUPON phải BỎ QUA hoàn toàn bước bù
// pha loãng NAV (docs/domain/03-dividends.md, khối cảnh báo đầu mục "Bù pha
// loãng NAV"; process/phase-7.md "Tiêu chí hoàn thành").
describe("buildDividendFormState — trái tức (BOND_COUPON)", () => {
  const TCB2528 = {
    type: "BOND_COUPON" as const,
    symbol: "TCB2528",
    unit: "trái phiếu",
    date: new Date("2026-07-15"),
    paymentDate: null,
    grossAmount: new Decimal(9_000_000),
    taxAmount: new Decimal(450_000),
    netAmount: new Decimal(8_550_000),
    couponRatePercentApplied: new Decimal(9),
    couponFrequencyMonths: 6,
    xirrBeforePercent: "12.5",
    xirrAfterPercent: "13.1",
    totalDividendReceived: new Decimal(17_100_000),
    holdingId: "holding-bond-1",
  };

  test("trái phiếu doanh nghiệp: gộp/thuế/net + nhãn lãi suất đã đóng băng", () => {
    const state = buildDividendFormState(TCB2528);

    expect(state?.ok).toBe(true);
    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result.type).toBe("BOND_COUPON");
    expect(state.result.grossAmount).toBe("9000000");
    expect(state.result.taxAmount).toBe("450000");
    expect(state.result.netAmount).toBe("8550000");
    // percentLabel là LÃI SUẤT COUPON, không phải "% cổ tức" do user nhập.
    expect(state.result.percentLabel).toBe("9");
    expect(state.result.couponFrequencyMonths).toBe(6);
    expect(state.result.historyHref).toBe(
      ROUTES.dividendHistory("holding-bond-1"),
    );
  });

  // TEST KHOÁ TIÊU CHÍ PHASE: ghi trái tức KHÔNG được tạo NavOverride bù pha
  // loãng. Với trái phiếu, coupon là nghĩa vụ trả lãi theo hợp đồng — clean
  // price không giảm theo coupon; để nhánh này đi qua bước bù pha loãng dùng
  // chung sẽ kéo NAV tụt SAI và tụt TÍCH LUỸ qua từng kỳ, không có tín hiệu lỗi
  // nào. Union `RecordedDividend` cố ý không có field `priceAdjustment` ở nhánh
  // BOND_COUPON để việc "quên bỏ qua" thành lỗi COMPILE; test này khoá thêm
  // phía đầu ra để một lần nới lỏng kiểu về sau vẫn bị bắt.
  test("KHÔNG bao giờ có khối điều chỉnh giá (không bù pha loãng NAV)", () => {
    const state = buildDividendFormState(TCB2528);

    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result).not.toHaveProperty("navOverrideAdjusted");
    expect(state.result).not.toHaveProperty("oldPrice");
    expect(state.result).not.toHaveProperty("newPrice");
  });

  test("trái phiếu Chính phủ: thuế 0 vẫn hiển thị tường minh, net = gộp", () => {
    const state = buildDividendFormState({
      ...TCB2528,
      taxAmount: new Decimal(0),
      netAmount: new Decimal(9_000_000),
    });

    if (state?.ok !== true) throw new Error("expected ok result");
    expect(state.result.taxAmount).toBe("0");
    expect(state.result.netAmount).toBe("9000000");
  });
});
