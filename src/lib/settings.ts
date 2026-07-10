import Decimal from "decimal.js";

import type { SettingValueType } from "@prisma/client";
import { db } from "@/lib/db";

// Một nguồn sự thật cho mọi key của bảng Setting — không hardcode string key
// rải rác ở seed/queries/actions (xem docs/rules/schema.md#key-value-config).
export const SETTING_KEYS = {
  MAX_MEMBERS: "MAX_MEMBERS",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type SettingRow = {
  value: string;
  valueType: SettingValueType;
  effectiveFrom: Date;
};

// Given already-fetched rows for one key, pick the row effective at atDate:
// the row with the latest effectiveFrom <= atDate. Pure — no DB access, unit-testable.
export function pickEffectiveSetting(
  rows: SettingRow[],
  atDate: Date,
): SettingRow | null {
  const eligible = rows
    .filter((row) => row.effectiveFrom <= atDate)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return eligible[0] ?? null;
}

export function parseSettingValue(
  value: string,
  valueType: SettingValueType,
): Decimal | number | boolean | Date | string {
  switch (valueType) {
    case "DECIMAL": {
      const decimal = new Decimal(value);
      if (decimal.isNaN()) {
        throw new AppError(
          "INVALID_SETTING_VALUE",
          `Giá trị DECIMAL không hợp lệ: "${value}"`,
        );
      }
      return decimal;
    }
    case "INT": {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        throw new AppError(
          "INVALID_SETTING_VALUE",
          `Giá trị INT không hợp lệ: "${value}"`,
        );
      }
      return parsed;
    }
    case "BOOLEAN":
      return value === "true";
    case "DATE": {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new AppError(
          "INVALID_SETTING_VALUE",
          `Giá trị DATE không hợp lệ: "${value}"`,
        );
      }
      return parsed;
    }
    case "STRING":
      return value;
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
