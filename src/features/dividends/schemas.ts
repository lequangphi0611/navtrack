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
  // Ngày tiền/CP thực về tài khoản — thuần thông tin, KHÔNG dùng cho tính
  // toán nào (xem comment Dividend.paymentDate, prisma/schema.prisma). User
  // có thể bỏ trống.
  paymentDate: z.coerce.date({ error: "Ngày không hợp lệ" }).optional(),
  // Issue #61: user tick khi giá hiện có (PriceQuote/NavOverride) ĐÃ phản
  // ánh đúng thị trường sau chia tách/chia cổ tức (vd job giá đã chạy lại,
  // hoặc user vừa tự cập nhật giá tay) -> bỏ qua bước tự tạo NavOverride bù
  // pha loãng ở Server Action. Submit qua hidden input chuỗi "true"/"false"
  // (KHÔNG phải checkbox thô) -> PHẢI dùng z.enum + transform, KHÔNG dùng
  // z.coerce.boolean() (coerce.boolean() coi MỌI string non-empty, kể cả
  // "false", là true — sai hoàn toàn logic checkbox).
  priceAlreadyReflectsMarket: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export type RecordDividendInput = z.infer<typeof recordDividendSchema>;
