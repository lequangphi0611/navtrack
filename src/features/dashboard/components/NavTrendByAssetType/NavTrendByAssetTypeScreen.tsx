import { MoneyValueToggleButton } from "@/components/MoneyValue";
import { PageHeader } from "@/components/PageHeader";

import { NavTrendByAssetTypeChart } from "./NavTrendByAssetTypeChart";
import type { NavTrendByAssetTypeChartProps } from "./types";

type NavTrendByAssetTypeScreenProps = {
  backHref: string;
  chart: NavTrendByAssetTypeChartProps;
  // Có mặt onToggleHidden = hiện nút mắt header (mirror AllocationScreen/
  // StockAllocationDetail). Vắng mặt = ẩn nút.
  hidden?: boolean;
  onToggleHidden?: () => void;
};

// Server Component (organism) — KHÔNG "use client" (component-architecture.md
// "Cấm 'use client' ở *Screen"). Header tĩnh, mọi tương tác (chọn loại/kỳ, ẩn
// tiền) sống ở NavTrendByAssetTypeChart (client leaf) + NavTrendByAssetTypeScreenClient
// (client wrapper, xem digest process/UI_nav-trend-by-asset-type.md).
//
// Subtitle "Cổ phiếu · kỳ Năm" trong mockup (139a-e) KHÔNG dựng ở đây — nó phụ
// thuộc assetType/period, hai state chỉ tồn tại NỘI BỘ trong
// NavTrendByAssetTypeChart (client leaf), Screen (server) không biết được. Nâng
// state đó lên Screen sẽ đổi cả kiến trúc digest đã mô tả (client leaf tự giữ
// state) — để nguyên header tĩnh "Biến động NAV", quyết định này ghi lại để
// business-implementer/design-implementer sau biết vì sao subtitle không khớp
// 100% mockup.
function NavTrendByAssetTypeScreen({
  backHref,
  chart,
  hidden = false,
  onToggleHidden,
}: NavTrendByAssetTypeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Biến động NAV"
        backHref={backHref}
        trailing={
          onToggleHidden ? (
            <MoneyValueToggleButton
              hidden={hidden}
              onToggleHidden={onToggleHidden}
            />
          ) : undefined
        }
      />

      <NavTrendByAssetTypeChart {...chart} />
    </div>
  );
}

export { NavTrendByAssetTypeScreen };
export type { NavTrendByAssetTypeScreenProps };
