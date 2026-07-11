import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveSetting, SETTING_KEYS } from "@/lib/settings";

import type { InvitableStatus, Member } from "./types";

export async function getInvitableStatus(): Promise<InvitableStatus> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const [me, activeCount, maxMembers] = await Promise.all([
    db.allowedUser.findUnique({ where: { email: session.user.email } }),
    db.allowedUser.count({ where: { revokedAt: null } }),
    resolveSetting(SETTING_KEYS.MAX_MEMBERS, new Date()),
  ]);

  return {
    canInvite: !!me?.canInvite && !me.revokedAt,
    activeCount,
    maxMembers: Number(maxMembers),
  };
}

// Danh sách allowlist là dữ liệu chung của cả nhóm (không tách theo userId) —
// mọi thành viên đã đăng nhập đều xem được (mockup 2f).
export async function getMembers(): Promise<Member[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const members = await db.allowedUser.findMany({
    orderBy: { createdAt: "asc" },
  });

  return members.map((member) => ({
    id: member.id,
    email: member.email,
    canInvite: member.canInvite,
    revoked: member.revokedAt !== null,
  }));
}
