import { z } from "zod";

// Tái dùng positiveDecimal/nonNegativeDecimal của holdings/schemas.ts (không
// chép lại logic validate Decimal — xem docs/rules/typescript-style.md).
import {
  nonNegativeDecimal,
  positiveDecimal,
} from "@/features/holdings/schemas";
import { DIVIDEND_TYPES } from "@/lib/enums";

export const dividendTypeEnum = z.enum(DIVIDEND_TYPES);

export const recordDividendSchema = z
  .object({
    holdingId: z.string().min(1, "Thiếu vị thế"),
    type: dividendTypeEnum,
    date: z.coerce.date({ error: "Ngày không hợp lệ" }),
    // Optional ở tầng field vì BOND_COUPON KHÔNG có ô % nào (mệnh giá/lãi suất
    // là điều khoản hợp đồng đọc từ BondTerms — docs/domain/03-dividends.md
    // "Cách tính", nhánh BOND_COUPON). Bắt buộc lại theo type ở refine bên dưới,
    // không nới lỏng cho CASH/STOCK.
    percent: positiveDecimal("Tỷ lệ phải lớn hơn 0").optional(),
    // Chỉ có ý nghĩa khi type === "BOND_COUPON": thuế app tự tính là PREFILL,
    // user sửa tay được để khớp số tổ chức phát hành thực khấu trừ
    // (docs/domain/07-tax.md "Form chỉ prefill, KHÔNG khoá field"). CASH tự
    // tính thuế và KHÔNG nhận override — chặn ở refine bên dưới thay vì âm thầm
    // bỏ qua ("không tin client", cùng tinh thần buyHasNoTax ở holdings/schemas.ts).
    taxAmount: nonNegativeDecimal("Thuế không hợp lệ").optional(),
    // Chỉ có ý nghĩa khi type === "STOCK" — cho phép user tự sửa stockQuantity
    // khi hệ thống làm tròn sai lệch với quy ước của công ty phát hành. Validate
    // tolerance (isStockQuantityOverrideValid) diễn ra trong Server Action, không
    // ở schema này vì cần rawStockQuantity tính từ SL-tại-ngày-ghi (đọc DB).
    stockQuantityOverride: nonNegativeDecimal(
      "Số lượng không hợp lệ",
    ).optional(),
    // Ngày tiền/CP thực về tài khoản. Với CASH: mốc dòng tiền dùng để tính
    // XIRR (fallback `date` khi bỏ trống) — xem buildXirrCashflows
    // (src/lib/xirr-cashflow.ts). Với STOCK: thuần thông tin, không dùng cho
    // tính toán nào (STOCK không tạo dòng tiền XIRR). Không ảnh hưởng
    // NavOverride bù pha loãng ở cả 2 loại (mốc đó luôn là `date`). User có
    // thể bỏ trống.
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
  })
  // `paymentDate` là ngày tiền/CP THỰC VỀ — không thể sớm hơn `date` (ngày
  // chia) về mặt nghiệp vụ. Với CASH, paymentDate giờ là mốc dòng tiền XIRR
  // nên validate này còn chặn cả việc lệch chuỗi dòng tiền theo thời gian,
  // không chỉ bắt lỗi gõ nhầm ngày như trước (review PR #62, finding #3).
  .refine((data) => !data.paymentDate || data.paymentDate >= data.date, {
    message: "Ngày thanh toán không thể trước ngày chia",
    path: ["paymentDate"],
  })
  // CASH/STOCK tính số tiền/số lượng TỪ % nên thiếu % là không tính được gì;
  // BOND_COUPON không có % (xem comment ở field).
  .refine((data) => data.type === "BOND_COUPON" || data.percent !== undefined, {
    message: "Nhập tỷ lệ cổ tức",
    path: ["percent"],
  })
  .refine(
    (data) => data.type === "BOND_COUPON" || data.taxAmount === undefined,
    {
      message: "Loại cổ tức này không nhận thuế nhập tay",
      path: ["taxAmount"],
    },
  );

export type RecordDividendInput = z.infer<typeof recordDividendSchema>;
