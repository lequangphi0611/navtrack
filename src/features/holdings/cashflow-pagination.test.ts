import { describe, expect, test } from "vitest";

import { paginateRows } from "./cashflow-pagination";

function makeRows(count: number): { id: string }[] {
  return Array.from({ length: count }, (_, i) => ({ id: `row-${i}` }));
}

describe("paginateRows", () => {
  test("nhiều hơn take 1 dòng -> cắt đúng take dòng, nextCursor là id dòng cuối trang", () => {
    const rows = makeRows(21);

    const { page, nextCursor } = paginateRows(rows, 20);

    expect(page).toHaveLength(20);
    expect(page.map((r) => r.id)).toEqual(rows.slice(0, 20).map((r) => r.id));
    expect(nextCursor).toBe("row-19");
  });

  test("ít hơn take + 1 dòng -> trả nguyên, nextCursor null", () => {
    const rows = makeRows(15);

    const { page, nextCursor } = paginateRows(rows, 20);

    expect(page).toHaveLength(15);
    expect(nextCursor).toBeNull();
  });

  test("đúng khít take dòng (không dư) -> nextCursor null, không lầm còn trang sau", () => {
    const rows = makeRows(20);

    const { page, nextCursor } = paginateRows(rows, 20);

    expect(page).toHaveLength(20);
    expect(nextCursor).toBeNull();
  });
});
