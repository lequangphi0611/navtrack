import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { buildPortfolioExportPayload } from "./portfolio-export";
import type { HoldingRow } from "./repository";

function makeHoldingRow(overrides: Partial<HoldingRow> = {}): HoldingRow {
  return {
    id: "holding-1",
    symbol: "FPT",
    name: null,
    type: "STOCK",
    unit: "cổ phiếu",
    quantity: new Decimal("3500"),
    avgCost: new Decimal("42000"),
    ...overrides,
  };
}

describe("buildPortfolioExportPayload (issue #151)", () => {
  test("chỉ giữ vị thế STOCK còn quantity > 0 — loại FUND/BOND/GOLD và STOCK đã bán hết", () => {
    const holdings: HoldingRow[] = [
      makeHoldingRow({ id: "1", symbol: "FPT", type: "STOCK" }),
      makeHoldingRow({ id: "2", symbol: "VNDIRECT-FUND", type: "FUND" }),
      makeHoldingRow({ id: "3", symbol: "BOND-VNG25", type: "BOND" }),
      makeHoldingRow({ id: "4", symbol: "GOLD-SJC", type: "GOLD" }),
      makeHoldingRow({
        id: "5",
        symbol: "VNM",
        type: "STOCK",
        quantity: new Decimal("0"),
      }),
    ];

    const payload = buildPortfolioExportPayload(
      holdings,
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.holdings).toHaveLength(1);
    expect(payload.holdings[0]?.symbol).toBe("FPT");
  });

  test("giữ đúng 4 số thập phân dù input là Decimal nguyên", () => {
    const holdings: HoldingRow[] = [
      makeHoldingRow({
        quantity: new Decimal("3500"),
        avgCost: new Decimal("42000"),
      }),
    ];

    const payload = buildPortfolioExportPayload(
      holdings,
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.holdings[0]?.quantity).toBe("3500.0000");
    expect(payload.holdings[0]?.avg_cost).toBe("42000.0000");
  });

  test("giữ đúng 4 số thập phân khi input đã có phần thập phân lẻ", () => {
    const holdings: HoldingRow[] = [
      makeHoldingRow({
        quantity: new Decimal("120.5"),
        avgCost: new Decimal("15000.125"),
      }),
    ];

    const payload = buildPortfolioExportPayload(
      holdings,
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.holdings[0]?.quantity).toBe("120.5000");
    expect(payload.holdings[0]?.avg_cost).toBe("15000.1250");
  });

  test("danh mục rỗng (mảng input rỗng) -> holdings: []", () => {
    const payload = buildPortfolioExportPayload(
      [],
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.holdings).toEqual([]);
  });

  test("danh mục rỗng sau khi lọc hết (chỉ FUND/BOND/GOLD hoặc STOCK đã bán hết) -> holdings: []", () => {
    const holdings: HoldingRow[] = [
      makeHoldingRow({ type: "FUND" }),
      makeHoldingRow({ type: "STOCK", quantity: new Decimal("0") }),
    ];

    const payload = buildPortfolioExportPayload(
      holdings,
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.holdings).toEqual([]);
  });

  test("payload luôn có schema_version = 1 và source = navtrack", () => {
    const payload = buildPortfolioExportPayload(
      [],
      new Date("2026-08-22T00:00:00.000Z"),
    );

    expect(payload.schema_version).toBe(1);
    expect(payload.source).toBe("navtrack");
  });

  describe("as_of — ISO 8601 với offset +07:00 cố định", () => {
    test("giờ UTC giữa ngày -> chỉ cộng offset, không đổi ngày", () => {
      const payload = buildPortfolioExportPayload(
        [],
        new Date("2026-08-22T10:30:00.000Z"),
      );

      expect(payload.as_of).toBe("2026-08-22T17:30:00.000+07:00");
    });

    test("giờ UTC cuối ngày (17:00-23:59 UTC) -> as_of rơi sang ngày hôm sau theo giờ ICT", () => {
      const payload = buildPortfolioExportPayload(
        [],
        new Date("2026-08-22T20:15:30.500Z"),
      );

      expect(payload.as_of).toBe("2026-08-23T03:15:30.500+07:00");
    });

    test("mốc đầu ngày UTC -> cộng offset vẫn giữ nguyên ngày", () => {
      const payload = buildPortfolioExportPayload(
        [],
        new Date("2026-01-01T00:00:00.000Z"),
      );

      expect(payload.as_of).toBe("2026-01-01T07:00:00.000+07:00");
    });
  });
});
