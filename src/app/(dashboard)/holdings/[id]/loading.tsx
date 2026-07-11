import { Skeleton } from "@/components/ui/skeleton";

// Khung skeleton khớp layout chi tiết vị thế: header back + badge + card tổng vốn + lịch sử.
export default function HoldingDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-32 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
