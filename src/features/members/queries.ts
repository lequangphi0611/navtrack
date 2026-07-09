import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveSetting } from "@/lib/settings";

import type { InvitableStatus } from "./types";

export async function getInvitableStatus(): Promise<InvitableStatus> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const [me, activeCount, maxMembers] = await Promise.all([
    db.allowedUser.findUnique({ where: { email: session.user.email } }),
    db.allowedUser.count({ where: { revokedAt: null } }),
    resolveSetting("MAX_MEMBERS", new Date()),
  ]);

  return {
    canInvite: !!me?.canInvite && !me.revokedAt,
    activeCount,
    maxMembers: Number(maxMembers),
  };
}
