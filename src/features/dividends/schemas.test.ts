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
