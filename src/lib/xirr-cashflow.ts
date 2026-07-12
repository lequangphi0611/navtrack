import Decimal from "decimal.js";

import type { CashflowPoint } from "./xirr";

// Ghép chuỗi dòng tiền thật (Cashflow + Dividend CASH) với dòng tiền GIẢ ĐỊNH
// = NAV tại mốc chốt (docs/domain/05-returns-xirr-and-pnl.md "Chưa bán vẫn
// tính được") thành CashflowPoint[] sẵn sàng đưa vào computeXirr. Pure —
// không đụng DB; caller (queries.ts) chịu trách nhiệm lọc cashflows/dividends
// theo cutoffDate trước khi truyền vào đây.
export type XirrCashflowInput = {
  cashflows: { date: Date; amount: Decimal }[]; // đã lọc date <= cutoffDate, dấu +/- theo docs/domain/02
  dividends: { date: Date; netAmount: Decimal }[]; // Dividend type=CASH, netAmount khác null, đã lọc date <= cutoffDate
  isOpenPosition: boolean; // vị thế hiện đang mở (quantity hiện tại != 0) hay đã đóng
  cutoffDate: Date;
  currentNav: Decimal | null; // NAV tại cutoffDate từ valuateHolding — null khi MISSING_PRICE hoặc đã đóng
};

export function buildXirrCashflows(input: XirrCashflowInput): CashflowPoint[] {
  const points: CashflowPoint[] = [
    ...input.cashflows.map((cf) => ({ date: cf.date, amount: cf.amount })),
    ...input.dividends.map((d) => ({ date: d.date, amount: d.netAmount })),
  ];

  // Vị thế đã đóng (SL=0): KHÔNG ghép NAV giả định — dòng bán cuối đã là dòng
  // tiền dương thật, đủ cho công thức (docs/domain/05 "Vị thế đã đóng").
  //
  // Vị thế còn mở nhưng currentNav === null (MISSING_PRICE — thiếu cả
  // NavOverride lẫn PriceQuote <= D): CỐ Ý không ghép gì thêm. Chuỗi chỉ còn
  // dòng âm thật -> computeXirr tự trả NO_POSITIVE_FLOW, đúng "Chỉ mới mua,
  // chưa có giá thị trường -> 'Chưa tính được XIRR'" mà không cần rẽ nhánh
  // riêng ở đây.
  if (input.isOpenPosition && input.currentNav !== null) {
    points.push({ date: input.cutoffDate, amount: input.currentNav });
  }

  return points;
}
