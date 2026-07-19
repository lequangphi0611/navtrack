import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";

// Tách thuần khỏi portfolio-valuation.ts (không đụng DB) — cùng tinh thần các
// hàm thuần khác trong codebase (dividend-math.ts, snapshot-recompute.ts):
// dễ unit test ca biên (grossInvested = 0) mà không cần mock Prisma.
// docs/domain/07-tax.md mục "Chi phí ăn mòn".
export type CostDragCashflowInput = {
  type: CashflowType;
  amount: Decimal;
  taxAmount: Decimal;
  feeAmount: Decimal;
};

export type CostDragDividendInput = {
  // Dividend.taxAmount có thể null (chưa resolve được / cổ tức cổ phiếu không
  // có field này) — coi như 0 khi cộng dồn, KHÔNG loại bỏ dòng đó khỏi tổng.
  taxAmount: Decimal | null;
};

export type CostDragResult = {
  // Σ|BUY.amount| — vốn GỘP đã triển khai, KHÁC vốn ròng (totalInvested ở
  // portfolio-valuation.ts): chỉ đi lên, không co lại khi đã bán nhiều
  // (process/DECISION.md 2026-07-17 (6)).
  grossInvested: Decimal;
  feeTotal: Decimal;
  saleTaxTotal: Decimal;
  dividendTaxTotal: Decimal;
  costDragAmount: Decimal;
  // % trên grossInvested — 0 (không NaN/Infinity) khi grossInvested = 0 (chưa
  // có lệnh mua nào).
  costDragPercent: number;
};

export function computeCostDrag(
  cashflows: CostDragCashflowInput[],
  dividends: CostDragDividendInput[],
): CostDragResult {
  const grossInvested = cashflows
    .filter((cf) => cf.type === "BUY")
    .reduce((sum, cf) => sum.plus(cf.amount.abs()), new Decimal(0));

  const feeTotal = cashflows.reduce(
    (sum, cf) => sum.plus(cf.feeAmount),
    new Decimal(0),
  );
  // taxAmount luôn 0 cho BUY (docs/domain/07-tax.md) — cộng dồn CẢ chuỗi vẫn
  // đúng, không cần filter riêng SELL.
  const saleTaxTotal = cashflows.reduce(
    (sum, cf) => sum.plus(cf.taxAmount),
    new Decimal(0),
  );
  const dividendTaxTotal = dividends.reduce(
    (sum, d) => sum.plus(d.taxAmount ?? new Decimal(0)),
    new Decimal(0),
  );
  const costDragAmount = feeTotal.plus(saleTaxTotal).plus(dividendTaxTotal);
  const costDragPercent = grossInvested.isZero()
    ? 0
    : costDragAmount.div(grossInvested).mul(100).toNumber();

  return {
    grossInvested,
    feeTotal,
    saleTaxTotal,
    dividendTaxTotal,
    costDragAmount,
    costDragPercent,
  };
}

// % đóng góp của MỘT nguồn (phí/thuế bán/thuế cổ tức) trên costDragAmount —
// KHÁC mẫu số costDragPercent ở trên (vốn tính trên grossInvested). 0 khi
// costDragAmount = 0, tránh chia 0 (docs/domain/07-tax.md — sheet chi tiết,
// mockup 5e). Tách hàm riêng vì dùng lại 3 lần (FEE/SALE_TAX/DIVIDEND_TAX) ở
// caller (getPortfolioValuation()).
export function computeCostDragContributionPercent(
  amount: Decimal,
  costDragAmount: Decimal,
): number {
  return costDragAmount.isZero()
    ? 0
    : amount.div(costDragAmount).mul(100).toNumber();
}
