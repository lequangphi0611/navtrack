import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung DashboardScreen: header, chip mốc chốt, NAV hero, 2 thẻ XIRR/PnL,
// phân bổ, note nguồn giá — dùng cho loading.tsx của route "/" khi được wiring.
function DashboardScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5.5 w-24" />
        </div>
        <Skeleton className="size-10 rounded-[30%]" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

export { DashboardScreenSkeleton };
