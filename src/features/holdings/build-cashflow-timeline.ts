import type Decimal from "decimal.js";

import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";

export type TimelineCashflowInput = {
  id: string;
  type: "BUY" | "SELL";
  date: Date;
  quantity: Decimal;
  pricePerUnit: Decimal;
  amount: Decimal;
};

export type TimelineDividendInput = {
  id: string;
  date: Date;
  paymentDate: Date | null;
  netAmount: Decimal;
};

// Ghép dòng BUY/SELL (Cashflow) + dòng cổ tức tiền mặt (Dividend type CASH)
// thành 1 timeline duy nhất cho /holdings/[id] (issue #84). Mốc ngày dùng để
// sort/hiển thị của dòng DIVIDEND là paymentDate ?? date — khớp đúng mốc đã
// dùng cho dòng tiền XIRR của cổ tức CASH (docs/domain/03-dividends.md,
// lib/xirr-cashflow.ts, issue #65) để timeline nhất quán với XIRR.
export function buildCashflowTimeline(
  cashflows: TimelineCashflowInput[],
  dividends: TimelineDividendInput[],
  unit: string,
): CashflowTimelineRow[] {
  const cashflowEntries: { row: CashflowTimelineRow; sortDate: number }[] =
    cashflows.map((cf) => ({
      row: {
        id: cf.id,
        kind: cf.type,
        label: `${cf.type === "BUY" ? "Mua" : "Bán"} ${formatQuantity(cf.quantity.toString(), unit)}`,
        dateNote: `${formatDate(cf.date)} · giá ${formatMoney(cf.pricePerUnit.toString())}`,
        amount: cf.amount.toString(),
      },
      sortDate: cf.date.getTime(),
    }));

  const dividendEntries: { row: CashflowTimelineRow; sortDate: number }[] =
    dividends.map((dividend) => {
      const displayDate = dividend.paymentDate ?? dividend.date;
      return {
        row: {
          id: dividend.id,
          kind: "DIVIDEND",
          label: "Cổ tức tiền mặt",
          dateNote: `${formatDate(displayDate)} · cổ tức tiền mặt`,
          amount: dividend.netAmount.toString(),
        },
        sortDate: displayDate.getTime(),
      };
    });

  // Array.prototype.sort ổn định (ES2019+): khi 2 dòng cùng sortDate, thứ tự
  // tương đối lúc concat được giữ nguyên — concat cashflowEntries TRƯỚC
  // dividendEntries để đảm bảo dòng cashflow luôn đứng trước dòng dividend cùng
  // ngày trong kết quả.
  return [...cashflowEntries, ...dividendEntries]
    .sort((a, b) => a.sortDate - b.sortDate)
    .map((entry) => entry.row);
}
