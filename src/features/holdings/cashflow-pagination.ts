// Pure cursor-pagination helper — no DB/component coupling (same style as
// group-holdings.ts). Caller fetches `take + 1` rows ordered by cursor field
// (id, tie-broken consistently with the rest of the app); this function slices
// off the lookahead row and turns it into `nextCursor`.
export function paginateRows<T extends { id: string }>(
  rows: T[],
  take: number,
): { page: T[]; nextCursor: string | null } {
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  return { page, nextCursor: hasMore && last ? last.id : null };
}
