import Decimal from "decimal.js";
import { z } from "zod";

export const assetTypeEnum = z.enum(["STOCK", "FUND", "BOND", "GOLD"]);
export const cashflowTypeEnum = z.enum(["BUY", "SELL"]);

function decimalString(message: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      try {
        return new Decimal(value).isFinite();
      } catch {
        return false;
      }
    }, message);
}

// Exported để tái dùng ở features/dividends/schemas.ts (recordDividendSchema.percent) —
// tránh chép lại logic validate Decimal dương.
export function positiveDecimal(message: string) {
  return decimalString(message).refine((value) => {
    try {
      return new Decimal(value).gt(0);
    } catch {
      return false;
    }
  }, message);
}

// Exported để tái dùng ở features/dividends/schemas.ts
// (recordDividendSchema.stockQuantityOverride) — tránh chép lại logic validate
// Decimal không âm.
export function nonNegativeDecimal(message: string) {
  return decimalString(message).refine((value) => {
    try {
      return new Decimal(value).gte(0);
    } catch {
      return false;
    }
  }, message);
}

const transactionFields = {
  cashflowType: cashflowTypeEnum,
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
  quantity: positiveDecimal("Số lượng phải lớn hơn 0"),
  pricePerUnit: positiveDecimal("Giá phải lớn hơn 0"),
  feeAmount: nonNegativeDecimal("Phí không hợp lệ").default("0"),
  taxAmount: nonNegativeDecimal("Thuế không hợp lệ").default("0"),
  note: z.string().trim().optional(),
};

// VN không đánh thuế TNCN khi mua chứng khoán/CCQ (docs/domain/07-tax.md mục
// "Quy tắc & bất biến") — form ẩn hẳn field thuế khi BUY, nhưng đó chỉ là UI.
// Chặn lại ở server: taxAmount khác 0 kèm cashflowType BUY là dữ liệu không
// hợp lệ dù lọt qua bằng cách nào (request tay/devtools) — "không tin client"
// (CLAUDE.md). Hàm thuần tách riêng để 3 schema dưới đây dùng chung, tránh
// lặp lại cùng một điều kiện. So sánh bằng giá trị Decimal (không phải string
// `=== "0"`) — taxAmount đã qua nonNegativeDecimal ở field-level nên luôn parse
// được; tránh từ chối nhầm các biểu diễn khác của 0 ("0.0", "0.00") nếu sau
// này có nguồn gửi request khác ngoài form (form hiện tại luôn gửi literal "0").
function buyHasNoTax(data: {
  cashflowType: "BUY" | "SELL";
  taxAmount: string;
}): boolean {
  return data.cashflowType !== "BUY" || new Decimal(data.taxAmount).isZero();
}

const BUY_HAS_NO_TAX_ISSUE = {
  message: "Giao dịch mua không có thuế",
  path: ["taxAmount"],
};

export const newHoldingSchema = z
  .object({
    symbol: z.string().trim().min(1, "Nhập mã"),
    type: assetTypeEnum,
    unit: z.string().trim().min(1, "Nhập đơn vị"),
    name: z.string().trim().optional(),
    ...transactionFields,
  })
  .refine(buyHasNoTax, BUY_HAS_NO_TAX_ISSUE);

export const addTransactionSchema = z
  .object({
    holdingId: z.string().min(1, "Thiếu mã danh mục"),
    ...transactionFields,
  })
  .refine(buyHasNoTax, BUY_HAS_NO_TAX_ISSUE);

export const updateTransactionSchema = z
  .object({
    cashflowId: z.string().min(1, "Thiếu giao dịch"),
    ...transactionFields,
  })
  .refine(buyHasNoTax, BUY_HAS_NO_TAX_ISSUE);

export const deleteTransactionSchema = z.object({
  cashflowId: z.string().min(1, "Thiếu giao dịch"),
});

export const navOverrideSchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  price: positiveDecimal("Giá phải lớn hơn 0"),
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
});
