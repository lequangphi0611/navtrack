import { MemberList } from "@/features/members/components/MemberList";
import { getMembers } from "@/features/members/queries";

// Container (Server Component): vùng data danh sách allowlist — stream độc lập với quota.
async function InvitedMembersSection() {
  const members = await getMembers();
  return <MemberList members={members} />;
}

export { InvitedMembersSection };
