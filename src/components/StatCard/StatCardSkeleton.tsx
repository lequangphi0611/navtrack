import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardSkeletonProps = {
  className?: string;
};

// Khớp hình dạng StatCard (label + value + note phụ).
function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <Skeleton className="mb-1.5 h-3 w-32" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-1.5 h-3 w-52" />
    </div>
  );
}

export { StatCardSkeleton };
export type { StatCardSkeletonProps };
