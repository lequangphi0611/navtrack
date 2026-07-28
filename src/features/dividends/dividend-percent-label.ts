import Decimal from "decimal.js";

import type { SettingValueType } from "@prisma/client";
import {
  AppError,
  assertDecimalSettingValue,
  parseSettingValue,
  pickEffectiveSetting,
} from "@/lib/settings";

// Hàm thuần rút khỏi queries.ts (sub-issue #108) — suy percentLabel cho lịch
// sử cổ tức từ dữ liệu ĐÃ LƯU (Dividend không lưu percent trực tiếp, xem
// docs/domain/03-dividends.md).

// parValueRows đã fetch 1 LẦN cho toàn bộ lịch sử — tránh N+1 khi suy ngược
// percentLabel cho từng dòng CASH (mỗi dòng có thể rơi vào một effective
// window mệnh giá khác nhau nếu Setting đổi theo thời gian).
export function resolveParValueAt(
  rows: { value: string; valueType: SettingValueType; effectiveFrom: Date }[],
  atDate: Date,
): Decimal {
  const row = pickEffectiveSetting(rows, atDate);
  if (!row) {
    throw new AppError(
      "SETTING_NOT_FOUND",
      `Thiếu cấu hình DIVIDEND_PAR_VALUE cho ngày ${atDate.toISOString()}`,
    );
  }
  const parsed = parseSettingValue(row.value, row.valueType);
  assertDecimalSettingValue(parsed, "DIVIDEND_PAR_VALUE");
  return parsed;
}

// percentLabel suy ngược từ dữ liệu đã lưu (Dividend không lưu percent trực
// tiếp — xem docs/domain/03-dividends.md). before=0 (hiếm, dữ liệu bất
// thường) -> "0" thay vì chia cho 0.
export function roundPercentLabel(
  numerator: Decimal,
  denominator: Decimal,
): string {
  if (denominator.isZero()) return "0";
  return numerator
    .div(denominator)
    .mul(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString();
}

// Kỳ trả lãi (số tháng) của MỘT dòng trái tức đã ghi — suy NGƯỢC từ chính dữ
// liệu đã lưu trên dòng đó, KHÔNG đọc `BondTerms.couponFrequencyMonths` hiện
// tại (Phase 7, issue #58).
//
// Vì sao suy ngược thay vì đọc thẳng: schema chỉ đóng băng `parValueApplied` và
// `couponRatePercentApplied` (issue #56), không đóng băng kỳ trả lãi. Nhưng
// tiêu chí phase yêu cầu "sửa BondTerms KHÔNG làm đổi số tiền/NHÃN của các trái
// tức đã ghi trước đó" — mà nhãn gồm cả "kỳ 6 tháng". Đảo ngược công thức
// computeBondCoupon() cho ra kỳ trả lãi ĐÃ DÙNG LÚC GHI mà không cần thêm cột:
//   gross = par × rate/100 × freq/12 × SL   =>   freq = gross × 1200 / (par × rate × SL)
//
// Trả null khi không suy được (SL tại ngày ghi = 0, mệnh giá/lãi suất 0, hoặc
// kết quả không ra số tháng nguyên vì user đã sửa tay số tiền) — caller ẩn phần
// "· kỳ N tháng", vẫn hiển thị phần "%/năm" đã đóng băng.
export function deriveCouponFrequencyMonths(input: {
  grossAmount: Decimal;
  parValueApplied: Decimal;
  couponRatePercentApplied: Decimal;
  quantityAtDate: Decimal;
}): number | null {
  const denominator = input.parValueApplied
    .mul(input.couponRatePercentApplied)
    .mul(input.quantityAtDate);
  if (denominator.isZero()) return null;

  const months = input.grossAmount.mul(1200).div(denominator);
  const rounded = months.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  // Lệch khỏi số nguyên = số tiền đã bị sửa tay khỏi công thức -> không bịa ra
  // một kỳ trả lãi không có thật.
  if (!months.minus(rounded).abs().lt("0.01")) return null;
  if (rounded.lte(0)) return null;
  return rounded.toNumber();
}
