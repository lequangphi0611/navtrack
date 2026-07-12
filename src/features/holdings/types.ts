import type { z } from "zod";

import type { XirrResult } from "@/lib/xirr";

import type {
  addTransactionSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  updateTransactionSchema,
} from "./schemas";

export type NewHoldingInput = z.infer<typeof newHoldingSchema>;
export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;
export type NavOverrideInput = z.infer<typeof navOverrideSchema>;

// Nguồn sự thật cho state của NavOverrideForm (@/features/holdings/components/NavOverrideForm) —
// component chỉ import + re-export lại, không tự định nghĩa.
export type NavOverrideFormState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

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

// Danh sách vị thế gom nhóm theo loại tài sản (mockup 2d cập nhật: card theo AssetType).
export type HoldingsGroup = {
  type: HoldingSummary["type"];
  holdings: HoldingSummary[];
  // Tổng totalCostBasis của các holding trong nhóm.
  totalCostBasis: string;
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
  // Giữ nguyên shape business (ok/reason/Decimal) — CHƯA phải biên client
  // cuối, adapter sang shape UI (status/percentPerYear/number) thuộc task kế
  // tiếp "Dashboard hiển thị song song XIRR + lãi/lỗ tuyệt đối".
  xirr: XirrResult;
};
