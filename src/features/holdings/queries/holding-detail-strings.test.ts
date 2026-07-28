import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { cashflowActionLabel } from "@/lib/cashflow-label";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatQuantity,
} from "@/lib/format";

import {
  buildCutoffNavDateNote,
  buildPriceNote,
  buildTransactionDateNote,
  buildTransactionLabel,
} from "./holding-detail-strings";

describe("buildPriceNote — priceNote của khối định giá chi tiết vị thế (mockup 2c)", () => {
  test("ghép đúng ngày EOD/giá/vốn TB, dùng đúng formatDayMonth/formatMoney", () => {
    const priceDate = new Date("2026-07-10");
    const price = new Decimal("178900");
    const avgCost = new Decimal("163100");

    expect(buildPriceNote(priceDate, price, avgCost)).toBe(
      `Giá EOD ${formatDayMonth(priceDate)}: ${formatMoney(price.toString())} · vốn TB ${formatMoney(avgCost.toString())}`,
    );
  });

  test("giá/vốn có chữ số thập phân vẫn ghép đúng (không làm tròn)", () => {
    const priceDate = new Date("2026-01-05");
    const price = new Decimal("27300.5");
    const avgCost = new Decimal("25000.25");

    expect(buildPriceNote(priceDate, price, avgCost)).toBe(
      `Giá EOD ${formatDayMonth(priceDate)}: ${formatMoney(price.toString())} · vốn TB ${formatMoney(avgCost.toString())}`,
    );
  });
});

describe("buildCutoffNavDateNote — dateNote cho dòng CUTOFF_NAV giả định trong timeline", () => {
  test("ghép đúng ngày mốc chốt + hậu tố cố định", () => {
    const cutoffDate = new Date("2026-07-27");

    expect(buildCutoffNavDateNote(cutoffDate)).toBe(
      `${formatDate(cutoffDate)} · dòng tiền giả định`,
    );
  });
});

describe("buildTransactionLabel — nhãn giao dịch cho TransactionSnapshotBanner", () => {
  test("BUY -> nhãn bắt đầu bằng 'Mua'", () => {
    expect(buildTransactionLabel("BUY", "5000", "CP")).toBe(
      `${cashflowActionLabel("BUY")} ${formatQuantity("5000", "CP")}`,
    );
    expect(buildTransactionLabel("BUY", "5000", "CP")).toContain("Mua");
  });

  test("SELL -> nhãn bắt đầu bằng 'Bán'", () => {
    expect(buildTransactionLabel("SELL", "1200.5", "CCQ")).toBe(
      `${cashflowActionLabel("SELL")} ${formatQuantity("1200.5", "CCQ")}`,
    );
    expect(buildTransactionLabel("SELL", "1200.5", "CCQ")).toContain("Bán");
  });

  test("MATURITY -> nhãn bắt đầu bằng 'Đáo hạn'", () => {
    expect(buildTransactionLabel("MATURITY", "100", "TP")).toBe(
      `${cashflowActionLabel("MATURITY")} ${formatQuantity("100", "TP")}`,
    );
    expect(buildTransactionLabel("MATURITY", "100", "TP")).toContain("Đáo hạn");
  });
});

describe("buildTransactionDateNote — dateNote cho cùng banner trên", () => {
  test("ghép đúng ngày (ISO string) + giá giao dịch", () => {
    const date = new Date("2026-07-11").toISOString();

    expect(buildTransactionDateNote(date, "27300")).toBe(
      `${formatDate(date)} · giá ${formatMoney("27300")}`,
    );
  });
});
