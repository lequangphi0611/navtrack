import { describe, expect, test } from "vitest";

import {
  addTransactionSchema,
  bondTermsSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  settleMaturitySchema,
  updateTransactionSchema,
} from "./schemas";

const validTransactionFields = {
  cashflowType: "BUY" as const,
  date: "2026-01-01",
  quantity: "100",
  pricePerUnit: "100000",
};

// `intent` chỉ thuộc newHoldingSchema — addTransactionSchema/updateTransactionSchema
// không khai field này, nhưng zod object mặc định (không `.strict()`) âm thầm
// bỏ qua key lạ, nên gộp chung vào validTransactionFields không ảnh hưởng 2
// describe block kia.
const validTransactionFieldsHistorical = {
  ...validTransactionFields,
  intent: "HISTORICAL" as const,
};

describe("newHoldingSchema", () => {
  test("chấp nhận input hợp lệ, feeAmount/taxAmount mặc định là 0", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feeAmount).toBe("0");
      expect(result.data.taxAmount).toBe("0");
    }
  });

  test("symbol rỗng bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "  ",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
    });
    expect(result.success).toBe(false);
  });

  // Cùng bất biến với addTransactionSchema — `transactionFields` dùng chung
  // nên cả hai phải cùng từ chối (xem comment ở đó).
  test("cashflowType = MATURITY bị từ chối khi tạo vị thế mới", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "VCB2028",
      type: "BOND",
      unit: "trái phiếu",
      ...validTransactionFieldsHistorical,
      cashflowType: "MATURITY",
    });
    expect(result.success).toBe(false);
  });

  test("type ngoài enum AssetType bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "CRYPTO",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
    });
    expect(result.success).toBe(false);
  });

  test("quantity = 0 bị từ chối (phải > 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      quantity: "0",
    });
    expect(result.success).toBe(false);
  });

  test("quantity âm bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      quantity: "-100",
    });
    expect(result.success).toBe(false);
  });

  test("quantity không phải số bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      quantity: "abc",
    });
    expect(result.success).toBe(false);
  });

  test("quantity có khoảng trắng thừa được trim và chấp nhận", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      quantity: "  100  ",
    });
    expect(result.success).toBe(true);
  });

  test("pricePerUnit = 0 bị từ chối (phải > 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      pricePerUnit: "0",
    });
    expect(result.success).toBe(false);
  });

  test("feeAmount = 0 hợp lệ (chỉ cấm âm, không cấm 0)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      feeAmount: "0",
    });
    expect(result.success).toBe(true);
  });

  test("feeAmount âm bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      feeAmount: "-1",
    });
    expect(result.success).toBe(false);
  });

  test("date không hợp lệ bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  // Phase 5 (docs/domain/07-tax.md "Quy tắc & bất biến"): VN không đánh thuế
  // TNCN khi mua — server phải chặn taxAmount khác 0 cho BUY dù request tới
  // bằng cách nào (không tin client, form chỉ ẩn field ở UI). Nếu refine này
  // bị revert/xoá, test dưới sẽ fail vì input rõ ràng phải bị từ chối.
  test("BUY kèm taxAmount khác 0 bị từ chối (VN không đánh thuế khi mua)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      cashflowType: "BUY",
      taxAmount: "5200",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "taxAmount",
      );
      expect(issue?.message).toBe("Giao dịch mua không có thuế");
    }
  });

  test("BUY với taxAmount = 0 (mặc định) được chấp nhận", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      cashflowType: "BUY",
    });
    expect(result.success).toBe(true);
  });

  // buyHasNoTax so sánh bằng giá trị Decimal, không phải string "=== 0" —
  // các biểu diễn khác của 0 vẫn phải được chấp nhận cho BUY.
  test('BUY với taxAmount = "0.00" (biểu diễn khác của 0) được chấp nhận', () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      cashflowType: "BUY",
      taxAmount: "0.00",
    });
    expect(result.success).toBe(true);
  });

  test("SELL kèm taxAmount khác 0 được chấp nhận (thuế bán hợp lệ)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFieldsHistorical,
      cashflowType: "SELL",
      taxAmount: "5200",
    });
    expect(result.success).toBe(true);
  });

  // Issue #142 — intent BẮT BUỘC, không default: thiếu hẳn key phải là lỗi
  // tường minh (xem comment newHoldingIntentEnum ở schemas.ts).
  test("thiếu intent bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("intent ngoài enum bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      intent: "SOMETHING_ELSE",
    });
    expect(result.success).toBe(false);
  });

  // Guard ngày tương lai CHỈ áp cho nhánh "Vừa mua hôm nay" — issue #142.
  test("NEW_PURCHASE + ngày tương lai bị từ chối", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "MWG",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      intent: "NEW_PURCHASE",
      date: "2099-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "date",
      );
      expect(issue?.message).toBe("Ngày mua không thể ở tương lai");
    }
  });

  test("NEW_PURCHASE + ngày hôm nay hợp lệ", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "MWG",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      intent: "NEW_PURCHASE",
      date: new Date().toISOString().slice(0, 10),
    });
    expect(result.success).toBe(true);
  });

  test("NEW_PURCHASE + ngày quá khứ hợp lệ", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "MWG",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      intent: "NEW_PURCHASE",
      date: "2020-01-01",
    });
    expect(result.success).toBe(true);
  });

  // HISTORICAL ("Đã có từ trước") KHÔNG bị chặn ngày tương lai — khai báo tự
  // do, khác hẳn NEW_PURCHASE (guard không áp dụng ở nhánh này).
  test("HISTORICAL + ngày tương lai vẫn hợp lệ (guard không áp)", () => {
    const result = newHoldingSchema.safeParse({
      symbol: "FPT",
      type: "STOCK",
      unit: "cổ phần",
      ...validTransactionFields,
      intent: "HISTORICAL",
      date: "2099-01-01",
    });
    expect(result.success).toBe(true);
  });

  // buyHasNoTax không regress khi thêm guard ngày tương lai — cả 2 intent vẫn
  // phải chặn taxAmount khác 0 cho BUY.
  test("buyHasNoTax vẫn áp dụng cho cả 2 intent", () => {
    for (const intent of ["HISTORICAL", "NEW_PURCHASE"] as const) {
      const result = newHoldingSchema.safeParse({
        symbol: "FPT",
        type: "STOCK",
        unit: "cổ phần",
        ...validTransactionFields,
        intent,
        cashflowType: "BUY",
        taxAmount: "5200",
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("addTransactionSchema", () => {
  test("thiếu holdingId bị từ chối", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("input hợp lệ được chấp nhận", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "holding-1",
      ...validTransactionFields,
    });
    expect(result.success).toBe(true);
  });

  // Cùng bất biến với newHoldingSchema ở trên — addTransaction là đường ghi
  // giao dịch cho holding ĐÃ TỒN TẠI, cùng lỗ hổng nếu thiếu refine.
  test("BUY kèm taxAmount khác 0 bị từ chối", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "holding-1",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "1000",
    });
    expect(result.success).toBe(false);
  });

  // `MATURITY` có trong CASHFLOW_TYPES (Prisma enum) nhưng KHÔNG được tạo mới
  // qua form giao dịch thường: đường đó bỏ qua kiểm tra `holding.type ===
  // "BOND"` + `BondTerms` tồn tại của settleMaturity, và cho ghi một dòng đáo
  // hạn lên vị thế bất kỳ (kể cả vàng). Form đã khoá ở UI — đây là chốt chặn
  // server (review PR #102).
  test("tạo mới cashflowType = MATURITY bị từ chối", () => {
    const result = addTransactionSchema.safeParse({
      holdingId: "holding-1",
      ...validTransactionFields,
      cashflowType: "MATURITY",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  test("thiếu cashflowId bị từ chối", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "",
      ...validTransactionFields,
    });
    expect(result.success).toBe(false);
  });

  test("cashflowType SELL với input hợp lệ được chấp nhận", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "cf-1",
      ...validTransactionFields,
      cashflowType: "SELL",
    });
    expect(result.success).toBe(true);
  });

  // Ca quan trọng nhất trong 3 schema: sửa MỘT giao dịch đã ghi từ SELL (có
  // taxAmount > 0) sang BUY qua form sửa — server phải chặn, không chỉ
  // newHoldingSchema/addTransactionSchema mới cần refine này.
  test("sửa giao dịch đổi cashflowType sang BUY nhưng vẫn còn taxAmount cũ -> bị từ chối", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "cf-1",
      ...validTransactionFields,
      cashflowType: "BUY",
      taxAmount: "5200",
    });
    expect(result.success).toBe(false);
  });

  // Khác addTransactionSchema: schema SỬA phải NHẬN `MATURITY`, vì form gửi
  // lên nguyên loại của dòng đang sửa — chặn ở tầng schema thì không sửa nổi
  // ngày/số lượng của một dòng đáo hạn. Việc chặn ĐỔI loại nằm ở
  // updateTransaction (cần đọc loại đang lưu trong DB).
  test("sửa một dòng MATURITY (giữ nguyên loại) được schema chấp nhận", () => {
    const result = updateTransactionSchema.safeParse({
      cashflowId: "cf-1",
      ...validTransactionFields,
      cashflowType: "MATURITY",
    });
    expect(result.success).toBe(true);
  });
});

