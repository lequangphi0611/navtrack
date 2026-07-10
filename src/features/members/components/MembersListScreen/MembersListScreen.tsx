import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { InvitedMembersSection } from "@/features/members/components/InvitedMembersSection";
import { MemberListSkeleton } from "@/features/members/components/MemberList";
import { MemberQuotaCard } from "@/features/members/components/MemberQuotaCard";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type MembersListScreenProps = {
  activeCount: number;
  maxMembers: number;
};

// Có quyền mời: quota + danh sách (avatar/icon) + nút điều hướng sang trang mời riêng.
function MembersListScreen({
  activeCount,
  maxMembers,
}: MembersListScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Thành viên" backHref={ROUTES.settings} />

      <MemberQuotaCard activeCount={activeCount} maxMembers={maxMembers} />

      <div>
        <div className="mb-2 text-[12.5px] font-semibold text-muted-foreground">
          Đã mời
        </div>
        <Suspense fallback={<MemberListSkeleton />}>
          <InvitedMembersSection />
        </Suspense>
      </div>

      <Link
        href={ROUTES.inviteMember}
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-auto h-12 gap-2 rounded-[14px] text-[14.5px] font-semibold",
        )}
      >
        <Plus className="size-4.5" />
        Mời thành viên
      </Link>
    </div>
  );
}

export { MembersListScreen };
export type { MembersListScreenProps };
