import type { AssetType } from "@/components/AssetTypeBadge";
import { NavTrendByAssetTypeScreenClient } from "@/features/dashboard/components/NavTrendByAssetType";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { getNavTrendByAssetType } from "@/features/snapshots/queries";
import { ROUTES } from "@/lib/routes";

// CTA "+ Thêm vị thế {Loại}" ở trạng thái rỗng (139e) dùng query param `?type=`
// trên /holdings/new — process/decisions/pricing-and-valuation.md 2026-08-18
// điểm 4. `/holdings/new` tự đọc + validate param này (isAssetType()).
const NEW_HOLDING_HREF_BY_TYPE: Record<AssetType, string> = {
  STOCK: `${ROUTES.newHolding}?type=STOCK`,
  FUND: `${ROUTES.newHolding}?type=FUND`,
  BOND: `${ROUTES.newHolding}?type=BOND`,
  GOLD: `${ROUTES.newHolding}?type=GOLD`,
};

// "/nav-chart" — biến động NAV theo loại tài sản (issue #139/#141), lối vào từ
// header "Giá trị tài sản" của NavTrendChart trên Dashboard. Route ĐỘC LẬP,
// KHÔNG nối tiếp /allocation (process/decisions/pricing-and-valuation.md
// 2026-08-18 điểm 5) — `backHref` trỏ thẳng về Dashboard.
//
// getNavTrendByAssetType() quyết định TOÀN BỘ layout (filters/dataByFilter —
// chart Presentational tự rẽ nhánh rỗng/có dữ liệu bên trong) nên await thẳng
// ở page (checklist component-architecture.md mục 3) — cùng pattern
// StockAllocationPage. getHideAmountsByDefault() không quyết định nhánh, chạy
// song song.
export default async function NavChartPage() {
  const [data, hideAmountsByDefault] = await Promise.all([
    getNavTrendByAssetType(),
    getHideAmountsByDefault(),
  ]);

  return (
    <NavTrendByAssetTypeScreenClient
      backHref={ROUTES.dashboard}
      initialHidden={hideAmountsByDefault}
      chart={{
        filters: data.filters,
        dataByFilter: data.dataByFilter,
        newHoldingHrefByType: NEW_HOLDING_HREF_BY_TYPE,
      }}
    />
  );
}
