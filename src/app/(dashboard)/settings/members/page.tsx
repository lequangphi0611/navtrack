import { Alert } from "@/components/Alert";
import { InviteMemberForm } from "@/features/members/components/InviteMemberForm";
import { getInvitableStatus } from "@/features/members/queries";

export default async function MembersSettingsPage() {
  const { canInvite, activeCount, maxMembers } = await getInvitableStatus();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Quản lý thành viên
      </h1>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          Thành viên đang hoạt động
        </div>
        <div className="font-mono text-[19px] font-semibold tabular-nums text-foreground">
          {activeCount} / {maxMembers}
        </div>
      </div>

      {canInvite ? (
        <InviteMemberForm />
      ) : (
        <Alert
          variant="info"
          title="Bạn không có quyền mời thành viên"
          description="Liên hệ người quản trị nếu bạn cần mời thêm người."
        />
      )}
    </div>
  );
}
