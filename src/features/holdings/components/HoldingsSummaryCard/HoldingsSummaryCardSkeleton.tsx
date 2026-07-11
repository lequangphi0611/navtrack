import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng HoldingsSummaryCard: nhãn+vốn, NAV, hàng 3 pill (lãi/lỗ, %, XIRR).
function HoldingsSummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4.5">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mt-2 h-6 w-44" />
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    </div>
  );
}

export { HoldingsSummaryCardSkeleton };
