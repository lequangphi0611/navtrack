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

// Các loại Dividend SINH TIỀN MẶT thực nhận (`netAmount`) -> phải có mặt trong
// chuỗi dòng tiền XIRR và trong tổng "đã nhận" của một Holding. STOCK không
// nằm ở đây (cổ tức cổ phiếu chỉ tăng số lượng, không phát sinh tiền —
// docs/domain/03-dividends.md).
//
// MỘT nguồn sự thật cho mọi nơi lọc "cổ tức tiền mặt": trước Phase 7 mỗi nơi
// tự viết `type: "CASH"` (3 truy vấn + 1 hằng số ở queries.ts), nên thêm
// BOND_COUPON mà quên một chỗ sẽ làm trái tức BIẾN MẤT khỏi XIRR mà không test
// nào fail (process/phase-7.md mục 3 nêu đích danh rủi ro này).
//
// Đếm cho đủ: lần rà đầu của #58 chỉ thấy 2 hàm trong `features/holdings/
// repository.ts` và bỏ sót `getAllCashDividendsForXirr()` ở
// `lib/portfolio-valuation.ts` (truy vấn `db.dividend` thẳng, ngoài tầng
// repository) — trái tức vào XIRR của TỪNG vị thế nhưng biến mất khỏi XIRR/PnL
// cấp DANH MỤC. Thêm call site mới thì grep CẢ `src/lib/`, không chỉ
// `features/*/repository.ts`.
export const CASH_FLOW_DIVIDEND_TYPES = [
  "CASH",
  "BOND_COUPON",
] as const satisfies readonly DividendType[];

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
