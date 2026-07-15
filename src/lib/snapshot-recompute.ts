import Decimal from "decimal.js";

// Pure — không đụng DB, để unit test được (tiền lệ lib/manual-snapshot.ts).
// So sánh "nếu dùng giá hôm nay thay vì giá lúc chốt" cho một dòng breakdown
// per-holding của một snapshot tổng danh mục đã đóng băng (mockup 3f).
export type RecomputeHoldingInput = {
  frozenValue: Decimal; // Snapshot{holdingId} đã đóng băng
  historicalPrice: Decimal | null; // giá đã resolve tại snapshot.date
  currentPrice: Decimal | null; // giá đã resolve tại hôm nay
};

// Ngưỡng hiện khối so sánh (3f thay vì 3c) — VND không có đơn vị lẻ dưới
// đồng, |delta| >= 1 VND đủ nhạy để bắt mọi lệch giá thật, tránh 3f giả do
// sai số làm tròn khi suy `quantity = frozenValue / historicalPrice` (Trọng
// tâm quyết định #3, process/DECISION.md issue #46).
export const RECOMPUTE_DELTA_THRESHOLD = new Decimal(1);

// Suy `quantity` ngược từ chính công thức đã dùng lúc chốt (`nav = quantity *
// price`, docs/domain/04-pricing-and-valuation.md "Cách tính") thay vì replay
// lại Cashflow — chỉ so sánh ảnh hưởng của GIÁ ("nếu dùng giá hôm nay"),
// KHÔNG đổi theo thay đổi vị thế (mua/bán thêm) từ lúc chốt tới nay (Trọng
// tâm quyết định #4). Thiếu giá lịch sử/hiện tại, hoặc giá lịch sử = 0 (chia
// 0) -> fallback giữ nguyên frozenValue cho holding đó, không NaN/throw.
export function computeRecomputedComparison(
  holdings: RecomputeHoldingInput[],
  frozenAggregateValue: Decimal,
  todayLabel: string,
): { recomputedValue: string; deltaAmount: string; deltaNote: string } | null {
  const recomputedValue = holdings.reduce((sum, holding) => {
    const canRecompute =
      holding.historicalPrice !== null &&
      !holding.historicalPrice.isZero() &&
      holding.currentPrice !== null;

    if (!canRecompute) return sum.plus(holding.frozenValue);

    // canRecompute đã đảm bảo cả 2 khác null — non-null assertion an toàn.
    const quantity = holding.frozenValue.div(holding.historicalPrice!);
    const recomputedHoldingValue = quantity.mul(holding.currentPrice!);
    return sum.plus(recomputedHoldingValue);
  }, new Decimal(0));

  const delta = recomputedValue.minus(frozenAggregateValue);
  if (delta.abs().lt(RECOMPUTE_DELTA_THRESHOLD)) return null;

  return {
    recomputedValue: recomputedValue.toString(),
    deltaAmount: delta.toString(),
    deltaNote: `nếu dùng giá ${todayLabel}`,
  };
}
