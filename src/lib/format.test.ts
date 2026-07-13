import { describe, expect, test } from "vitest";

import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatMoneyInputDisplay,
  formatPercent,
  formatQuantity,
  formatSignedPercent,
  parseMoneyInputValue,
  signColorClass,
} from "./format";

describe("formatMoney", () => {
  test("format số dương thành VND", () => {
    const formatted = formatMoney("10000000");
    expect(formatted).toMatch(/^10\.000\.000\s₫$/);
  });

  test("hidden = true trả về chuỗi che thay vì số tiền", () => {
    expect(formatMoney("10000000", { hidden: true })).toBe("••••••");
  });

  test("số âm vẫn format đúng dấu", () => {
    const formatted = formatMoney("-10000000");
    expect(formatted).toMatch(/^-10\.000\.000\s₫$/);
  });

  test("compact: dưới 1.000 giữ nguyên định dạng đầy đủ", () => {
    expect(formatMoney("999", { compact: true })).toMatch(/^999\s₫$/);
  });

  test("compact: 1.000 rút gọn thành k", () => {
    expect(formatMoney("1000", { compact: true })).toBe("1k");
  });

  test("compact: 999.000 rút gọn thành k", () => {
    expect(formatMoney("999000", { compact: true })).toBe("999k");
  });

  test("compact: 200.000 rút gọn thành k", () => {
    expect(formatMoney("200000", { compact: true })).toBe("200k");
  });

  test("compact: 1.000.000 rút gọn thành tr", () => {
    expect(formatMoney("1000000", { compact: true })).toBe("1tr");
  });

  test("compact: 999.000.000 rút gọn thành tr", () => {
    expect(formatMoney("999000000", { compact: true })).toBe("999tr");
  });

  test("compact: 200.000.000 rút gọn thành tr", () => {
    expect(formatMoney("200000000", { compact: true })).toBe("200tr");
  });

  test("compact: 1.000.000.000 rút gọn thành tỷ", () => {
    expect(formatMoney("1000000000", { compact: true })).toBe("1 tỷ");
  });

  test("compact: 1.500.000.000 rút gọn thành tỷ có thập phân", () => {
    expect(formatMoney("1500000000", { compact: true })).toBe("1,5 tỷ");
  });

  test("compact: số âm vẫn giữ dấu", () => {
    expect(formatMoney("-200000", { compact: true })).toBe("-200k");
  });

  test("compact: bằng 0 giữ nguyên định dạng đầy đủ", () => {
    expect(formatMoney("0", { compact: true })).toMatch(/^0\s₫$/);
  });

  test("compact kết hợp hidden -> vẫn ưu tiên che số", () => {
    expect(formatMoney("2000000", { compact: true, hidden: true })).toBe(
      "••••••",
    );
  });

  test("compact = false giữ nguyên định dạng đầy đủ như không truyền option", () => {
    expect(formatMoney("10000000", { compact: false })).toBe(
      formatMoney("10000000"),
    );
  });
});

describe("formatQuantity", () => {
  test("gắn đơn vị vào sau số lượng", () => {
    expect(formatQuantity("100", "cổ phần")).toBe("100 cổ phần");
  });

  test("giữ tối đa 4 chữ số thập phân", () => {
    expect(formatQuantity("1.5", "chỉ")).toBe("1,5 chỉ");
  });
});

describe("formatDate", () => {
  test("format dd/MM/yyyy theo giờ Asia/Ho_Chi_Minh", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00.000Z"))).toBe("01/01/2026");
  });

  test("nhận string ISO", () => {
    expect(formatDate("2026-07-09T00:00:00.000Z")).toBe("09/07/2026");
  });
});

describe("formatDayMonth", () => {
  test("format dd/MM theo giờ Asia/Ho_Chi_Minh, không kèm năm", () => {
    expect(formatDayMonth(new Date("2026-07-09T00:00:00.000Z"))).toBe("09/07");
  });
});

describe("formatSignedPercent", () => {
  test("số dương -> dấu +", () => {
    expect(formatSignedPercent(12.34)).toBe("+12,3%");
  });

  test("số âm -> dấu − (KHÔNG phải dấu trừ ASCII thường)", () => {
    expect(formatSignedPercent(-4.5)).toBe("−4,5%");
  });

  test("bằng 0 -> không có dấu +/−", () => {
    expect(formatSignedPercent(0)).toBe("0,0%");
  });

  test("luôn giữ đúng 1 chữ số thập phân dù input là số nguyên", () => {
    expect(formatSignedPercent(8)).toBe("+8,0%");
  });

  test("suffix tuỳ chọn (vd '/năm' cho XIRR)", () => {
    expect(formatSignedPercent(-0.9991 * 100, { suffix: "/năm" })).toBe(
      "−99,9%/năm",
    );
  });
});

describe("formatPercent", () => {
  test("làm tròn đúng 1 chữ số thập phân, không có dấu +/−", () => {
    expect(formatPercent(60.924587865454434)).toBe("60,9%");
  });

  test("số nguyên vẫn giữ đúng 1 chữ số thập phân", () => {
    expect(formatPercent(60)).toBe("60,0%");
  });
});

describe("parseMoneyInputValue", () => {
  test("số nguyên thô giữ nguyên", () => {
    expect(parseMoneyInputValue("1000000")).toBe("1000000");
  });

  test("chuỗi có dấu chấm nhóm hàng nghìn -> bỏ hết dấu chấm", () => {
    expect(parseMoneyInputValue("1.000.000")).toBe("1000000");
  });

  test("chuỗi có dấu phẩy thập phân -> đổi thành dấu chấm", () => {
    expect(parseMoneyInputValue("1000,5")).toBe("1000.5");
  });

  test("chuỗi hỗn hợp cả dấu chấm nhóm và dấu phẩy thập phân", () => {
    expect(parseMoneyInputValue("1.234,5")).toBe("1234.5");
  });

  test("dán nguyên formatMoney output kèm ký hiệu ₫ và khoảng trắng", () => {
    expect(parseMoneyInputValue("1.234.567 ₫")).toBe("1234567");
  });

  test("chuỗi rỗng -> chuỗi rỗng", () => {
    expect(parseMoneyInputValue("")).toBe("");
  });
});

describe("formatMoneyInputDisplay", () => {
  test("số nguyên nhỏ -> không thêm dấu chấm", () => {
    expect(formatMoneyInputDisplay("999")).toBe("999");
  });

  test("số lớn -> thêm đúng dấu chấm mỗi 3 số", () => {
    expect(formatMoneyInputDisplay("1000000")).toBe("1.000.000");
  });

  test("có phần thập phân -> đổi dấu chấm thập phân thành dấu phẩy", () => {
    expect(formatMoneyInputDisplay("1234.5")).toBe("1.234,5");
  });

  test("dấu chấm cuối chưa có số thập phân theo sau -> giữ dấu phẩy hiển thị", () => {
    expect(formatMoneyInputDisplay("1234.")).toBe("1.234,");
  });

  test("chuỗi rỗng -> chuỗi rỗng", () => {
    expect(formatMoneyInputDisplay("")).toBe("");
  });
});

describe("signColorClass", () => {
  test("dương -> text-gain", () => {
    expect(signColorClass(5)).toBe("text-gain");
  });

  test("âm -> text-destructive", () => {
    expect(signColorClass(-5)).toBe("text-destructive");
  });

  test("bằng 0 -> text-foreground", () => {
    expect(signColorClass(0)).toBe("text-foreground");
  });
});
