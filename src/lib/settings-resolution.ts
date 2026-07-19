import Decimal from "decimal.js";

import type { SettingValueType } from "@prisma/client";

// Tách khỏi settings.ts (docs/rules/component-architecture.md — TransactionForm.tsx,
// "use client", cần logic "chọn dòng Setting hiệu lực tại ngày X" để tính lại preview
// thuế/phí mỗi khi user đổi ngày, xem process/phase-5-plan-DRAFT.md mục A2). Nếu client
// component import từ settings.ts (file đó `import { db } from "@/lib/db"` ở đầu), cả
// PrismaClient sẽ bị kéo vào bundle client và vỡ build — file này KHÔNG được import `db`
// hay bất kỳ thứ gì phụ thuộc Node-only.
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type SettingRow = {
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
