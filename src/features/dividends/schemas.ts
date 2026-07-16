import { z } from "zod";

// Tái dùng positiveDecimal/nonNegativeDecimal của holdings/schemas.ts (không
// chép lại logic validate Decimal — xem docs/rules/typescript-style.md).
import {
  nonNegativeDecimal,
  positiveDecimal,
} from "@/features/holdings/schemas";

export const dividendTypeEnum = z.enum(["CASH", "STOCK"]);

export const recordDividendSchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  type: dividendTypeEnum,
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
  percent: positiveDecimal("Tỷ lệ phải lớn hơn 0"),
  // Chỉ có ý nghĩa khi type === "STOCK" — cho phép user tự sửa stockQuantity
  // khi hệ thống làm tròn sai lệch với quy ước của công ty phát hành. Validate
  // tolerance (isStockQuantityOverrideValid) diễn ra trong Server Action, không
  // ở schema này vì cần rawStockQuantity tính từ SL-tại-ngày-ghi (đọc DB).
  stockQuantityOverride: nonNegativeDecimal("Số lượng không hợp lệ").optional(),
});

export type RecordDividendInput = z.infer<typeof recordDividendSchema>;
