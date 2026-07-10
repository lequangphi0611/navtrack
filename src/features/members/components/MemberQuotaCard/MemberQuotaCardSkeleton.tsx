import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng MemberQuotaCard.
function MemberQuotaCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3.5 w-12" />
      </div>
      <Skeleton className="h-1.75 rounded-full" />
      <Skeleton className="h-3 w-64" />
    </div>
  );
}

export { MemberQuotaCardSkeleton };
