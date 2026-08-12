import { describe, expect, test } from "vitest";

import { recordDividendSchema } from "./schemas";

const validFields = {
  holdingId: "holding-1",
  type: "CASH" as const,
  date: "2026-02-01",
  percent: "10",
};

describe("recordDividendSchema", () => {
  test("chấp nhận input hợp lệ không có paymentDate", () => {
    const result = recordDividendSchema.safeParse(validFields);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentDate).toBeUndefined();
      expect(result.data.priceAlreadyReflectsMarket).toBe(false);
    }
  });

  // Review PR #62 finding #3: paymentDate (ngày tiền/CP thực về) không thể
  // sớm hơn date (ngày chia) — bắt lỗi gõ nhầm rõ ràng.
  test("paymentDate sớm hơn date bị từ chối", () => {
    const result = recordDividendSchema.safeParse({
      ...validFields,
      date: "2026-02-01",
      paymentDate: "2026-01-15",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "paymentDate",
      );
      expect(issue?.message).toBe("Ngày thanh toán không thể trước ngày chia");
    }
  });

  test("paymentDate bằng đúng date được chấp nhận", () => {
    const result = recordDividendSchema.safeParse({
      ...validFields,
      date: "2026-02-01",
      paymentDate: "2026-02-01",
    });

    expect(result.success).toBe(true);
  });

  test("paymentDate sau date được chấp nhận", () => {
    const result = recordDividendSchema.safeParse({
      ...validFields,
      date: "2026-02-01",
      paymentDate: "2026-02-15",
    });

    expect(result.success).toBe(true);
  });

  test('priceAlreadyReflectsMarket="false" (chuỗi) chuyển thành boolean false, không phải true', () => {
    // Bug đã tránh: z.coerce.boolean() coi mọi string non-empty (kể cả
    // "false") là true — recordDividendSchema PHẢI dùng z.enum + transform.
    const result = recordDividendSchema.safeParse({
      ...validFields,
      priceAlreadyReflectsMarket: "false",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceAlreadyReflectsMarket).toBe(false);
    }
  });
});

// Phase 7 (issue #58) — trái tức không có ô % nào (mệnh giá/lãi suất là điều
// khoản hợp đồng đọc từ BondTerms), nhưng CASH/STOCK thì vẫn bắt buộc.
describe("recordDividendSchema — trái tức (BOND_COUPON)", () => {
  const bondFields = {
    holdingId: "holding-1",
    type: "BOND_COUPON" as const,
    date: "2026-07-15",
  };

  test("BOND_COUPON hợp lệ khi KHÔNG có percent", () => {
    const result = recordDividendSchema.safeParse(bondFields);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.percent).toBeUndefined();
  });

  test("nới lỏng percent KHÔNG lan sang CASH/STOCK", () => {
    for (const type of ["CASH", "STOCK"] as const) {
      const result = recordDividendSchema.safeParse({
        holdingId: "holding-1",
        type,
        date: "2026-02-01",
      });
      expect(result.success).toBe(false);
    }
  });

  test("BOND_COUPON nhận thuế sửa tay (prefill, không khoá field)", () => {
    const result = recordDividendSchema.safeParse({
      ...bondFields,
      taxAmount: "430000",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.taxAmount).toBe("430000");
  });

  // "Không tin client": CASH tự tính thuế từ Setting, một request tay gửi kèm
  // taxAmount phải bị TỪ CHỐI thay vì bị bỏ qua âm thầm.
  test("CASH/STOCK gửi kèm taxAmount -> từ chối", () => {
    for (const type of ["CASH", "STOCK"] as const) {
      const result = recordDividendSchema.safeParse({
        holdingId: "holding-1",
        type,
        date: "2026-02-01",
        percent: "10",
        taxAmount: "1",
      });
      expect(result.success).toBe(false);
    }
  });

  // Mirror tiền lệ taxAmount: gộp tự tính từ BondTerms cũng chỉ PREFILL, user
  // sửa tay được (vd lãi suất thả nổi lệch số thực nhận trên sao kê phát hành).
  test("BOND_COUPON nhận lãi gộp sửa tay (prefill, không khoá field)", () => {
    const result = recordDividendSchema.safeParse({
      ...bondFields,
      grossAmount: "5000000",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.grossAmount).toBe("5000000");
  });

  // "Không tin client": CASH/STOCK tính gộp từ % nên một request tay gửi kèm
  // grossAmount phải bị TỪ CHỐI thay vì bị bỏ qua âm thầm.
  test("CASH/STOCK gửi kèm grossAmount -> từ chối", () => {
    for (const type of ["CASH", "STOCK"] as const) {
      const result = recordDividendSchema.safeParse({
        holdingId: "holding-1",
        type,
        date: "2026-02-01",
        percent: "10",
        grossAmount: "1",
      });
      expect(result.success).toBe(false);
    }
  });
});
