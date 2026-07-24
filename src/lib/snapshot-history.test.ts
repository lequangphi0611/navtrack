import { describe, expect, test } from "vitest";

import { formatDate } from "./format";
import { ROUTES } from "./routes";
import {
  buildSnapshotHistoryView,
  toFrozenSnapshotListRow,
  type FrozenSnapshotRow,
} from "./snapshot-history";

const NOW = new Date("2026-07-15T10:00:00.000Z");

function frozen(
  id: string,
  date: string,
  value: string,
  period: FrozenSnapshotRow["period"],
): FrozenSnapshotRow {
  return { id, date: new Date(date), value, period };
}

describe("buildSnapshotHistoryView", () => {
  test("dòng đầu luôn kind live, các dòng sau giữ đúng thứ tự desc đã truyền vào", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s3", "2026-06-30T00:00:00.000Z", "3000000", "PERIODIC"),
      frozen("s2", "2026-05-15T00:00:00.000Z", "2900000", "MANUAL"),
      frozen("s1", "2025-12-31T00:00:00.000Z", "2000000", "YEAR_END"),
    ];

    const { rows } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      kind: "live",
      label: "Hôm nay",
      dateNote: `${formatDate(NOW)} · tính động, chưa lưu`,
      value: "3200000",
    });
    expect(rows.slice(1).map((r) => (r as { id: string }).id)).toEqual([
      "s3",
      "s2",
      "s1",
    ]);
  });

  test("badge/label suy đúng theo period: PERIODIC/YEAR_END/MANUAL", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("periodic", "2026-06-30T00:00:00.000Z", "3000000", "PERIODIC"),
      frozen("manual", "2026-05-15T00:00:00.000Z", "2900000", "MANUAL"),
      frozen("year-end", "2025-12-31T00:00:00.000Z", "2000000", "YEAR_END"),
    ];

    const { rows } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);
    const [, periodicRow, manualRow, yearEndRow] = rows as Extract<
      (typeof rows)[number],
      { kind: "frozen" }
    >[];

    expect(periodicRow).toMatchObject({
      id: "periodic",
      label: "Cuối tháng 6",
      badge: { text: "ĐỊNH KỲ", variant: "default" },
      href: ROUTES.snapshotDetail("periodic"),
    });
    expect(manualRow).toMatchObject({
      id: "manual",
      label: "Chốt thủ công",
      badge: { text: "THỦ CÔNG", variant: "warning" },
      href: ROUTES.snapshotDetail("manual"),
    });
    expect(yearEndRow).toMatchObject({
      id: "year-end",
      label: "Cuối năm 2025",
      badge: { text: "CUỐI NĂM", variant: "accent" },
      href: ROUTES.snapshotDetail("year-end"),
    });
  });

  test("heightPercent tính đúng theo max của tập điểm đưa vào chart (kể cả điểm live)", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s3", "2026-06-30T00:00:00.000Z", "3000000", "PERIODIC"),
      frozen("s2", "2026-05-15T00:00:00.000Z", "2900000", "MANUAL"),
      frozen("s1", "2025-12-31T00:00:00.000Z", "2000000", "YEAR_END"),
    ];

    const { chart } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);

    // chartFrozenAsc = đảo ngược slice(0,7) => cũ->mới: s1(T12/25), s2(T5/26), s3(T6/26), rồi live.
    expect(chart.points.map((p) => p.label)).toEqual([
      "T12/25",
      "T5/26",
      "T6/26",
      "nay",
    ]);
    expect(chart.points[0]?.heightPercent).toBeCloseTo(62.5);
    expect(chart.points[1]?.heightPercent).toBeCloseTo(90.625);
    expect(chart.points[2]?.heightPercent).toBeCloseTo(93.75);
    expect(chart.points[3]).toMatchObject({ heightPercent: 100, isLive: true });
  });

  test("chart chỉ lấy tối đa 7 điểm frozen gần nhất dù rows có nhiều hơn", () => {
    const frozenDesc: FrozenSnapshotRow[] = Array.from({ length: 9 }, (_, i) =>
      frozen(
        `s${9 - i}`,
        `2026-0${((9 - i) % 9) + 1}-01T00:00:00.000Z`,
        `${1000000 + i}`,
        "PERIODIC",
      ),
    );

    const { chart, rows } = buildSnapshotHistoryView(
      frozenDesc,
      "9999999",
      NOW,
    );

    expect(rows).toHaveLength(10); // live + 9 frozen
    expect(chart.points).toHaveLength(8); // 7 frozen gần nhất + 1 live
  });

  test("max = 0 (mọi giá trị đưa vào chart đều 0) — heightPercent 0, không chia 0/NaN", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s1", "2026-06-30T00:00:00.000Z", "0", "PERIODIC"),
    ];

    const { chart } = buildSnapshotHistoryView(frozenDesc, "0", NOW);

    expect(chart.points).toEqual([
      { label: "T6/26", heightPercent: 0 },
      { label: "nay", heightPercent: 0, isLive: true },
    ]);
  });

  test("label chart phân biệt được các mốc cùng tháng khác năm (issue #82)", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s2", "2025-12-31T00:00:00.000Z", "3000000", "YEAR_END"),
      frozen("s1", "2024-12-31T00:00:00.000Z", "2000000", "YEAR_END"),
    ];

    const { chart } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);

    const frozenLabels = chart.points
      .filter((p) => !p.isLive)
      .map((p) => p.label);
    expect(frozenLabels).toEqual(["T12/24", "T12/25"]);
    expect(new Set(frozenLabels).size).toBe(frozenLabels.length);
  });

  test("changePercent = 0 khi chưa có dòng frozen nào", () => {
    const { chart, rows } = buildSnapshotHistoryView([], "3200000", NOW);

    expect(chart.changePercent).toBe(0);
    expect(rows).toHaveLength(1);
  });

  test("changePercent = 0 khi dòng frozen gần nhất có value = 0 (tránh chia 0)", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s1", "2026-06-30T00:00:00.000Z", "0", "MANUAL"),
    ];

    const { chart } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);

    expect(chart.changePercent).toBe(0);
  });

  test("changePercent so với dòng frozen GẦN NHẤT (frozenDesc[0]), không phải trung bình/cũ nhất", () => {
    const frozenDesc: FrozenSnapshotRow[] = [
      frozen("s2", "2026-06-30T00:00:00.000Z", "3000000", "PERIODIC"),
      frozen("s1", "2025-12-31T00:00:00.000Z", "1000000", "YEAR_END"),
    ];

    const { chart } = buildSnapshotHistoryView(frozenDesc, "3200000", NOW);

    expect(chart.changePercent).toBeCloseTo(
      ((3200000 - 3000000) / 3000000) * 100,
    );
  });
});

describe("toFrozenSnapshotListRow", () => {
  test("map 1 FrozenSnapshotRow sang SnapshotListRow{kind:frozen} — label/badge/dateNote/href đúng theo period", () => {
    const row = frozen(
      "periodic",
      "2026-06-30T00:00:00.000Z",
      "3000000",
      "PERIODIC",
    );

    expect(toFrozenSnapshotListRow(row)).toEqual({
      kind: "frozen",
      id: "periodic",
      label: "Cuối tháng 6",
      badge: { text: "ĐỊNH KỲ", variant: "default" },
      dateNote: `${formatDate(row.date)} · định kỳ hàng tháng`,
      value: "3000000",
      href: ROUTES.snapshotDetail("periodic"),
    });
  });
});
