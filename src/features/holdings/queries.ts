// Barrel — re-export theo màn hình sử dụng (sub-issue #108). File thật sống ở
// queries/*.ts, tách theo Row -> Domain -> DTO cho từng nhóm màn hình:
// - queries/holdings-overview.ts       — danh sách vị thế Open/Closed (Phase 1)
// - queries/holding-detail.ts          — chi tiết vị thế (/holdings/[id])
// - queries/holding-transaction-form.ts — form giao dịch + banner "vừa ghi nhận"
//   (cùng nhóm màn hình với holding-detail.ts, tách file riêng chỉ để giữ
//   dưới 300 dòng/file)
// - queries/holdings-valuation.ts      — danh sách vị thế mở có định giá
// - queries/closed-holdings.ts         — chi tiết vị thế đã đóng (realized PnL/XIRR)
// - queries/holding-detail-strings.ts  — chuỗi hiển thị thuần rút từ 2 file trên
// - queries/holding-switcher.ts        — danh sách switcher đổi mã (TransactionForm/DividendForm)
// - queries/shared.ts                  — helper thuần dùng chung (groupByHoldingId)
// Code NGOÀI feature holdings đi qua barrel này. Trong nội bộ feature (giữa
// các file con của queries/), import trực tiếp sibling file, không qua đây.
export {
  getClosedHoldings,
  getOpenHoldings,
  hasAnyHolding,
} from "./queries/holdings-overview";

export { getHoldingDetail } from "./queries/holding-detail";

export {
  getHoldingForPricing,
  getJustRecordedBanner,
  getNewPurchaseFeeSettingRows,
  getTransactionSettingRows,
} from "./queries/holding-transaction-form";

export { getOpenHoldingsWithValuation } from "./queries/holdings-valuation";

export { getOpenHoldingsForSwitcher } from "./queries/holding-switcher";

// Phase 7 — điều khoản trái phiếu, ngữ cảnh trái tức, prefill tất toán đáo hạn.
export {
  getBondCouponFormData,
  getBondHoldingActions,
  getBondTermsFormData,
  getMaturitySettlementData,
  type BondCouponFormData,
  type BondHoldingActions,
  type BondTermsFormData,
  type MaturitySettlementData,
} from "./queries/bond-terms";

export {
  getClosedHoldingsDetail,
  type ClosedHoldingRow,
  type ClosedHoldingsDetail,
  type ClosedHoldingsSummary,
} from "./queries/closed-holdings";
