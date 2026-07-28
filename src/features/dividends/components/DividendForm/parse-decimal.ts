import Decimal from "decimal.js";

// Parse lenient — input "percent"/"stockQuantityOverride" gõ tay có thể
// rỗng/dở dang lúc user đang gõ; new Decimal() throw trên chuỗi không hợp lệ
// (khác Number() trả NaN êm), nên phải try/catch thay vì để lỗi văng ra ngoài
// React render (cùng pattern NavOverrideForm.tsx).
export function parseDecimalOrNull(value: string): Decimal | null {
  if (value.trim() === "") return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}
