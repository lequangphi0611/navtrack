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
