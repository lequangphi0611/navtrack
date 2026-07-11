import { PageHeader } from "@/components/PageHeader";
import { MembersDeniedScreen } from "@/features/members/components/MembersDeniedScreen";
import { MembersListScreen } from "@/features/members/components/MembersListScreen";
import { getInvitableStatus } from "@/features/members/queries";
import { ROUTES } from "@/lib/routes";

export default async function MembersSettingsPage() {
  const { canInvite, activeCount, maxMembers } = await getInvitableStatus();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Thành viên" backHref={ROUTES.settings} />
      {canInvite ? (
        <MembersListScreen activeCount={activeCount} maxMembers={maxMembers} />
      ) : (
        <MembersDeniedScreen />
      )}
    </div>
  );
}
