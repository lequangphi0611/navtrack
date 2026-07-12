import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeXirr } from "./xirr";

describe("computeXirr — đối chiếu Excel/Google Sheets (docs/rules/testing.md)", () => {
  test("XIRR khớp Google Sheets trên dữ liệu mẫu domain doc (100tr -> 112tr sau đúng 1 năm = 12%)", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
      { date: new Date("2024-01-01"), amount: new Decimal(112_000_000) },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annualizedRate.toFixed(4)).toBe("0.1200");
    }
  });

  test("XIRR khớp bộ dữ liệu mẫu 'giống một bảng tính phổ biến' của chính thư viện xirr (4 lần góp 1000 mỗi quý + rút 4300)", () => {
    // node_modules/xirr/test/test.js: "computes the xirr on a particular
    // data set the same as a popular spreadsheet" -> kỳ vọng 0.121268
    // (result.toPrecision(6)). Dùng lại đúng bộ dữ liệu này để đối chiếu
    // Excel/Google Sheets không phụ thuộc vào số tự tính tay.
    const result = computeXirr([
      { date: new Date(2010, 0, 1), amount: new Decimal(-1000) },
      { date: new Date(2010, 3, 1), amount: new Decimal(-1000) },
      { date: new Date(2010, 6, 1), amount: new Decimal(-1000) },
      { date: new Date(2010, 9, 1), amount: new Decimal(-1000) },
      { date: new Date(2011, 0, 1), amount: new Decimal(4300) },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annualizedRate.toFixed(4)).toBe("0.1213");
    }
  });
});

describe("computeXirr — ca biên: chuỗi dòng tiền không hợp lệ", () => {
  test("không tính được khi thiếu dòng tiền dương (chỉ toàn mua)", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });

  test("không tính được khi toàn bộ dòng tiền âm (nhiều lần mua, chưa có NAV/bán)", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100) },
      { date: new Date("2023-06-01"), amount: new Decimal(-50) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });

  test("không tính được khi toàn bộ dòng tiền dương (thiếu vốn bỏ ra)", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(100) },
      { date: new Date("2023-06-01"), amount: new Decimal(50) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });

  test("chỉ 1 dòng tiền -> không thể có cả âm lẫn dương -> NO_POSITIVE_FLOW", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });

  test("amount=0 KHÔNG đánh dấu isNavPoint (vd một dòng cashflow/dividend thật = 0, không thực tế nhưng để kiểm tra hasValidSigns không tự nới lỏng ngoài case NAV) -> vẫn NO_POSITIVE_FLOW", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100) },
      { date: new Date("2023-06-01"), amount: new Decimal(0) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_POSITIVE_FLOW");
  });
});

describe("computeXirr — ca biên: NAV=0 hợp lệ (mất trắng) khác thiếu dòng tiền dương", () => {
  test("NAV=0 hợp lệ (isNavPoint:true, vị thế đang mở, có định giá thật) -> XIRR = -100% (-1), KHÔNG phải NO_POSITIVE_FLOW", () => {
    // Quyết định sản phẩm: khi holding còn mở và currentNav là Decimal(0) HỢP
    // LỆ (không phải null/thiếu giá), XIRR phải khớp hành vi gốc thư viện
    // "xirr" (maxAmount === 0 -> -1), tức "mất trắng" -100%/năm.
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-100_000_000) },
      {
        date: new Date("2024-01-01"),
        amount: new Decimal(0),
        isNavPoint: true,
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.annualizedRate.toFixed(4)).toBe("-1.0000");
  });

  test("NAV=0 hợp lệ nhưng có nhiều dòng mua (âm) khác nhau -> vẫn -100%, không throw/không NO_CONVERGE", () => {
    const result = computeXirr([
      { date: new Date("2023-01-01"), amount: new Decimal(-50_000_000) },
      { date: new Date("2023-06-01"), amount: new Decimal(-30_000_000) },
      {
        date: new Date("2024-01-01"),
        amount: new Decimal(0),
        isNavPoint: true,
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.annualizedRate.toFixed(4)).toBe("-1.0000");
  });
});

describe("computeXirr — ca biên: không hội tụ", () => {
  test("toàn bộ dòng tiền cùng 1 ngày -> NO_CONVERGE (thư viện từ chối tính; bisection cũng không tìm được nghiệm vì NPV là hằng số theo r khi mọi kỳ hạn = 0)", () => {
    const result = computeXirr([
      { date: new Date("2024-05-01"), amount: new Decimal(-100) },
      { date: new Date("2024-05-01"), amount: new Decimal(112) },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NO_CONVERGE");
  });

  test("ca thực tế Newton-Raphson không hội tụ với mọi guess (mặc định + dự phòng) — bisection dự phòng vẫn giải được", () => {
    // node_modules/xirr/test/test.js, ca "coronavirus inspired data set
    // (issue #7)": lỗ gần hết (713.07 -> 555.33) trong 13 ngày. Đã xác nhận
    // bằng cách chạy trực tiếp thư viện: guess mặc định VÀ toàn bộ guess
    // trong ALTERNATE_GUESSES đều throw "failed to converge". Thư viện chỉ
    // hội tụ nếu người gọi tự đoán guess sát -1 (options.guess: -0.9975),
    // lúc đó ra -0.999106. computeXirr không "học thuộc" ca riêng lẻ này
    // trong ALTERNATE_GUESSES, nên phép test này thực sự đi qua nhánh
    // bisection dự phòng và tự tìm ra cùng nghiệm đó (khớp tới 4 số lẻ).
    const result = computeXirr([
      { date: new Date(2020, 2, 4), amount: new Decimal(-713.07) },
      { date: new Date(2020, 2, 17), amount: new Decimal(555.33) },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annualizedRate.toFixed(4)).toBe("-0.9991");
    }
  });
});

describe("computeXirr — kỳ ngắn vẫn annualize đúng, không cần xử lý riêng", () => {
  test("lãi 2% trong 3 tháng -> annualize khuếch đại lên khoảng 8.3%/năm (đúng ví dụ 'kỳ rất ngắn' trong docs/domain/05)", () => {
    const result = computeXirr([
      { date: new Date("2024-01-01"), amount: new Decimal(-100) },
      { date: new Date("2024-04-01"), amount: new Decimal(102) },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.annualizedRate.toFixed(4)).toBe("0.0827");
    }
  });
});
