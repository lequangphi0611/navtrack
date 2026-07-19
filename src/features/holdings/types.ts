import type { z } from "zod";

import type { SettingValueType } from "@prisma/client";
import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import type { XirrResult as XirrResultUi } from "@/components/ReturnMetrics";
import type { PriceSource } from "@/lib/valuation";

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

// Khối NAV + XIRR/PnL + timeline dòng tiền cho /holdings/[id] (mockup 2c) —
// khai ĐỘC LẬP (không import) khỏi `HoldingValuation` của
// HoldingDetailScreen.tsx, dù cấu trúc giống hệt: cùng lý do `PortfolioValuation`
// ở lib/portfolio-valuation.ts khai độc lập khỏi DashboardScreenProps (xem
// process/DECISION.md 2026-07-12 "getPortfolioValuation() chuyển từ...") —
// feature (business-implementer) không phụ thuộc ngược vào component
// Presentational (design-implementer). TypeScript structural typing đảm bảo
// khớp Props khi truyền ở page.tsx.
export type HoldingDetailValuation = {
  navValue: string;
  priceSource: PriceSource;
  // "Tự động · vnstock" / "Nhập tay".
  priceSourceLabel: string;
  // "Giá EOD 10/07: 178.900 · vốn TB 163.100".
  priceNote: string;
  xirr: XirrResultUi;
  absolutePnl: string;
  // Gồm cả dòng "NAV tại mốc chốt" giả định (kind: "CUTOFF_NAV") khi vị thế
  // còn mở và định giá được — xem buildXirrCashflows (lib/xirr-cashflow.ts).
  timeline: CashflowTimelineRow[];
  timelineFootnote?: string;
};

// Một dòng Setting hiệu lực đã serialize cho client (process/phase-5-plan-DRAFT.md
// mục A3) — `effectiveFrom` là ISO string (không phải Date) qua ranh giới
// Server -> Client Component; TransactionForm tự `new Date(...)` lại khi cần
// gọi pickEffectiveSetting() (@/lib/settings-resolution, thuần, an toàn client).
export type TransactionSettingRow = {
  value: string;
  valueType: SettingValueType;
  effectiveFrom: string;
};

// Nhóm 3 key Setting cần cho form ghi giao dịch (thuế bán + phí mua/bán) của
// một AssetType — xem getTransactionSettingRows() (queries.ts).
export type TransactionSettingRows = {
  saleTaxRows: TransactionSettingRow[];
  feeBuyRows: TransactionSettingRow[];
  feeSellRows: TransactionSettingRow[];
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
  // undefined khi NAV không xác định được (MISSING_PRICE) — HoldingDetailScreen
  // tự rơi về hiển thị Phase 1 (chỉ vốn đã bỏ vào) khi vắng mặt.
  valuation: HoldingDetailValuation | undefined;
};
