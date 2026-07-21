"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";

// Chế độ ẩn số tiền toàn app (mục 8 phase-6.md, process/DECISION.md 2026-07-21
// mục (1)) — nút mắt header VÀ toggle "Chế độ ẩn số tiền" ở Cài đặt CÙNG gọi
// action này, ghi NGAY `User.hideAmountsByDefault` (không có tầng "override
// phiên tạm thời" riêng — 2 tầng state là thừa vì DB luôn là nguồn sự thật
// duy nhất, mỗi route tự đọc lại lúc render). Update theo ĐÚNG `userId` từ
// session — KHÔNG tin bất kỳ id nào truyền từ client.
export async function setHideAmountsByDefault(
  hidden: boolean,
): Promise<ActionResult<{ hidden: boolean }>> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { hideAmountsByDefault: hidden },
    });
  } catch (err) {
    logger.error(
      { err, userId: session.user.id },
      "setHideAmountsByDefault failed",
    );
    throw err;
  }

  // Mọi route có card tiền — nhất quán ngay khi điều hướng qua lại, không đợi
  // revalidate theo cadence mặc định (docs/rules/performance.md).
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.holdings);
  revalidatePath(ROUTES.holdingsClosed);
  revalidatePath(ROUTES.allocation);

  return { ok: true, data: { hidden } };
}
