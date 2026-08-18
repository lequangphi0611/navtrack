import {
  NavTrendByAssetTypeChart,
  NavTrendByAssetTypeChartSkeleton,
  type AssetTypeFilter,
  type AssetTypeFilterOption,
  type NavTrendByAssetTypeChartProps,
  type NavTrendByAssetTypePeriodData,
} from "@/features/dashboard/components/NavTrendByAssetType";
import type {
  NavTrendPeriod,
  NavTrendPoint,
} from "@/features/dashboard/components/NavTrendChart";

// 5 mốc mẫu kỳ Năm — khớp digest process/UI_nav-trend-by-asset-type.md mục
// "Sample data" (T9/25, T12/25, T3/26, T6/26, T8/26).
const YEAR_DATES = [
  "2025-09-15",
  "2025-12-15",
  "2026-03-15",
  "2026-06-15",
  "2026-08-18",
];

function buildPoints(values: number[]): NavTrendPoint[] {
  const start = values[0]!;
  return YEAR_DATES.map((date, i) => {
    const value = values[i]!;
    return {
      date,
      value: String(value),
      changePercentFromStart: ((value - start) / start) * 100,
    };
  });
}

// MONTH = 3 mốc cuối của YEAR, ALL = gộp YEAR — mirror preview/nav-trend-chart
// (buildPoints tương tự) thay vì bịa dữ liệu riêng cho từng kỳ.
function buildPeriodSet(
  yearValues: number[],
  navAmount: string,
  changePercent: number,
  extra?: Partial<
    Pick<
      NavTrendByAssetTypePeriodData,
      "groupXirrPercent" | "depositedInPeriod" | "periodHigh" | "periodLow"
    >
  >,
): Record<NavTrendPeriod, NavTrendByAssetTypePeriodData> {
  const yearPoints = buildPoints(yearValues);
  const monthPoints = yearPoints.slice(-3);
  return {
    MONTH: { points: monthPoints, changePercent, navAmount, ...extra },
    YEAR: { points: yearPoints, changePercent, navAmount, ...extra },
    ALL: { points: yearPoints, changePercent, navAmount, ...extra },
  };
}

// 139a — "Tất cả": NAV 438tr, +12,4%/năm.
const ALL_DATA = buildPeriodSet(
  [389680000, 402000000, 415000000, 427000000, 438000000],
  "438000000",
  12.4,
);

// 139b — Cổ phiếu: NAV 420tr, +15,8%/năm, card "XIRR nhóm + Nạp thêm trong kỳ".
const STOCK_DATA = buildPeriodSet(
  [362000000, 378000000, 395000000, 408000000, 420000000],
  "420000000",
  15.8,
  { groupXirrPercent: 9.7, depositedInPeriod: "24000000" },
);

// Quỹ — không field insight nào (KHÔNG có mockup riêng, digest chỉ nêu % ở
// danh sách "3 loại còn lại" 139e) — dùng để soi nhánh "không có card insight
// nào" (điểm #1 orchestrator đã chốt: thiếu cả 2 cặp field -> không render).
const FUND_DATA = buildPeriodSet(
  [88000000, 90500000, 92000000, 93500000, 95000000],
  "95000000",
  8.1,
);

// 139c — Vàng: NAV 18tr, -3,2%/năm, card "Cao nhất/Thấp nhất kỳ".
const GOLD_DATA = buildPeriodSet(
  [18600000, 17900000, 18300000, 17700000, 18000000],
  "18000000",
  -3.2,
  { periodHigh: "19400000", periodLow: "17500000" },
);

// 139e — Trái phiếu chưa từng có vị thế (hasData=false ở FILTERS bên dưới) —
// component không bao giờ đọc tới nhánh dataByFilter.BOND khi render (early
// return EmptyAssetTypeState), giữ placeholder rỗng cho đủ kiểu Record.
const BOND_EMPTY_PERIOD: NavTrendByAssetTypePeriodData = {
  points: [],
  changePercent: 0,
  navAmount: "0",
};
const BOND_DATA: Record<NavTrendPeriod, NavTrendByAssetTypePeriodData> = {
  MONTH: BOND_EMPTY_PERIOD,
  YEAR: BOND_EMPTY_PERIOD,
  ALL: BOND_EMPTY_PERIOD,
};

const FILTERS: AssetTypeFilterOption[] = [
  { type: "ALL", hasData: true },
  { type: "STOCK", hasData: true, latestChangePercent: 15.8 },
  { type: "FUND", hasData: true, latestChangePercent: 8.1 },
  { type: "BOND", hasData: false },
  { type: "GOLD", hasData: true, latestChangePercent: -3.2 },
];

const DATA_BY_FILTER: Record<
  AssetTypeFilter,
  Record<NavTrendPeriod, NavTrendByAssetTypePeriodData>
> = {
  ALL: ALL_DATA,
  STOCK: STOCK_DATA,
  FUND: FUND_DATA,
  BOND: BOND_DATA,
  GOLD: GOLD_DATA,
};

const NEW_HOLDING_HREF_BY_TYPE: NavTrendByAssetTypeChartProps["newHoldingHrefByType"] =
  {
    STOCK: "#new-holding-stock",
    FUND: "#new-holding-fund",
    BOND: "#new-holding-bond",
    GOLD: "#new-holding-gold",
  };

// assetType/period là state NỘI BỘ của NavTrendByAssetTypeChart (không phải
// prop) — mirror preview/nav-trend-chart (đổi SegmentedControl bằng tương tác,
// không mount instance riêng cho mỗi kỳ). Soi 139b/139c/139e bằng cách BẤM
// chip loại trong cùng 1 instance thay vì mount 5 instance cố định state khác
// nhau (không khả thi vì assetType không phải prop, đúng kiến trúc digest).
export default function NavTrendByAssetTypeChartPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 p-5">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          139a/139b/139c/139e — mặc định &quot;Tất cả&quot;. Bấm chip &quot;Cổ
          phiếu&quot;/&quot;Quỹ&quot;/&quot;Vàng&quot;/&quot;Trái phiếu&quot; để
          soi từng biến thể (Trái phiếu = rỗng), đổi Tháng/Năm/Tất cả để soi các
          kỳ.
        </div>
        <NavTrendByAssetTypeChart
          filters={FILTERS}
          dataByFilter={DATA_BY_FILTER}
          newHoldingHrefByType={NEW_HOLDING_HREF_BY_TYPE}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          139d — hidden=true. Bấm chip &quot;Cổ phiếu&quot; để soi đúng nền
          mockup 139d (VND ẩn, % và hình dạng đường giữ nguyên).
        </div>
        <NavTrendByAssetTypeChart
          filters={FILTERS}
          dataByFilter={DATA_BY_FILTER}
          newHoldingHrefByType={NEW_HOLDING_HREF_BY_TYPE}
          hidden
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          139f — skeleton loading
        </div>
        <NavTrendByAssetTypeChartSkeleton />
      </div>
    </div>
  );
}
