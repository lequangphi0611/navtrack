import Decimal from "decimal.js";

// Bàn phím số `inputMode="decimal"` ở locale VN gõ ra dấu PHẨY làm phân cách
// thập phân ("9,8"), nhưng decimal.js/Number() chỉ hiểu dấu CHẤM. Đặt tên hằng
// số thay vì rải chuỗi "," / "." trực tiếp trong từng `.replace(...)` — không
// phải để "cho đẹp", mà vì đây từng là nguồn bug thật: 6 nơi tự viết lại đúng
// một phép chuẩn hoá này (decimalString() ở schemas.ts, parseDecimalOrNull ở
// đây, toAmount ở TransactionForm/NewHoldingForm, bond-terms-preview.ts,
// maturity-settlement.ts) — 2/6 bản ĐẦU quên gọi, gây lỗi "Dữ liệu không hợp
// lệ" dù preview hiện đúng số (phát hiện 2026-07-30). Gộp cả HẰNG SỐ lẫn HÀM
// chuẩn hoá về một chỗ duy nhất để "quên chuẩn hoá ở một nơi mới" không còn
// xảy ra được nữa — mọi nơi cần parse input tiền/số lượng gõ tay đều gọi
// `normalizeDecimalInput()` hoặc `parseDecimalOrNull()` ở file này, không tự
// viết `.replace(...)` riêng.
const LOCALE_DECIMAL_SEPARATOR = ",";
const CANONICAL_DECIMAL_SEPARATOR = ".";

// Chuẩn hoá MỘT input thô (có thể đang gõ dở dang) về dạng decimal.js/Number()
// parse được. Chỉ thay dấu phân cách ĐẦU TIÊN gặp — input có ≥ 2 dấu phẩy/chấm
// (gõ nhầm dùng phẩy làm phân cách nghìn, vd "1,234,56") vẫn ra chuỗi không
// hợp lệ sau chuẩn hoá và bị `parseDecimalOrNull`/`Number()` từ chối đúng như
// mong đợi — không cần xử lý riêng ca đó.
export function normalizeDecimalInput(value: string): string {
  return value.replace(LOCALE_DECIMAL_SEPARATOR, CANONICAL_DECIMAL_SEPARATOR);
}

// Parse lenient cho preview client-side — input tiền/số lượng gõ tay có thể
// rỗng/dở dang ("", "-", "1.") trong lúc user đang gõ; `new Decimal()` throw
// trên chuỗi không hợp lệ (khác `Number()` trả NaN êm), nên phải try/catch
// thay vì để lỗi văng ra ngoài React render.
export function parseDecimalOrNull(value: string): Decimal | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    const decimal = new Decimal(normalizeDecimalInput(trimmed));
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}
