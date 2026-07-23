import { Skeleton } from "@/components/ui/skeleton";

// Khớp khung AllocationScreen: header + donut tròn + legend card — dùng cho
// loading.tsx của route /allocation.
function AllocationScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-4.5 w-32" />
      </div>
      <Skeleton className="mx-auto size-56 rounded-full" />
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export { AllocationScreenSkeleton };