describe("deleteTransactionSchema", () => {
  test("thiếu cashflowId bị từ chối", () => {
    expect(deleteTransactionSchema.safeParse({ cashflowId: "" }).success).toBe(
      false,
    );
  });

  test("có cashflowId được chấp nhận", () => {
    expect(
      deleteTransactionSchema.safeParse({ cashflowId: "cf-1" }).success,
    ).toBe(true);
  });
});

describe("navOverrideSchema", () => {
  test("input hợp lệ được chấp nhận", () => {
    const result = navOverrideSchema.safeParse({
      holdingId: "holding-1",
      price: "7720000",
      date: "2026-07-11",
    });
    expect(result.success).toBe(true);
  });

  test("thiếu holdingId bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "",
        price: "7720000",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("price = 0 bị từ chối (phải > 0)", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "0",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("price âm bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "-100",
        date: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  test("date không hợp lệ bị từ chối", () => {
    expect(
      navOverrideSchema.safeParse({
        holdingId: "holding-1",
        price: "7720000",
        date: "not-a-date",
      }).success,
    ).toBe(false);
  });
});

// Phase 7 (issue #58/#101) — điều khoản trái phiếu và tất toán đáo hạn.
describe("bondTermsSchema", () => {
  const required = {
    holdingId: "holding-1",
    issuerType: "CORPORATE" as const,
    parValue: "100000000",
  };
  const emptyCoupon = {
    couponRatePercent: "",
    couponFrequencyMonths: "",
    firstCouponDate: "",
    maturityDate: "",
  };

  test("đủ cụm coupon -> parse ra Date/number đúng kiểu", () => {
    const result = bondTermsSchema.safeParse({
      ...required,
      couponRatePercent: "9",
      couponFrequencyMonths: "6",
      firstCouponDate: "2026-01-15",
      maturityDate: "2029-01-15",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.couponRatePercent).toBe("9");
    expect(result.data.couponFrequencyMonths).toBe(6);
    expect(result.data.firstCouponDate).toBeInstanceOf(Date);
    expect(result.data.maturityDate).toBeInstanceOf(Date);
  });

  // Bàn phím số locale VN gõ ra dấu phẩy ("9,8") — decimal.js chỉ nhận dấu
  // chấm, decimalString() phải tự chuẩn hoá trước khi validate (bug thật: user
  // báo "Dữ liệu không hợp lệ" dù preview client-side hiện đúng số).
  test("lãi suất gõ dấu phẩy thập phân (locale VN) -> chuẩn hoá thành dấu chấm, không bị từ chối", () => {
    const result = bondTermsSchema.safeParse({
      ...required,
      ...emptyCoupon,
      couponRatePercent: "9,8",
      couponFrequencyMonths: "6",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.couponRatePercent).toBe("9.8");
  });

  // Trái phiếu chiết khấu/zero-coupon hợp lệ mà không có kỳ trả lãi nào —
  // "thiếu field optional là bình thường, không phải lỗi"
  // (docs/domain/10-cashflow-calendar.md).
  test("zero-coupon: bỏ trống cả cụm coupon -> hợp lệ, quy về null", () => {
    const result = bondTermsSchema.safeParse({ ...required, ...emptyCoupon });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.couponRatePercent).toBeNull();
    expect(result.data.couponFrequencyMonths).toBeNull();
    expect(result.data.firstCouponDate).toBeNull();
    expect(result.data.maturityDate).toBeNull();
  });

  // Chuỗi rỗng KHÔNG được lọt qua z.coerce.number() thành số 0 — "kỳ trả lãi 0
  // tháng" sẽ làm buildCouponSchedule() sinh lịch vô nghĩa.
  test("kỳ trả lãi 0 hoặc không nguyên -> từ chối", () => {
    for (const value of ["0", "-6", "6.5"]) {
      const result = bondTermsSchema.safeParse({
        ...required,
        ...emptyCoupon,
        couponFrequencyMonths: value,
      });
      expect(result.success).toBe(false);
    }
  });

  test("thiếu mệnh giá -> từ chối (không tính được tiền lẫn thuế)", () => {
    const result = bondTermsSchema.safeParse({
      ...required,
      ...emptyCoupon,
      parValue: "",
    });
    expect(result.success).toBe(false);
  });

  test("đáo hạn trước kỳ trả lãi đầu -> từ chối ngay lúc nhập", () => {
    const result = bondTermsSchema.safeParse({
      ...required,
      ...emptyCoupon,
      firstCouponDate: "2029-01-15",
      maturityDate: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("settleMaturitySchema", () => {
  const valid = {
    holdingId: "holding-1",
    date: "2029-01-15",
    quantity: "2",
    pricePerUnit: "100000000",
  };

  test("chấp nhận input tối thiểu; thuế/phí optional (server tự tính)", () => {
    const result = settleMaturitySchema.safeParse(valid);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.taxAmount).toBeUndefined();
    expect(result.data.feeAmount).toBeUndefined();
  });

  test("nhận thuế sửa tay (prefill, không khoá field)", () => {
    const result = settleMaturitySchema.safeParse({
      ...valid,
      taxAmount: "800000",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.taxAmount).toBe("800000");
  });

  // Loại giao dịch là HẰNG SỐ của luồng này, không phải input — client không có
  // cách nào ghi một dòng SELL (chịu thuế chuyển nhượng 0,1%) qua đường này.
  test("không nhận cashflowType từ client", () => {
    const result = settleMaturitySchema.safeParse({
      ...valid,
      cashflowType: "SELL",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("cashflowType");
  });

  test("số lượng/giá phải lớn hơn 0", () => {
    expect(
      settleMaturitySchema.safeParse({ ...valid, quantity: "0" }).success,
    ).toBe(false);
    expect(
      settleMaturitySchema.safeParse({ ...valid, pricePerUnit: "0" }).success,
    ).toBe(false);
  });
});
