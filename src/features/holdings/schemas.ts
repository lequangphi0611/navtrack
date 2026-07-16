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

function nonNegativeDecimal(message: string) {
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

export const newHoldingSchema = z.object({
  symbol: z.string().trim().min(1, "Nhập mã"),
  type: assetTypeEnum,
  unit: z.string().trim().min(1, "Nhập đơn vị"),
  name: z.string().trim().optional(),
  ...transactionFields,
});

export const addTransactionSchema = z.object({
  holdingId: z.string().min(1, "Thiếu mã danh mục"),
  ...transactionFields,
});

export const updateTransactionSchema = z.object({
  cashflowId: z.string().min(1, "Thiếu giao dịch"),
  ...transactionFields,
});

export const deleteTransactionSchema = z.object({
  cashflowId: z.string().min(1, "Thiếu giao dịch"),
});

export const navOverrideSchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  price: positiveDecimal("Giá phải lớn hơn 0"),
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
});
