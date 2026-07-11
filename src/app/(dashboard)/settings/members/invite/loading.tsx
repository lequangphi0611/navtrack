import { Skeleton } from "@/components/ui/skeleton";
import { InviteMemberFormSkeleton } from "@/features/members/components/InviteMemberForm";

export default function InviteMemberLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5">
      <div className="flex items-center gap-3.5 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-[10px]" />
        <Skeleton className="h-5 w-32" />
      </div>
      <InviteMemberFormSkeleton />
    </div>
  );
}
