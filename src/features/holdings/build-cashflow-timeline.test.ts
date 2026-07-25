import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { formatDate, formatMoney, formatQuantity } from "@/lib/format";

import { buildCashflowTimeline } from "./build-cashflow-timeline";

describe("buildCashflowTimeline — ghép cổ tức tiền mặt vào timeline dòng tiền (issue #84)", () => {
  test("BUY -> DIVIDEND (paymentDate rơi giữa 2 giao dịch) -> SELL, đúng thứ tự interleave", () => {
    const rows = buildCashflowTimeline(
      [
        {
          id: "cf-buy",
          type: "BUY",
          date: new Date("2024-01-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(20_000),
          amount: new Decimal(-20_000_000),
        },
        {
          id: "cf-sell",
          type: "SELL",
          date: new Date("2024-06-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(25_000),
          amount: new Decimal(25_000_000),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2024-03-01"),
          paymentDate: new Date("2024-03-20"),
          netAmount: new Decimal(500_000),
        },
      ],
      "CP",
    );

    expect(rows.map((r) => r.id)).toEqual(["cf-buy", "div-1", "cf-sell"]);
    expect(rows[1]).toMatchObject({ id: "div-1", kind: "DIVIDEND" });
  });

  test("dividend paymentDate: null -> fallback dùng date để sort/hiển thị", () => {
    const rows = buildCashflowTimeline(
      [
        {
          id: "cf-buy",
          type: "BUY",
          date: new Date("2024-01-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(20_000),
          amount: new Decimal(-20_000_000),
        },
        {
          id: "cf-sell",
          type: "SELL",
          date: new Date("2024-06-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(25_000),
          amount: new Decimal(25_000_000),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2024-03-01"),
          paymentDate: null,
          netAmount: new Decimal(500_000),
        },
      ],
      "CP",
    );

    expect(rows.map((r) => r.id)).toEqual(["cf-buy", "div-1", "cf-sell"]);
    expect(rows[1]?.dateNote).toContain("01/03/2024");
  });

  test("amount của dòng DIVIDEND đúng bằng netAmount truyền vào, không làm tròn/tính lại", () => {
    const rows = buildCashflowTimeline(
      [],
      [
        {
          id: "div-1",
          date: new Date("2024-03-01"),
          paymentDate: null,
          netAmount: new Decimal("1234567.89"),
        },
      ],
      "CP",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe("1234567.89");
  });

  test("1 cashflow và 1 dividend cùng ngày hiển thị -> cashflow đứng trước dividend (tie-break)", () => {
    const sameDay = new Date("2024-03-01");
    const rows = buildCashflowTimeline(
      [
        {
          id: "cf-buy",
          type: "BUY",
          date: sameDay,
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(20_000),
          amount: new Decimal(-20_000_000),
        },
      ],
      [
        {
          id: "div-1",
          date: sameDay,
          paymentDate: null,
          netAmount: new Decimal(500_000),
        },
      ],
      "CP",
    );

    expect(rows.map((r) => r.id)).toEqual(["cf-buy", "div-1"]);
  });

  test("dividends rỗng -> kết quả y hệt hành vi cũ (chỉ BUY/SELL, đúng thứ tự ban đầu)", () => {
    const rows = buildCashflowTimeline(
      [
        {
          id: "cf-buy",
          type: "BUY",
          date: new Date("2024-01-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(20_000),
          amount: new Decimal(-20_000_000),
        },
        {
          id: "cf-sell",
          type: "SELL",
          date: new Date("2024-06-01"),
          quantity: new Decimal(1000),
          pricePerUnit: new Decimal(25_000),
          amount: new Decimal(25_000_000),
        },
      ],
      [],
      "CP",
    );

    expect(rows).toEqual([
      {
        id: "cf-buy",
        kind: "BUY",
        label: `Mua ${formatQuantity("1000", "CP")}`,
        dateNote: `${formatDate(new Date("2024-01-01"))} · giá ${formatMoney("20000")}`,
        amount: "-20000000",
      },
      {
        id: "cf-sell",
        kind: "SELL",
        label: `Bán ${formatQuantity("1000", "CP")}`,
        dateNote: `${formatDate(new Date("2024-06-01"))} · giá ${formatMoney("25000")}`,
        amount: "25000000",
      },
    ]);
  });
});
