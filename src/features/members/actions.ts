"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { resolveSetting, SETTING_KEYS } from "@/lib/settings";

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

  const session = await getSession();
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
    const maxMembers = await resolveSetting(
      SETTING_KEYS.MAX_MEMBERS,
      new Date(),
    );

    const result = await db.$transaction(
      async (tx) => {
        const [activeCount, existing] = await Promise.all([
          tx.allowedUser.count({ where: { revokedAt: null } }),
          tx.allowedUser.findUnique({ where: { email } }),
        ]);

        if (existing && !existing.revokedAt) {
          return { ok: false as const, error: "Email này đã được mời rồi" };
        }

        if (activeCount >= Number(maxMembers)) {
          return { ok: false as const, error: "Đã đạt giới hạn số thành viên" };
        }

        if (existing) {
          await tx.allowedUser.update({
            where: { email: existing.email },
            data: { revokedAt: null, invitedBy: session.user.email },
          });
        } else {
          await tx.allowedUser.create({
            data: { email, canInvite: false, invitedBy: session.user.email },
          });
        }

        return { ok: true as const };
      },
      // Serializable — hai lời mời đồng thời không được cùng đọc activeCount
      // cũ rồi cùng vượt MAX_MEMBERS; giao dịch thua sẽ bị lỗi P2034, xử lý ở catch.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    revalidatePath(ROUTES.members);
    return { ok: true, data: { email } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2034")
    ) {
      logger.warn({ email }, "inviteMember race, ask to retry");
      return {
        ok: false,
        error: "Có thao tác mời đang xử lý đồng thời, vui lòng thử lại",
      };
    }
    logger.error({ err, email }, "inviteMember failed");
    throw err;
  }
}
