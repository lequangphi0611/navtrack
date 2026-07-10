import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng HoldingRow: avatar + 2 dòng trái + 2 dòng phải.
function HoldingRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5">
      <Skeleton className="size-10" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export { HoldingRowSkeleton };
