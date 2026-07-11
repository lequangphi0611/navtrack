import { Skeleton } from "@/components/ui/skeleton";
import { MemberListSkeleton } from "@/features/members/components/MemberList";
import { MemberQuotaCardSkeleton } from "@/features/members/components/MemberQuotaCard";

// Chưa biết nhánh canInvite lúc này — dùng khung đầy đủ (quota + list) làm mặc định.
export default function MembersSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-5 w-24" />
      </div>
      <MemberQuotaCardSkeleton />
      <MemberListSkeleton />
    </div>
  );
}
