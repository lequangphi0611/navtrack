import { Skeleton } from "@/components/ui/skeleton";

type MemberListSkeletonProps = {
  rows?: number;
};

// Khớp hình dạng MemberList: avatar + email/vai trò + pill trạng thái.
function MemberListSkeleton({ rows = 3 }: MemberListSkeletonProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3"
        >
          <Skeleton className="size-9 rounded-[30%]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export { MemberListSkeleton };
