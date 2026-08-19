import type { CashflowType } from "@prisma/client";
import Decimal from "decimal.js";
import { z } from "zod";

import type { AssetType } from "@/components/AssetTypeBadge";
import { CASHFLOW_TYPES } from "@/lib/enums";
import { normalizeDecimalInput } from "@/lib/parse-decimal";

export const assetTypeEnum = z.enum(["STOCK", "FUND", "BOND", "GOLD"]);
export const cashflowTypeEnum = z.enum(CASHFLOW_TYPES);

// Type guard cho `AssetType` đọc từ nguồn KHÔNG tin cậy (vd query string
// `/holdings/new?type=BOND` — issue #141) — "không tin client" (CLAUDE.md).
// Tái dùng `assetTypeEnum` đã có thay vì khai lại danh sách literal lần 2.
export function isAssetType(value: string | undefined): value is AssetType {
  return assetTypeEnum.safeParse(value).success;
}

// Loại giao dịch TẠO MỚI bằng tay được — cố ý KHÔNG phải `cashflowTypeEnum`.
// Cho tới Phase 6, `CASHFLOW_TYPES` chỉ có BUY/SELL nên dùng chung là an toàn;
// Phase 7 (#56) thêm `MATURITY` vào mảng đó và mọi schema dựa trên
// `transactionFields` LẶNG LẼ nhận thêm một loại mà form không bao giờ hiển thị.
//
// `MATURITY` chỉ được sinh ra bởi chính luồng tất toán đáo hạn
// (settleMaturitySchema + settleMaturity), nơi có đủ kiểm tra `holding.type
// === "BOND"` và `BondTerms` tồn tại, và nơi thuế đánh trên PHẦN LỢI TỨC. Cho
// client tạo mới một dòng `MATURITY` qua form giao dịch thường là ghi thẳng
// `Cashflow{MATURITY}` lên một vị thế bất kỳ (kể cả vàng), bỏ qua toàn bộ kiểm
// tra trên — mà nó vẫn được `cashflowEventRank()` xếp cuối ngày và
// `computeRealizedGainForHolding()` tính như SELL (docs/domain/07-tax.md "Bán
// trước hạn vs đáo hạn"). `TransactionForm` đã khoá ở UI, nhưng
// `<input type="hidden">` sửa được — "không tin client" (CLAUDE.md), cùng lý do
// `buyHasNoTax` bên dưới.
//
// SỬA thì khác: `updateTransactionSchema` vẫn phải nhận `MATURITY` (form gửi
// nguyên loại của dòng đang sửa lên), nên việc chặn ĐỔI loại nằm ở
// `updateTransaction` — chỉ ở đó mới đọc được loại đang lưu trong DB.
const manualCashflowTypeEnum = z.enum(["BUY", "SELL"]);

function decimalString(message: string) {
  return (
    z
      // `error: message` (không chỉ `z.string()` trơn) — field THIẾU hẳn (key
      // vắng mặt trong FormData, vd required field bị bỏ trống) trước đây rơi
      // vào message mặc định của zod ("Invalid input: expected string,
      // received undefined", tiếng Anh) thay vì message tiếng Việt đã truyền
      // vào, vì `.refine()` bên dưới chỉ chạy SAU khi z.string() qua được —
      // undefined bị chặn ngay ở bước type check, không tới refine. Dùng
      // chung 1 message cho cả "thiếu" lẫn "sai định dạng/không hợp lệ" —
      // phát hiện khi đổi recordDividendSchema sang discriminatedUnion (field
      // bắt buộc thật sự, không còn .optional() + refine ở object cha nữa).
      .string({ error: message })
      .trim()
      // decimal.js chỉ chấp nhận dấu chấm làm phân cách thập phân — bàn phím số
      // "inputMode=decimal" trên nhiều máy (locale VN) gõ ra dấu phẩy.
      // `normalizeDecimalInput()` (lib/parse-decimal.ts) là chỗ DUY NHẤT định
      // nghĩa phép chuẩn hoá này — dùng chung với preview client-side (đã từng
      // lệch nhau: preview tự chuẩn hoá riêng, schema thì không, khiến "9,8"
      // hiện đúng số ở preview nhưng bị validate từ chối lúc lưu thật, phát
      // hiện khi debug BondTermsForm).
      .transform((value) => normalizeDecimalInput(value))
      .refine((value) => {
        try {
          return new Decimal(value).isFinite();
        } catch {
          return false;
        }
      }, message)
  );
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
  cashflowType: manualCashflowTypeEnum,
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
  cashflowType: CashflowType;
  taxAmount: string;
}): boolean {
  return data.cashflowType !== "BUY" || new Decimal(data.taxAmount).isZero();
}

