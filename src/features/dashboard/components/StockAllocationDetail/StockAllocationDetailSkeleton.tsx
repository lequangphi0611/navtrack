import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung StockAllocationDetail: header (nút back + 2 dòng) + hàng đếm/chip
// sort + N dòng row-skeleton (avatar + 2 cột chữ + thanh tỉ lệ) + footer card —
// mirror cách AllocationScreenSkeleton.tsx đã làm. Không có mockup skeleton
// riêng (process/UI_stock-allocation-detail.md) — tự suy hình dạng từ layout
// StockAllocationRow thật.
function StockAllocationDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <div className="flex-1">
          <Skeleton className="h-4.5 w-24" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-6.5 w-24 rounded-full" />
      </div>

      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-3.5"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
              <div className="text-right">
                <Skeleton className="ml-auto h-5 w-12" />
                <Skeleton className="mt-1.5 ml-auto h-2.5 w-16" />
              </div>
            </div>
            <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}

export { StockAllocationDetailSkeleton };
