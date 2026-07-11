import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

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
// Shell (PageHeader + wrapper) do page.tsx sở hữu — component chỉ render phần nội dung.
function MembersListScreen({
  activeCount,
  maxMembers,
}: MembersListScreenProps) {
  return (
    <>
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
    </>
  );
}

export { MembersListScreen };
export type { MembersListScreenProps };
