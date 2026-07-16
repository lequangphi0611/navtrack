import { z } from "zod";

// Tái dùng positiveDecimal của holdings/schemas.ts (không chép lại logic
// validate Decimal — xem docs/rules/typescript-style.md).
import { positiveDecimal } from "@/features/holdings/schemas";

export const dividendTypeEnum = z.enum(["CASH", "STOCK"]);

export const recordDividendSchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  type: dividendTypeEnum,
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
  percent: positiveDecimal("Tỷ lệ phải lớn hơn 0"),
});

export type RecordDividendInput = z.infer<typeof recordDividendSchema>;
