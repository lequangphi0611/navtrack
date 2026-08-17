import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung AllocationScreen: header + donut tròn + thẻ tổng NAV/lãi-lỗ +
// legend card (mỗi dòng nhóm nay 2 dòng: % + NAV/lãi-lỗ, issue #130) — dùng
// cho loading.tsx của route /allocation.
function AllocationScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-4.5 w-32" />
      </div>
      <Skeleton className="mx-auto size-56 rounded-full" />
      <div className="rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-2 h-6 w-40" />
        <Skeleton className="mt-2.5 h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { AllocationScreenSkeleton };
