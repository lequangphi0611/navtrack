import { z } from "zod";

// Tái dùng positiveDecimal/nonNegativeDecimal của holdings/schemas.ts (không
// chép lại logic validate Decimal — xem docs/rules/typescript-style.md).
import {
  nonNegativeDecimal,
  positiveDecimal,
} from "@/features/holdings/schemas";
import { DIVIDEND_TYPES } from "@/lib/enums";

export const dividendTypeEnum = z.enum(DIVIDEND_TYPES);

// Field dùng chung cả 3 loại — mỗi variant bên dưới spread lại, KHÔNG kế thừa
// qua .extend() (z.discriminatedUnion cần literal `type` static ở từng thành
// viên, .extend() trên object base không giữ được tính "strict" riêng của
// từng nhánh — xem strictObject bên dưới).
const sharedFields = {
  holdingId: z.string().min(1, "Thiếu vị thế"),
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
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
};

// `type` là discriminator TĨNH của từng variant — percent/taxAmount/grossAmount/
// stockQuantityOverride giờ chỉ tồn tại trên đúng variant cần nó (thay vì một
// field `.optional()` dùng chung + refine ràng buộc theo `type`, cách cũ khiến
// TypeScript suy ra `percent: string | undefined` cho MỌI type, kể cả CASH/
// STOCK vốn luôn bắt buộc — buộc call site (actions.ts) phải non-null assert
// `percent!` vì compiler không biết refine đã chặn undefined,
// process/DECISION.md 2026-07-29 việc còn treo). `strictObject` (không phải
// `object`) để field KHÔNG thuộc variant bị TỪ CHỐI thay vì âm thầm bỏ qua —
// thay thế 2 refine "CASH/STOCK gửi kèm taxAmount/grossAmount -> từ chối" cũ.
const cashDividendSchema = z.strictObject({
  ...sharedFields,
  type: z.literal("CASH"),
  percent: positiveDecimal("Tỷ lệ phải lớn hơn 0"),
});

const stockDividendSchema = z.strictObject({
  ...sharedFields,
  type: z.literal("STOCK"),
  percent: positiveDecimal("Tỷ lệ phải lớn hơn 0"),
  // Chỉ STOCK có field này — cho phép user tự sửa stockQuantity khi hệ thống
  // làm tròn sai lệch với quy ước của công ty phát hành. Validate tolerance
  // (isStockQuantityOverrideValid) diễn ra trong Server Action, không ở schema
  // này vì cần rawStockQuantity tính từ SL-tại-ngày-ghi (đọc DB).
  stockQuantityOverride: nonNegativeDecimal("Số lượng không hợp lệ").optional(),
});

const bondCouponDividendSchema = z.strictObject({
  ...sharedFields,
  type: z.literal("BOND_COUPON"),
  // Không có `percent` — mệnh giá/lãi suất là điều khoản hợp đồng đọc từ
  // BondTerms (docs/domain/03-dividends.md "Cách tính", nhánh BOND_COUPON).
  //
  // Thuế app tự tính là PREFILL, user sửa tay được để khớp số tổ chức phát
  // hành thực khấu trừ (docs/domain/07-tax.md "Form chỉ prefill, KHÔNG khoá
  // field") — CASH tự tính thuế và KHÔNG nhận override (schema CASH ở trên
  // không có field này, strictObject tự từ chối nếu client vẫn gửi lên).
  taxAmount: nonNegativeDecimal("Thuế không hợp lệ").optional(),
  // Số tự tính từ BondTerms cũng chỉ PREFILL, user sửa tay được để khớp số
  // thực nhận trên sao kê phát hành (vd trái phiếu lãi suất thả nổi — model
  // giả định coupon rate cố định, xem docs/domain/03-dividends.md). Cùng cơ
  // chế "vắng mặt = dùng số server tự tính" như taxAmount — .optional(),
  // KHÔNG .default().
  grossAmount: nonNegativeDecimal("Lãi gộp không hợp lệ").optional(),
});

export const recordDividendSchema = z
  .discriminatedUnion("type", [
    cashDividendSchema,
    stockDividendSchema,
    bondCouponDividendSchema,
  ])
  // `paymentDate` là ngày tiền/CP THỰC VỀ — không thể sớm hơn `date` (ngày
  // chia) về mặt nghiệp vụ. Với CASH, paymentDate giờ là mốc dòng tiền XIRR
  // nên validate này còn chặn cả việc lệch chuỗi dòng tiền theo thời gian,
  // không chỉ bắt lỗi gõ nhầm ngày như trước (review PR #62, finding #3).
  .refine((data) => !data.paymentDate || data.paymentDate >= data.date, {
    message: "Ngày thanh toán không thể trước ngày chia",
    path: ["paymentDate"],
  });

export type RecordDividendInput = z.infer<typeof recordDividendSchema>;
