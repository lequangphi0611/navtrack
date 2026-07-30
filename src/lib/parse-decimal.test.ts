import { describe, expect, test } from "vitest";

import { normalizeDecimalInput, parseDecimalOrNull } from "./parse-decimal";

describe("normalizeDecimalInput", () => {
  test("thay dấu phẩy đầu tiên bằng dấu chấm", () => {
    expect(normalizeDecimalInput("9,8")).toBe("9.8");
  });

  test("không có dấu phẩy -> giữ nguyên", () => {
    expect(normalizeDecimalInput("9.8")).toBe("9.8");
    expect(normalizeDecimalInput("100000")).toBe("100000");
  });

  test("nhiều dấu phẩy (gõ nhầm) -> chỉ thay dấu đầu tiên, phần còn lại vẫn rác có chủ đích (để bị từ chối ở bước parse sau)", () => {
    expect(normalizeDecimalInput("1,234,56")).toBe("1.234,56");
  });
});

describe("parseDecimalOrNull", () => {
  test("chuỗi rỗng/khoảng trắng -> null (đang gõ dở dang, không phải lỗi)", () => {
    expect(parseDecimalOrNull("")).toBeNull();
    expect(parseDecimalOrNull("   ")).toBeNull();
  });

  test("dấu phẩy thập phân (locale VN) -> chuẩn hoá và parse đúng", () => {
    expect(parseDecimalOrNull("9,8")?.toString()).toBe("9.8");
    expect(parseDecimalOrNull("2,5")?.toString()).toBe("2.5");
  });

  test("dấu chấm thập phân -> parse đúng như cũ", () => {
    expect(parseDecimalOrNull("9.8")?.toString()).toBe("9.8");
  });

  test("chuỗi không phải số -> null, không throw", () => {
    expect(parseDecimalOrNull("-")).toBeNull();
    expect(parseDecimalOrNull("abc")).toBeNull();
  });
});
