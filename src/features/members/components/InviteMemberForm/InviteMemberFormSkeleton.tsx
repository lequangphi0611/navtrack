import { Skeleton } from "@/components/ui/skeleton";

// Khớp hình dạng InviteMemberForm.
function InviteMemberFormSkeleton() {
  return (
    <div className="flex gap-2.5">
      <Skeleton className="h-11 flex-1 rounded-xl" />
      <Skeleton className="h-11 w-16 rounded-xl" />
    </div>
  );
}

export { InviteMemberFormSkeleton };
