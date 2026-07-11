import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng HoldingsGroupCard: header (dot+nhãn+tổng) + 2 dòng vị thế.
function HoldingsGroupCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2.5 p-3.5">
        <Skeleton className="size-2.5 rounded-sm" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="ml-auto h-3.5 w-24" />
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-t border-white/5 p-3.5"
        >
          <Skeleton className="size-9" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

export { HoldingsGroupCardSkeleton };
