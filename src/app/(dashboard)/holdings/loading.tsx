import { Skeleton } from "@/components/ui/skeleton";
import { HoldingRowSkeleton } from "@/features/holdings/components/HoldingRow";

// Khung skeleton khớp layout 2d: header + card tổng vốn + tabs + danh sách vị thế.
export default function HoldingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28 rounded-lg" />
        <Skeleton className="size-10 rounded-[30%]" />
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-9 w-44 rounded-xl" />
      <div className="flex flex-col gap-2.5">
        <HoldingRowSkeleton />
        <HoldingRowSkeleton />
        <HoldingRowSkeleton />
        <HoldingRowSkeleton />
      </div>
    </div>
  );
}
