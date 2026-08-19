import { Skeleton } from "@/components/ui/skeleton";

import { NavTrendByAssetTypeChartSkeleton } from "./NavTrendByAssetTypeChartSkeleton";

// Khớp khung NavTrendByAssetTypeScreen thật: header (nút back + tiêu đề
// "Biến động NAV", không subtitle — mirror AllocationScreenSkeleton) bọc
// quanh NavTrendByAssetTypeChartSkeleton (đã dựng ở issue #139). Dùng cho
// loading.tsx của route /nav-chart.
function NavTrendByAssetTypeScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-4.5 w-32" />
      </div>

      <NavTrendByAssetTypeChartSkeleton />
    </div>
  );
}

export { NavTrendByAssetTypeScreenSkeleton };
