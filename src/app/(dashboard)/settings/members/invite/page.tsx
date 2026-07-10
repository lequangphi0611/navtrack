import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { InviteMemberForm } from "@/features/members/components/InviteMemberForm";
import { getInvitableStatus } from "@/features/members/queries";
import { ROUTES } from "@/lib/routes";

export default async function InviteMemberPage() {
  // Guard phía server: chỉ user còn quyền mời mới vào được, dù link mời chỉ
  // hiện ở MembersListScreen cho người có quyền — phòng trường hợp gõ thẳng URL.
  const { canInvite } = await getInvitableStatus();
  if (!canInvite) redirect(ROUTES.members);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Mời thành viên"
        backHref={ROUTES.members}
        variant="close"
      />
      <InviteMemberForm />
      <p className="text-[11.5px] text-muted-faint">
        Người được mời không tự mời thêm ai khác — chỉ người có quyền mời làm
        được.
      </p>
    </div>
  );
}
