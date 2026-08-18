"use client";

import { useState, useTransition } from "react";

import { setHideAmountsByDefault } from "@/features/settings/actions";

import { NavTrendByAssetTypeScreen } from "./NavTrendByAssetTypeScreen";
import type { NavTrendByAssetTypeChartProps } from "./types";

type NavTrendByAssetTypeScreenClientProps = {
  backHref: string;
  // Container truyền props chart KHÔNG kèm `hidden` — client wrapper này là
  // nguồn sự thật DUY NHẤT cho `hidden` (đọc từ giá trị mặc định server rồi
  // toggle optimistic), mirror StockAllocationDetailClient.
  chart: Omit<NavTrendByAssetTypeChartProps, "hidden">;
  // Đọc từ User.hideAmountsByDefault (server) — khởi tạo state local.
  initialHidden: boolean;
};

// Client wrapper DUY NHẤT của NavTrendByAssetTypeScreen (organism, KHÔNG được
// "use client" — xem NavTrendByAssetTypeScreen.tsx) — giữ đúng 1 state cục bộ
// `hidden`, persist qua Server Action giống StockAllocationDetailClient/
// DashboardScreenClient. KHÔNG giữ assetType/period ở đây (khác
// StockAllocationDetailClient không cần vì NavTrendByAssetTypeChart tự giữ 2
// state đó nội bộ — xem digest process/UI_nav-trend-by-asset-type.md).
function NavTrendByAssetTypeScreenClient({
  backHref,
  chart,
  initialHidden,
}: NavTrendByAssetTypeScreenClientProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  const handleToggleHidden = () => {
    // startTransition ở TOP-LEVEL handler — cùng lý do đã ghi ở
    // DashboardScreenClient.tsx (tránh "Cannot call startTransition while
    // rendering").
    const previous = hidden;
    const next = !previous;
    setHidden(next);
    startTransition(() => {
      void setHideAmountsByDefault(next)
        .then((result) => {
          if (!result.ok) setHidden(previous);
        })
        .catch(() => {
          setHidden(previous);
        });
    });
  };

  return (
    <NavTrendByAssetTypeScreen
      backHref={backHref}
      chart={{ ...chart, hidden }}
      hidden={hidden}
      onToggleHidden={handleToggleHidden}
    />
  );
}

export { NavTrendByAssetTypeScreenClient };
export type { NavTrendByAssetTypeScreenClientProps };
