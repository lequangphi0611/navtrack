import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung NavTrendChart: nhãn nhỏ + pill %, SegmentedControl, khối chart —
// dùng khi gộp vào DashboardScreenSkeleton (vùng data này hiện KHÔNG có Suspense
// riêng, xem ghi chú kiến trúc trong PortfolioOverviewSection — cả trang chờ
// cùng lúc, colocate skeleton vẫn giữ để tái dùng nếu sau này tách Suspense).
function NavTrendChartSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4.5 w-14 rounded-full" />
      </div>
      <Skeleton className="mb-3.5 h-8 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-2.5 flex gap-3">
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
      </div>
    </div>
  );
}

export { NavTrendChartSkeleton };
