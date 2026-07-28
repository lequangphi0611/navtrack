// Một nguồn sự thật cho GIÁ TRỊ RUNTIME của enum nghiệp vụ (mảng options cho
// form, z.enum, filter tab...) — dẫn xuất/ràng buộc lại với enum Prisma bằng
// `satisfies` + một check bắt THIẾU giá trị. Xem docs/rules/typescript-style.md
// mục "Enum: một nguồn sự thật + phân nhánh exhaustive".
//
// `import type` (không import runtime từ @prisma/client) — tránh kéo Prisma
// client vào bundle Client Component.
import type { CashflowType, DividendType } from "@prisma/client";

export const DIVIDEND_TYPES = [
  "CASH",
  "STOCK",
  "BOND_COUPON",
] as const satisfies readonly DividendType[]; // bắt tên sai

// Bắt THIẾU giá trị: đỏ ngay khi Prisma thêm một enum value chưa liệt kê ở trên.
type _AllDividendTypesCovered =
  Exclude<DividendType, (typeof DIVIDEND_TYPES)[number]> extends never
    ? true
    : never;

// Consume type check ở trên bằng một giá trị thật — nếu chỉ khai `type` mà
// không gán, tsc KHÔNG bao giờ báo lỗi (type alias không dùng thì không được
// kiểm tra), nên thiếu giá trị sẽ lọt qua âm thầm. Gán `true` cho biến kiểu
// `_AllDividendTypesCovered` thì thiếu giá trị -> kiểu suy ra `never` -> gán
// `true` đỏ ngay ở dòng dưới (compile error thật, không phải cảnh báo lint).
export const dividendTypesCovered: _AllDividendTypesCovered = true;

export const CASHFLOW_TYPES = [
  "BUY",
  "SELL",
  "MATURITY",
] as const satisfies readonly CashflowType[]; // bắt tên sai

type _AllCashflowTypesCovered =
  Exclude<CashflowType, (typeof CASHFLOW_TYPES)[number]> extends never
    ? true
    : never;

export const cashflowTypesCovered: _AllCashflowTypesCovered = true;
