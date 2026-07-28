import type Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";
import { cashflowActionLabel } from "@/lib/cashflow-label";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatQuantity,
} from "@/lib/format";

// Chuỗi hiển thị THUẦN (không async, không gọi DB) rút khỏi holding-detail.ts
// (sub-issue #108) — tách riêng để unit test độc lập với DB/session.

// "Giá EOD 10/07: 178.900 · vốn TB 163.100" — priceNote của khối định giá chi
// tiết vị thế (mockup 2c, HoldingDetailValuation.priceNote).
export function buildPriceNote(
  priceDate: Date,
  price: Decimal,
  avgCost: Decimal,
): string {
  return `Giá EOD ${formatDayMonth(priceDate)}: ${formatMoney(price.toString())} · vốn TB ${formatMoney(avgCost.toString())}`;
}

// dateNote cho dòng "NAV tại mốc chốt" giả định trong timeline dòng tiền —
// buildXirrCashflows (lib/xirr-cashflow.ts) chỉ ghép dòng CUTOFF_NAV khi vị
// thế còn mở và định giá được (xem getHoldingDetail).
export function buildCutoffNavDateNote(cutoffDate: Date): string {
  return `${formatDate(cutoffDate)} · dòng tiền giả định`;
}

// "Mua 5.000 cổ phần" — nhãn giao dịch cho banner "vừa ghi nhận"
// (TransactionSnapshotBannerProps.transactionLabel).
export function buildTransactionLabel(
  type: CashflowType,
  quantity: string,
  unit: string,
): string {
  return `${cashflowActionLabel(type)} ${formatQuantity(quantity, unit)}`;
}

// "11/07/2026 · giá 27.300" — dateNote cho cùng banner trên
// (TransactionSnapshotBannerProps.transactionDateNote). `date` là ISO string
// (CashflowRow.date đã serialize ở biên server), không phải Date thô —
// formatDate() nhận cả hai.
export function buildTransactionDateNote(
  date: string,
  pricePerUnit: string,
): string {
  return `${formatDate(date)} · giá ${formatMoney(pricePerUnit)}`;
}
