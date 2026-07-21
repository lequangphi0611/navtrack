import {
  NavTrendChart,
  type NavTrendPeriod,
  type NavTrendPeriodData,
} from "@/features/dashboard/components/NavTrendChart";

// Sample series đơn giản: NAV tăng dần theo tháng, kèm 1 vài mốc dao động —
// đủ 3 kỳ (Tháng/Năm/Tất cả) để soi SegmentedControl + tooltip.
const YEAR_DATES = [
  "2025-08-15",
  "2025-09-15",
  "2025-10-15",
  "2025-11-15",
  "2025-12-15",
  "2026-01-15",
  "2026-02-15",
  "2026-03-15",
  "2026-04-15",
  "2026-05-15",
  "2026-06-15",
  "2026-07-21",
];
const YEAR_VALUES = [
  "3200000000",
  "3350000000",
  "3180000000",
  "3420000000",
  "3610000000",
  "3550000000",
  "3720000000",
  "3890000000",
  "3760000000",
  "3980000000",
  "4120000000",
  "4260000000",
];

function buildPoints(): NavTrendPeriodData {
  const start = Number(YEAR_VALUES[0]);
  const points = YEAR_DATES.map((date, i) => {
    const value = Number(YEAR_VALUES[i]);
    return {
      date,
      value: String(value),
      changePercentFromStart: ((value - start) / start) * 100,
    };
  });
  const last = points[points.length - 1];
  return { points, changePercent: last?.changePercentFromStart ?? 0 };
}

const YEAR_DATA = buildPoints();
const MONTH_DATA: NavTrendPeriodData = {
  points: YEAR_DATA.points.slice(-3),
  changePercent: YEAR_DATA.points.slice(-3).at(-1)?.changePercentFromStart ?? 0,
};
const ALL_DATA: NavTrendPeriodData = YEAR_DATA;

const FULL_DATA: Record<NavTrendPeriod, NavTrendPeriodData> = {
  MONTH: MONTH_DATA,
  YEAR: YEAR_DATA,
  ALL: ALL_DATA,
};

const EMPTY_DATA: Record<NavTrendPeriod, NavTrendPeriodData> = {
  MONTH: {
    points: [
      { date: "2026-07-21", value: "3200000000", changePercentFromStart: 0 },
    ],
    changePercent: 0,
  },
  YEAR: {
    points: [
      { date: "2026-07-21", value: "3200000000", changePercentFromStart: 0 },
    ],
    changePercent: 0,
  },
  ALL: {
    points: [
      { date: "2026-07-21", value: "3200000000", changePercentFromStart: 0 },
    ],
    changePercent: 0,
  },
};

// 3 biến thể: 6a (có dữ liệu), 6b (rỗng, <2 mốc), + hidden=true (ẩn số tiền).
export default function NavTrendChartPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-5">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          6a — mặc định
        </div>
        <NavTrendChart data={FULL_DATA} />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          6a — hidden=true (ẩn số tiền)
        </div>
        <NavTrendChart data={FULL_DATA} hidden />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          6b — rỗng (&lt; 2 mốc snapshot)
        </div>
        <NavTrendChart data={EMPTY_DATA} />
      </div>
    </div>
  );
}
