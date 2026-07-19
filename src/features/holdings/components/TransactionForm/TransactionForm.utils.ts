import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import {
  parseSettingValue,
  pickEffectiveSetting,
  type SettingRow,
} from "@/lib/settings-resolution";

import type { CashflowRow, TransactionSettingRow } from "../../types";

// Tách khỏi TransactionForm.tsx (cùng lý do settings-resolution.ts tách khỏi
// settings.ts) — TransactionForm.tsx import `../../actions` (Server Actions,
// kéo theo next-auth/db), nên không thể import thẳng nó trong unit test chạy
// bằng vitest (môi trường Node thuần, không phải Next.js runtime). File này
// CHỈ chứa logic thuần, không import bất kỳ thứ gì phụ thuộc Server Action/DB,
// để test được độc lập (TransactionForm.test.ts) và vẫn dùng lại được trong
// component "use client".

export type AutoFieldPreview = {
  amount: Decimal;
  ratePercent: Decimal;
  effectiveFrom: Date;
};

export function toSettingRows(rows: TransactionSettingRow[]): SettingRow[] {
  return rows.map((row) => ({
    value: row.value,
    valueType: row.valueType,
    effectiveFrom: new Date(row.effectiveFrom),
  }));
}

// Chọn dòng Setting hiệu lực tại `atDate` (pickEffectiveSetting, thuần — an
// toàn client, xem @/lib/settings-resolution) rồi nhân với baseAmount. null
// khi chưa có dòng nào hiệu lực (vd ngày trước BASELINE_DATE lúc seed).
export function computeAutoFieldPreview(
  rows: TransactionSettingRow[],
  atDate: Date,
  baseAmount: Decimal,
): AutoFieldPreview | null {
  const effective = pickEffectiveSetting(toSettingRows(rows), atDate);
  if (!effective) return null;
  const rate = parseSettingValue(effective.value, effective.valueType);
  if (!(rate instanceof Decimal)) return null;
  return {
    amount: baseAmount.mul(rate).div(100),
    ratePercent: rate,
    effectiveFrom: effective.effectiveFrom,
  };
}

// Nhãn Setting key THUẦN cosmetic (hiển thị trong dòng công thức) — KHÔNG
// import saleTaxKey/transactionFeeKey từ @/lib/settings: file đó `import { db }`
// ở đầu, kéo cả PrismaClient vào bundle client nếu import trực tiếp vào
// component "use client" (xem @/lib/settings-resolution, phase-5-plan-DRAFT.md
// mục A2). Trùng convention đặt tên key thật (SETTING_KEYS, lib/settings.ts) —
// chỉ để hiển thị, không phải nguồn sự thật resolve giá trị.
export function saleTaxKeyLabel(assetType: AssetType): string {
  return `SALE_TAX_${assetType}`;
}

export function feeKeyLabel(
  direction: "BUY" | "SELL",
  assetType: AssetType,
): string {
  return `TRANSACTION_FEE_${direction}_${assetType}`;
}

export function formatFormulaLabel(
  grossValue: Decimal,
  preview: AutoFieldPreview,
  keyLabel: string,
): string {
  return `${formatMoney(grossValue.toString())} × ${formatPercent(preview.ratePercent.toNumber())} — ${keyLabel} @ ${formatDate(preview.effectiveFrom)}`;
}

// Ở chế độ edit, khi quantity/pricePerUnit/date/cashflowType CHƯA đổi so với
// cashflow gốc, card hiện GIÁ TRỊ ĐÃ LƯU (không phải formula tính lại) — tránh
// bug im lặng: nếu chỉ vì rời khỏi việc sửa field khác (vd "Ghi chú") mà
// AutoFilledAmountCard đổi số hiển thị sang giá trị recompute (có thể lệch
// giá trị đã lưu, vd do user từng sửa tay lúc tạo giao dịch), user bấm "Cập
// nhật giao dịch" sẽ vô tình ghi đè taxAmount/feeAmount dù không có ý định sửa
// trường đó. Một khi user chủ động đổi 1 trong 4 field trên, chuyển hẳn sang
// chế độ "tính lại theo công thức" (đúng tinh thần "Recompute lại mỗi khi
// quantity/pricePerUnit/date/cashflowType đổi" — process/phase-5-plan-DRAFT.md
// mục B2, đã xoá sau khi Phase 5 verify đạt).
export function resolveComputedAmount(
  editCashflow: CashflowRow | null,
  editUnchanged: boolean,
  storedField: "taxAmount" | "feeAmount",
  preview: AutoFieldPreview | null,
): string {
  if (editCashflow && editUnchanged) return editCashflow[storedField];
  return preview ? preview.amount.toString() : "0";
}

// missingInputHint hiện khi user CHƯA nhập đủ số lượng/giá (grossValue null).
// missingConfigHint hiện khi số liệu đã đủ nhưng KHÔNG tìm được dòng Setting
// hiệu lực tại ngày giao dịch (vd ngày trước BASELINE_DATE lúc seed) — 2 tình
// huống khác hẳn nhau, không được gộp chung một câu "nhập đủ..." (sẽ đổ lỗi
// sai cho user trong khi vấn đề thật là thiếu cấu hình, xem docs/domain/09-settings.md
// "Thiếu cấu hình → lỗi tường minh, tuyệt đối không âm thầm dùng 0").
export function resolveFormulaLabel(
  editUnchanged: boolean,
  grossValue: Decimal | null,
  preview: AutoFieldPreview | null,
  keyLabel: string,
  missingInputHint: string,
  missingConfigHint: string,
): string {
  if (editUnchanged) {
    return "Giá trị đã lưu cho giao dịch này — sửa tay nếu cần khớp lại.";
  }
  if (!grossValue) return missingInputHint;
  return preview
    ? formatFormulaLabel(grossValue, preview, keyLabel)
    : missingConfigHint;
}
