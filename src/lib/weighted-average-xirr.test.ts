import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeWeightedAverageXirr } from "./weighted-average-xirr";

describe("computeWeightedAverageXirr", () => {
  test("trọng số theo vốn — KHÁC trung bình cộng đơn giản", () => {
    // A: XIRR 30%/năm, vốn 100tr. B: XIRR 10%/năm, vốn 900tr.
    // Trung bình cộng đơn giản = (30+10)/2 = 20%. Weighted đúng = 12%.
    const result = computeWeightedAverageXirr([
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.3) },
        capital: new Decimal(100_000_000),
      },
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.1) },
        capital: new Decimal(900_000_000),
      },
    ]);

    expect(result).not.toBeNull();
    expect(result?.toNumber()).toBeCloseTo(0.12, 6);
    // Khẳng định KHÁC trung bình cộng đơn giản (0.2).
    expect(result?.toNumber()).not.toBeCloseTo(0.2, 2);
  });

  test("bỏ qua entry 'không tính được' khỏi CẢ tử lẫn mẫu, không quy về 0", () => {
    const result = computeWeightedAverageXirr([
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.2) },
        capital: new Decimal(100),
      },
      {
        xirr: { ok: false, reason: "NO_CONVERGE" },
        capital: new Decimal(500), // vốn LỚN nhưng KHÔNG tính được -> loại bỏ hoàn toàn
      },
    ]);

    // Nếu vô tình quy vốn 500 vào mẫu số (coi XIRR = 0) thì kết quả sẽ
    // = 0.2*100/(100+500) = 0.0333, khác hẳn 0.2 mong đợi.
    expect(result?.toNumber()).toBeCloseTo(0.2, 6);
  });

  test("3 vị thế — vị thế vốn lớn nhất áp đảo bình quân, không san đều theo số lượng", () => {
    const result = computeWeightedAverageXirr([
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.5) },
        capital: new Decimal(10),
      },
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.4) },
        capital: new Decimal(10),
      },
      {
        xirr: { ok: true, annualizedRate: new Decimal(0.05) },
        capital: new Decimal(980),
      },
    ]);

    // Trung bình cộng đơn giản = (0.5+0.4+0.05)/3 = 0.3167 — weighted phải
    // gần 0.05 hơn nhiều vì vị thế thứ 3 chiếm 98% vốn.
    expect(result?.toNumber()).toBeCloseTo(0.058, 3);
    expect(result?.toNumber()).not.toBeCloseTo(0.3167, 1);
  });

  test("không entry nào OK -> null", () => {
    const result = computeWeightedAverageXirr([
      {
        xirr: { ok: false, reason: "NO_POSITIVE_FLOW" },
        capital: new Decimal(100),
      },
      { xirr: { ok: false, reason: "NO_CONVERGE" }, capital: new Decimal(200) },
    ]);
    expect(result).toBeNull();
  });

  test("mảng rỗng -> null", () => {
    expect(computeWeightedAverageXirr([])).toBeNull();
  });
});
