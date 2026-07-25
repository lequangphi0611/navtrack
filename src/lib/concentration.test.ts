import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeConcentration, type ConcentrationInput } from "./concentration";

const THRESHOLD = 30; // seed mặc định (Setting CONCENTRATION_WARNING_THRESHOLD)

function h(
  id: string,
  nav: number | null,
  totalCostBasis: number,
  previouslyWarned = false,
): ConcentrationInput {
  return {
    id,
    type: "STOCK",
    nav: nav === null ? null : new Decimal(nav),
    totalCostBasis: new Decimal(totalCostBasis),
    previouslyWarned,
  };
}

describe("computeConcentration", () => {
  test("bình thường: mã vượt ngưỡng, danh mục đủ nhiều mã (không tự nhiên)", () => {
    // n=5, 100/5=20 <= 30 -> không tự nhiên. A=400/800=50% > 30 -> warned NORMAL.
    const holdings = [
      h("A", 400, 400),
      h("B", 100, 100),
      h("C", 100, 100),
      h("D", 100, 100),
      h("E", 100, 100),
    ];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.suppressed).toBe(false);
    expect(result.naturalConcentrationNote).toBe(false);
    expect(result.results.get("A")).toEqual({ kind: "NORMAL", percent: 50 });
    expect(result.results.get("B")).toBeNull();
    expect(result.warnedNow.get("A")).toBe(true);
    expect(result.warnedNow.get("B")).toBe(false);
  });

  test("tự nhiên do ít mã: 100/n > threshold, mọi badge kèm ghi chú", () => {
    // n=3, 100/3 = 33.33 > 30 -> tự nhiên. Chia đều -> mỗi mã 33.33% > 30 -> warned.
    const holdings = [h("A", 100, 100), h("B", 100, 100), h("C", 100, 100)];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.naturalConcentrationNote).toBe(true);
    expect(result.results.get("A")).toEqual({
      kind: "NATURAL_CONCENTRATION",
      percent: 100 / 3,
      holdingCount: 3,
    });
  });

  test("tự nhiên do ít mã: KHÔNG tự tạo badge cho mã dưới ngưỡng", () => {
    // n=3 (100/3 > 30, tự nhiên) nhưng phân bổ lệch: D chỉ chiếm rất ít -> vẫn
    // không có badge dù naturalConcentrationNote=true toàn cục.
    const holdings = [h("A", 970, 970), h("B", 20, 20), h("C", 10, 10)];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.naturalConcentrationNote).toBe(true);
    expect(result.results.get("B")).toBeNull();
    expect(result.results.get("C")).toBeNull();
  });

  test("thiếu giá <=5%: không treo toàn danh mục, mẫu số loại phần thiếu giá, kèm ghi chú ~", () => {
    // n=5 mã có giá (100/5=20<=30, không tự nhiên). MISSING costBasis nhỏ ->
    // missingPriceShare <= 5%.
    const holdings = [
      h("A", 500, 500),
      h("B", 200, 200),
      h("C", 100, 100),
      h("D", 100, 100),
      h("E", 50, 50),
      h("F", null, 40), // MISSING_PRICE, costBasis nhỏ
    ];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.suppressed).toBe(false);
    expect(result.missingPriceSharePercent).toBeCloseTo(4.04, 1); // 40/990*100
    // A = 500/950 = 52.6% > 30 -> warned, kèm ghi chú thiếu giá (PARTIAL_NAV).
    expect(result.results.get("A")).toMatchObject({ kind: "PARTIAL_NAV" });
    expect(result.results.get("F")).toBeNull();
  });

  test("treo cảnh báo toàn danh mục khi thiếu giá > 5% — áp dụng cho MỌI mã có giá", () => {
    const holdings = [
      h("A", 100, 100),
      h("MISSING", null, 300), // costBasis lớn -> share = 300/400 = 75% > 5%
    ];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.suppressed).toBe(true);
    expect(result.missingPriceSharePercent).toBeCloseTo(75, 5);
    expect(result.results.get("A")).toEqual({
      kind: "SUPPRESSED",
      missingPriceSharePercent: result.missingPriceSharePercent,
    });
    expect(result.results.get("MISSING")).toBeNull();
    // Không đổi trạng thái hysteresis khi suppress (mẫu số không đáng tin).
    expect(result.warnedNow.get("A")).toBe(false);
  });

  test("hysteresis: giữ bật cho tới khi rơi dưới threshold - buffer(3)", () => {
    // threshold=30, buffer=3 -> tắt khi <= 27.
    const stillWarned = computeConcentration(
      [h("A", 28, 28, true), h("B", 72, 72, false)],
      THRESHOLD,
    );
    expect(stillWarned.results.get("A")).not.toBeNull();
    expect(stillWarned.warnedNow.get("A")).toBe(true);

    const turnedOff = computeConcentration(
      [h("A", 27, 27, true), h("B", 73, 73, false)],
      THRESHOLD,
    );
    expect(turnedOff.results.get("A")).toBeNull();
    expect(turnedOff.warnedNow.get("A")).toBe(false);
  });

  test("hysteresis: không tự bật khi chưa từng bật, dù nằm trong vùng buffer", () => {
    // 28% nằm trong (27, 30] — nếu chưa từng cảnh báo thì KHÔNG bật (chỉ bật khi > threshold).
    const result = computeConcentration(
      [h("A", 28, 28, false), h("B", 72, 72, false)],
      THRESHOLD,
    );
    expect(result.results.get("A")).toBeNull();
    expect(result.warnedNow.get("A")).toBe(false);
  });

  test("hysteresis: luôn bật khi percent > threshold, bất kể previouslyWarned", () => {
    // n=4 (100/4=25<=30, không tự nhiên) để cô lập đúng nhánh NORMAL.
    const result = computeConcentration(
      [
        h("A", 31, 31, false),
        h("B", 23, 23, false),
        h("C", 23, 23, false),
        h("D", 23, 23, false),
      ],
      THRESHOLD,
    );
    expect(result.results.get("A")).toEqual({ kind: "NORMAL", percent: 31 });
    expect(result.warnedNow.get("A")).toBe(true);
  });

  test("danh mục 1 mã (100%) — luôn cảnh báo, kèm ghi chú tự nhiên", () => {
    const result = computeConcentration([h("A", 100, 100)], THRESHOLD);

    expect(result.naturalConcentrationNote).toBe(true);
    expect(result.results.get("A")).toEqual({
      kind: "NATURAL_CONCENTRATION",
      percent: 100,
      holdingCount: 1,
    });
  });

  test("không mã nào có giá — treo toàn danh mục, không badge nào được gán", () => {
    const holdings = [h("A", null, 100, true), h("B", null, 50, false)];
    const result = computeConcentration(holdings, THRESHOLD);

    expect(result.suppressed).toBe(true);
    expect(result.missingPriceSharePercent).toBe(100);
    expect(result.results.get("A")).toBeNull();
    expect(result.results.get("B")).toBeNull();
    // Giữ nguyên hysteresis trước đó cho mã MISSING_PRICE (không đủ thông tin).
    expect(result.warnedNow.get("A")).toBe(true);
    expect(result.warnedNow.get("B")).toBe(false);
  });
});
