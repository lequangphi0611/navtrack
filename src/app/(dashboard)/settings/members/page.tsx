import { MembersDeniedScreen } from "@/features/members/components/MembersDeniedScreen";
import { MembersListScreen } from "@/features/members/components/MembersListScreen";
import { getInvitableStatus } from "@/features/members/queries";

export default async function MembersSettingsPage() {
  const { canInvite, activeCount, maxMembers } = await getInvitableStatus();

  if (!canInvite) return <MembersDeniedScreen />;

  return (
    <MembersListScreen activeCount={activeCount} maxMembers={maxMembers} />
  );
}
