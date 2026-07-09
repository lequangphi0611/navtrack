"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { resolveSetting } from "@/lib/settings";

import { inviteSchema } from "./schemas";

export async function inviteMember(
  input: unknown,
): Promise<ActionResult<{ email: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Email không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, error: "Chưa đăng nhập" };
  }

  const inviter = await db.allowedUser.findUnique({
    where: { email: session.user.email },
  });
  if (!inviter || inviter.revokedAt || !inviter.canInvite) {
    return { ok: false, error: "Bạn không có quyền mời thành viên mới" };
  }

  const { email } = parsed.data;

  try {
    const [maxMembers, activeCount, existing] = await Promise.all([
      resolveSetting("MAX_MEMBERS", new Date()),
      db.allowedUser.count({ where: { revokedAt: null } }),
      db.allowedUser.findUnique({ where: { email } }),
    ]);

    if (existing && !existing.revokedAt) {
      return { ok: false, error: "Email này đã được mời rồi" };
    }

    if (activeCount >= Number(maxMembers)) {
      return { ok: false, error: "Đã đạt giới hạn số thành viên" };
    }

    if (existing) {
      await db.allowedUser.update({
        where: { email: existing.email },
        data: { revokedAt: null, invitedBy: session.user.email },
      });
    } else {
      await db.allowedUser.create({
        data: { email, canInvite: false, invitedBy: session.user.email },
      });
    }

    revalidatePath("/settings/members");
    return { ok: true, data: { email } };
  } catch (err) {
    logger.error({ err, email }, "inviteMember failed");
    throw err;
  }
}
