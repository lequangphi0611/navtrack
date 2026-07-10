import type { z } from "zod";

import type {
  addTransactionSchema,
  deleteTransactionSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";

export type NewHoldingInput = z.infer<typeof newHoldingSchema>;
export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;

// View models — Decimal đã serialize thành string ở biên server (không truyền Decimal ra client).
export type HoldingSummary = {
  id: string;
  symbol: string;
  name: string | null;
  type: "STOCK" | "FUND" | "BOND" | "GOLD";
  unit: string;
  quantity: string;
  avgCost: string;
  totalCostBasis: string;
};

export type HoldingsOverview = {
  open: HoldingSummary[];
  closed: HoldingSummary[];
  // Tổng vốn đã bỏ vào các vị thế đang mở (chưa có giá thị trường ở Phase 1).
  totalInvested: string;
};

export type CashflowRow = {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: string;
  pricePerUnit: string;
  amount: string;
  feeAmount: string;
  taxAmount: string;
  note: string | null;
};

export type HoldingDetail = {
  id: string;
  symbol: string;
  name: string | null;
  type: "STOCK" | "FUND" | "BOND" | "GOLD";
  unit: string;
  quantity: string;
  avgCost: string;
  totalCostBasis: string;
  cashflows: CashflowRow[];
};
