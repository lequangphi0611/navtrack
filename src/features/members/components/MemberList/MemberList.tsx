import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Member } from "../../types";

type MemberListProps = {
  members: Member[];
  className?: string;
};

function memberRole(member: Member): string {
  if (member.revoked) return "Đã thu hồi";
  return member.canInvite ? "Admin · có quyền mời" : "Thành viên";
}

function MemberList({ members, className }: MemberListProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {members.map((member) => (
        <div
          key={member.id}
          className={cn(
            "flex items-center gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3",
            member.revoked && "opacity-60",
          )}
        >
          <UserAvatar name={member.email} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-foreground">
              {member.email}
            </div>
            <div className="mt-px text-[11.5px] text-muted-faint">
              {memberRole(member)}
            </div>
          </div>
          <Badge variant={member.revoked ? "destructive" : "gain"}>
            {member.revoked ? "Đã thu hồi" : "Hoạt động"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export { MemberList };
export type { MemberListProps };