const BUY_HAS_NO_TAX_ISSUE = {
  message: "Giao dịch mua không có thuế",
  path: ["taxAmount"],
};

// "Vừa mua hôm nay" ("NEW_PURCHASE") vs "Đã có từ trước" ("HISTORICAL") — issue
// #140 dựng 2 nhánh UI, issue #142 nối dây business. BẮT BUỘC (không
// `.optional()`/`.default()`): thiếu intent phải là lỗi tường minh thay vì âm
// thầm coi là một trong hai nhánh — hai nhánh có hành vi gộp-trùng-mã KHÁC
// NHAU hẳn ở createHolding() (actions.ts), lặng lẽ default sai nhánh sẽ hoặc
// gộp nhầm một giao dịch "vừa mua" vào vị thế cũ, hoặc chặn nhầm một khai báo
// lịch sử hợp lệ.
export const newHoldingIntentEnum = z.enum(["HISTORICAL", "NEW_PURCHASE"]);

export const newHoldingSchema = z
  .object({
    symbol: z.string().trim().min(1, "Nhập mã"),
    type: assetTypeEnum,
    unit: z.string().trim().min(1, "Nhập đơn vị"),
    name: z.string().trim().optional(),
    intent: newHoldingIntentEnum,
    ...transactionFields,
  })
  .refine(buyHasNoTax, BUY_HAS_NO_TAX_ISSUE)
  // Chặn ngày tương lai CHỈ cho nhánh "Vừa mua hôm nay" — một giao dịch mua đã
  // khớp lệnh không thể có ngày sau hôm nay. CỐ Ý khác `addTransactionSchema`/
  // `TransactionForm` (không chặn): nhánh "Đã có từ trước" và mọi giao dịch ghi
  // qua form thường là KHAI BÁO tự do (kể cả tất toán tương lai dự kiến), không
  // áp ràng buộc này — đừng sửa cho "nhất quán" (process/phase-x cho issue
  // #142). Chấp nhận khung lệch hẹp UTC vs giờ VN (so sánh thẳng `Date`, không
  // viết helper timezone riêng).
  .refine((data) => data.intent !== "NEW_PURCHASE" || data.date <= new Date(), {
    message: "Ngày mua không thể ở tương lai",
    path: ["date"],
  });

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
    // Ghi đè `manualCashflowTypeEnum` của `transactionFields`: form sửa giao
    // dịch gửi lên nguyên loại của dòng đang sửa, nên một dòng `MATURITY` hợp
    // lệ phải qua được validate thì mới sửa được ngày/số lượng/giá của nó.
    // Chặn ĐỔI loại là việc của `updateTransaction` (xem comment ở đó).
    cashflowType: cashflowTypeEnum,
  })
  .refine(buyHasNoTax, BUY_HAS_NO_TAX_ISSUE);

export const deleteTransactionSchema = z.object({
  cashflowId: z.string().min(1, "Thiếu giao dịch"),
});

