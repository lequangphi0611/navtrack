import type { AssetType } from "@/components/AssetTypeBadge";
import type {
  NavTrendPeriod,
  NavTrendPoint,
} from "@/features/dashboard/components/NavTrendChart";

// Types dùng chung giữa NavTrendByAssetTypeChart/AssetTypeFilterChips — tách
// file riêng để tránh import vòng (chip cần biết AssetTypeFilter mà không cần
// import ngược lại component chart). Props "firm up" từ bản phác thảo ở
// process/UI_nav-trend-by-asset-type.md (design-implementer chốt khi hiện
// thực, xem "Điểm cần xác nhận" đã orchestrator chốt sẵn 4/7 điểm).

type AssetTypeFilter = "ALL" | AssetType;

// Mở rộng field riêng (issue #139) so với NavTrendPeriodData gốc — points/
// changePercent giữ nguyên ý nghĩa, thêm navAmount (NAV cuối kỳ của LOẠI/TẤT
// CẢ đang lọc) + 4 field card insight optional (chỉ 1 CẶP xuất hiện tuỳ dữ
// liệu, xem NavTrendByAssetTypeChart.tsx).
type NavTrendByAssetTypePeriodData = {
  points: NavTrendPoint[]; // rỗng/1 phần tử = "chưa vẽ được đường" — KHÁC nghĩa "chưa từng có vị thế" (xem AssetTypeFilterOption.hasData)
  changePercent: number;
  navAmount: string; // Decimal serialize — ẨN theo `hidden`

  // Card insight (dưới note box, chỉ khi assetType !== "ALL") — component chọn
  // biến thể THUẦN THEO DỮ LIỆU: cả groupXirrPercent+depositedInPeriod có giá
  // trị -> card "XIRR + nạp thêm"; nếu không nhưng cả periodHigh+periodLow có
  // giá trị -> card "Cao nhất/Thấp nhất kỳ"; không trường nào có -> không hiện
  // card nào. KHÔNG hardcode "loại nào dùng card nào" trong component.
  groupXirrPercent?: number;
  depositedInPeriod?: string; // Decimal serialize CÓ dấu (+/-), ẨN theo `hidden`
  periodHigh?: string; // Decimal serialize, ẨN theo `hidden`
  periodLow?: string; // Decimal serialize, ẨN theo `hidden`
  // % biên độ trong kỳ = (periodHigh − periodLow) / periodLow × 100 — LUÔN dương,
  // đo mức "trồi sụt" NAV (không phải lãi/lỗ, không thay XIRR). Đi kèm
  // periodHigh/periodLow (cùng có/cùng undefined, trừ ca periodLow = 0).
  // KHÔNG áp `hidden` — là tỷ lệ, không lộ VND.
  periodSpreadPercent?: number;
};

type AssetTypeFilterOption = {
  type: AssetTypeFilter;
  hasData: boolean; // false = loại chưa từng có vị thế nào (139e) — chip vẫn bấm được
  // % đổi của kỳ ĐANG chọn cho loại này — dùng cho gợi ý "N loại còn lại đã có
  // dữ liệu" ở trạng thái rỗng; undefined khi !hasData.
  latestChangePercent?: number;
};

type NavTrendByAssetTypeChartProps = {
  filters: AssetTypeFilterOption[]; // LUÔN 5 phần tử, thứ tự cố định: ALL, STOCK, FUND, BOND, GOLD
  // Preload sẵn CẢ 5 loại x 3 kỳ (15 bộ) — theo đúng phác thảo digest, quyết
  // định data-fetching (có nên preload hết hay không) NGOÀI PHẠM VI issue này.
  dataByFilter: Record<
    AssetTypeFilter,
    Record<NavTrendPeriod, NavTrendByAssetTypePeriodData>
  >;
  hidden?: boolean;
  // href tạo vị thế mới theo loại, dùng cho CTA ở trạng thái rỗng (139e) —
  // string có sẵn từ props, component KHÔNG tự bịa ROUTES/query param (quyết
  // định route CTA NGOÀI PHẠM VI issue này).
  newHoldingHrefByType: Record<AssetType, string>;
};

export type {
  AssetType,
  AssetTypeFilter,
  AssetTypeFilterOption,
  NavTrendByAssetTypeChartProps,
  NavTrendByAssetTypePeriodData,
  NavTrendPeriod,
  NavTrendPoint,
};
