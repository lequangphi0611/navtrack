import Decimal from "decimal.js";

// Tổng quát hoá derivePosition() (lib/cost-basis.ts) để phát lại lịch sử số
// lượng nắm giữ gồm CẢ cổ tức cổ phiếu, không chỉ Cashflow BUY/SELL
// (docs/domain/01-assets-and-holdings.md "Số lượng hiện tại" = Σ BUY − Σ SELL
// + Σ dividend STOCK.stockQuantity). Khác derivePosition: trả về before/after
// TẠI TỪNG event (Map theo id), không chỉ giá trị cuối cùng — cần cho:
// (1) recordDividend: biết SL đang giữ TẠI NGÀY GHI (không phải hôm nay);
// (2) getDividendHistory: suy ngược quantityBefore/After cho từng dòng lịch sử.
export type PositionTrailEvent = {
  id: string;
  date: Date;
  createdAt: Date;
  // BUY: +quantity, SELL: -quantity, Dividend STOCK: +stockQuantity,
  // Dividend CASH: 0 (chỉ giữ chỗ trong dòng thời gian, không đổi SL).
  delta: Decimal;
};

export type PositionTrailEntry = {
  before: Decimal;
  after: Decimal;
};

// Sort theo (date, createdAt, id) — khớp tie-break convention đã dùng ở
// features/holdings/actions.ts/queries.ts (orderBy [date asc, createdAt asc, id asc])
// khi trùng ngày, để before/after nhất quán với cách Holding.quantity cache được
// materialize.
export function buildQuantityTimeline(
  events: PositionTrailEvent[],
): Map<string, PositionTrailEntry> {
  const sorted = [...events].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const result = new Map<string, PositionTrailEntry>();
  let quantity = new Decimal(0);
  for (const event of sorted) {
    const before = quantity;
    const after = quantity.plus(event.delta);
    result.set(event.id, { before, after });
    quantity = after;
  }
  return result;
}