// Điều khoản trái phiếu (Phase 7, mockup 7a) — nhập MỘT LẦN trên vị thế, mọi
// lần ghi trái tức về sau đọc lại từ đây thay vì hỏi lại user
// (docs/domain/10-cashflow-calendar.md).
//
// Chỉ `issuerType` + `parValue` BẮT BUỘC: thiếu chúng thì không tính được tiền
// lẫn thuế. Cụm coupon (lãi suất/kỳ/ngày kỳ đầu/đáo hạn) đều optional vì trái
// phiếu chiết khấu (zero-coupon) hợp lệ mà không có kỳ trả lãi nào — "thiếu
// field optional là bình thường, không phải lỗi".
//
// Chuỗi rỗng từ form = "bỏ trống" (-> null), không phải lỗi định dạng: `<input>`
// không gửi undefined, luôn gửi "". Nhánh `z.literal("")` đứng TRƯỚC trong union
// là cố ý — `z.coerce.date("")`/`z.coerce.number("")` không từ chối "" một cách
// sạch sẽ (ra Invalid Date / số 0), nên để coerce chạm vào "" là mở đường cho
// một giá trị rác lọt qua thành "kỳ trả lãi 0 tháng".
const optionalDate = z
  .union([z.literal(""), z.coerce.date({ error: "Ngày không hợp lệ" })])
  .transform((value) => (value === "" ? null : value));

const optionalCouponRate = z
  .union([z.literal(""), positiveDecimal("Lãi suất phải lớn hơn 0")])
  .transform((value) => (value === "" ? null : value));

const optionalCouponFrequency = z
  .union([
    z.literal(""),
    z.coerce
      .number()
      .int("Kỳ trả lãi phải là số tháng nguyên")
      .positive("Kỳ trả lãi phải lớn hơn 0"),
  ])
  .transform((value) => (value === "" ? null : value));

export const bondTermsSchema = z
  .object({
    holdingId: z.string().min(1, "Thiếu vị thế"),
    issuerType: z.enum(["CORPORATE", "GOVERNMENT"]),
    parValue: positiveDecimal("Mệnh giá phải lớn hơn 0"),
    couponRatePercent: optionalCouponRate,
    couponFrequencyMonths: optionalCouponFrequency,
    firstCouponDate: optionalDate,
    maturityDate: optionalDate,
  })
  // Ngày đáo hạn trước ngày trả lãi kỳ đầu là dữ liệu không thể có thật — mọi
  // mốc coupon đều bị cắt trước khi sinh, lịch trả lãi ra rỗng một cách khó
  // hiểu thay vì báo lỗi ngay lúc nhập (lib/bond-schedule.ts::buildCouponSchedule).
  .refine(
    (data) =>
      !data.firstCouponDate ||
      !data.maturityDate ||
      data.maturityDate >= data.firstCouponDate,
    {
      message: "Ngày đáo hạn không thể trước ngày trả lãi kỳ đầu",
      path: ["maturityDate"],
    },
  );

// Tất toán đáo hạn trái phiếu (Phase 7, issue #101). KHÔNG tái dùng
// addTransactionSchema: ở đó `cashflowType` do client chọn, còn ở đây loại giao
// dịch là HẰNG SỐ do chính luồng nghiệp vụ quyết định (`MATURITY`) — cho client
// gửi lên sẽ mở đường ghi nhầm một lệnh SELL vào màn đáo hạn, đúng thứ tách
// enum này ra để tránh (docs/domain/07-tax.md "Bán trước hạn vs đáo hạn").
//
// `taxAmount` VẪN nhận từ client (khác thuế của SELL, cũng nhận): giá trị app
// tính chỉ là PREFILL, user sửa lại theo sao kê được — nguyên tắc "form chỉ
// prefill, KHÔNG khoá field" (docs/domain/07-tax.md). Server tự tính lại giá
// trị gợi ý và KHÔNG tin số client gửi cho bất kỳ mục đích nào khác ngoài chính
// cột `taxAmount`.
export const settleMaturitySchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
  quantity: positiveDecimal("Số lượng phải lớn hơn 0"),
  pricePerUnit: positiveDecimal("Giá phải lớn hơn 0"),
  taxAmount: nonNegativeDecimal("Thuế không hợp lệ").optional(),
  feeAmount: nonNegativeDecimal("Phí không hợp lệ").optional(),
  note: z.string().trim().optional(),
});

export const navOverrideSchema = z.object({
  holdingId: z.string().min(1, "Thiếu vị thế"),
  price: positiveDecimal("Giá phải lớn hơn 0"),
  date: z.coerce.date({ error: "Ngày không hợp lệ" }),
});
