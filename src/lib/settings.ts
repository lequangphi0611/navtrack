import Decimal from "decimal.js";

import type { AssetType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AppError,
  parseSettingValue,
  pickEffectiveSetting,
} from "@/lib/settings-resolution";

// Re-export cho code cũ (docs/rules/typescript-style.md: một nguồn sự thật) —
// pickEffectiveSetting/parseSettingValue/AppError giờ SỐNG ở settings-resolution.ts
// (thuần, không import `db`) để dùng được từ client component (xem
// process/phase-5-plan-DRAFT.md mục A2). File này giữ nguyên chữ ký
// resolveSetting/resolveDecimalSetting cho mọi chỗ gọi hiện có.
export { AppError, parseSettingValue, pickEffectiveSetting };

// Một nguồn sự thật cho mọi key của bảng Setting — không hardcode string key
// rải rác ở seed/queries/actions (xem docs/rules/schema.md#key-value-config).
export const SETTING_KEYS = {
  MAX_MEMBERS: "MAX_MEMBERS",
  // docs/domain/03-dividends.md — thuế TNCN cổ tức tiền mặt (%), effective-dated
  // theo ngày chia cổ tức.
  DIVIDEND_TAX_RATE: "DIVIDEND_TAX_RATE",
  // docs/domain/03-dividends.md — mệnh giá dùng để tính cổ tức tiền mặt theo %
  // (đ/CP), effective-dated theo ngày chia cổ tức.
  DIVIDEND_PAR_VALUE: "DIVIDEND_PAR_VALUE",
  // docs/domain/07-tax.md mục "Quy tắc & bất biến" — thuế TNCN khi BÁN (%),
  // theo AssetType, effective-dated theo ngày giao dịch. Không có key mua —
  // VN không đánh thuế TNCN khi mua chứng khoán/CCQ.
  SALE_TAX_STOCK: "SALE_TAX_STOCK",
  SALE_TAX_FUND: "SALE_TAX_FUND",
  SALE_TAX_BOND: "SALE_TAX_BOND",
  SALE_TAX_GOLD: "SALE_TAX_GOLD",
  // docs/domain/07-tax.md mục "Phí giao dịch (mua & bán)" — phí CTCK theo
  // CHIỀU × AssetType (%), effective-dated theo ngày giao dịch.
  TRANSACTION_FEE_BUY_STOCK: "TRANSACTION_FEE_BUY_STOCK",
  TRANSACTION_FEE_BUY_FUND: "TRANSACTION_FEE_BUY_FUND",
  TRANSACTION_FEE_BUY_BOND: "TRANSACTION_FEE_BUY_BOND",
  TRANSACTION_FEE_BUY_GOLD: "TRANSACTION_FEE_BUY_GOLD",
  TRANSACTION_FEE_SELL_STOCK: "TRANSACTION_FEE_SELL_STOCK",
  TRANSACTION_FEE_SELL_FUND: "TRANSACTION_FEE_SELL_FUND",
  TRANSACTION_FEE_SELL_BOND: "TRANSACTION_FEE_SELL_BOND",
  TRANSACTION_FEE_SELL_GOLD: "TRANSACTION_FEE_SELL_GOLD",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Tra key SALE_TAX_<LOẠI> theo AssetType — tránh rải string ghép
// `SALE_TAX_${type}` khắp queries/actions/form (docs/domain/07-tax.md).
// switch tường minh thay vì template literal: an toàn hơn khi SettingKey là
// union hẹp (không phụ thuộc TS suy luận template literal type từ union).
export function saleTaxKey(assetType: AssetType): SettingKey {
  switch (assetType) {
    case "STOCK":
      return SETTING_KEYS.SALE_TAX_STOCK;
    case "FUND":
      return SETTING_KEYS.SALE_TAX_FUND;
    case "BOND":
      return SETTING_KEYS.SALE_TAX_BOND;
    case "GOLD":
      return SETTING_KEYS.SALE_TAX_GOLD;
  }
}

// Tra key TRANSACTION_FEE_<chiều>_<LOẠI> theo chiều (BUY/SELL) × AssetType —
// cùng lý do với saleTaxKey (docs/domain/07-tax.md mục "Phí giao dịch").
export function transactionFeeKey(
  direction: "BUY" | "SELL",
  assetType: AssetType,
): SettingKey {
  if (direction === "BUY") {
    switch (assetType) {
      case "STOCK":
        return SETTING_KEYS.TRANSACTION_FEE_BUY_STOCK;
      case "FUND":
        return SETTING_KEYS.TRANSACTION_FEE_BUY_FUND;
      case "BOND":
        return SETTING_KEYS.TRANSACTION_FEE_BUY_BOND;
      case "GOLD":
        return SETTING_KEYS.TRANSACTION_FEE_BUY_GOLD;
    }
  }
  switch (assetType) {
    case "STOCK":
      return SETTING_KEYS.TRANSACTION_FEE_SELL_STOCK;
    case "FUND":
      return SETTING_KEYS.TRANSACTION_FEE_SELL_FUND;
    case "BOND":
      return SETTING_KEYS.TRANSACTION_FEE_SELL_BOND;
    case "GOLD":
      return SETTING_KEYS.TRANSACTION_FEE_SELL_GOLD;
  }
}

// Resolves the effective value of a Setting key at a given date. Throws AppError
// if no row is eligible — never silently defaults (a missing config is a bug, not a zero).
export async function resolveSetting(key: SettingKey, atDate: Date) {
  const rows = await db.setting.findMany({ where: { key } });
  const row = pickEffectiveSetting(rows, atDate);
  if (!row) {
    throw new AppError("SETTING_NOT_FOUND", `Thiếu cấu hình cho key "${key}"`);
  }
  return parseSettingValue(row.value, row.valueType);
}

// Thu hẹp kiểu trả về union của resolveSetting() về Decimal cho các key luôn
// seed DECIMAL (thuế/mệnh giá...) — parseSettingValue() đảm bảo DECIMAL luôn
// parse ra instance Decimal, nhưng chữ ký resolveSetting() là union nên caller
// cần thu hẹp tường minh thay vì `as Decimal`. Sai valueType ở DB (dữ liệu
// hỏng, không phải input người dùng) -> AppError, để throw ra ngoài (lỗi bất
// ngờ, xem docs/rules/error-handling.md), không nuốt/mặc định.
export async function resolveDecimalSetting(
  key: SettingKey,
  atDate: Date,
): Promise<Decimal> {
  const value = await resolveSetting(key, atDate);
  if (!(value instanceof Decimal)) {
    throw new AppError(
      "INVALID_SETTING_VALUE",
      `Setting "${key}" không phải kiểu DECIMAL`,
    );
  }
  return value;
}

// Gộp N key cùng atDate vào MỘT query duy nhất (tránh N+1 khi resolve nhiều
// key cùng lúc trong 1 thao tác, vd DIVIDEND_PAR_VALUE + DIVIDEND_TAX_RATE
// — xem docs/domain/09-settings.md mục "Resolution"). Cùng bất biến với
// resolveSetting(): thiếu bất kỳ key nào trong `keys` -> throw AppError ngay,
// không trả partial map (thiếu cấu hình là lỗi, không phải giá trị mặc định).
export async function resolveSettings(
  keys: SettingKey[],
  atDate: Date,
): Promise<Map<SettingKey, ReturnType<typeof parseSettingValue>>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const result = new Map<SettingKey, ReturnType<typeof parseSettingValue>>();
  for (const key of keys) {
    const rowsForKey = rows.filter((r) => r.key === key);
    const row = pickEffectiveSetting(rowsForKey, atDate);
    if (!row) {
      throw new AppError(
        "SETTING_NOT_FOUND",
        `Thiếu cấu hình cho key "${key}"`,
      );
    }
    result.set(key, parseSettingValue(row.value, row.valueType));
  }
  return result;
}

// Thu hẹp một giá trị lấy từ Map trả về của resolveSettings() về Decimal cho
// MỘT key — cùng guard với resolveDecimalSetting (parseSettingValue đảm bảo
// DECIMAL luôn parse ra instance Decimal, nhưng type trả về của
// resolveSettings() là union nên caller cần thu hẹp tường minh thay vì ép
// kiểu `as Decimal` ẩu). Dùng sau khi gọi resolveSettings() với nhiều key
// DECIMAL cùng lúc (docs/domain/09-settings.md mục "Resolution").
export function requireDecimalSetting(
  settings: Map<SettingKey, ReturnType<typeof parseSettingValue>>,
  key: SettingKey,
): Decimal {
  const value = settings.get(key);
  if (!(value instanceof Decimal)) {
    throw new AppError(
      "INVALID_SETTING_VALUE",
      `Setting "${key}" không phải kiểu DECIMAL`,
    );
  }
  return value;
}
