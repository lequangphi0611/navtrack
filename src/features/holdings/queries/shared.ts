// Helper thuần dùng chung giữa holdings-valuation.ts (getOpenHoldingsWithValuation)
// và closed-holdings.ts (getClosedHoldingsDetail) — gom mảng row batch-fetch
// theo holdingId để ghép dữ liệu O(n), không N+1 theo từng vị thế.
export function groupByHoldingId<T extends { holdingId: string }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.holdingId);
    if (list) list.push(row);
    else map.set(row.holdingId, [row]);
  }
  return map;
}
