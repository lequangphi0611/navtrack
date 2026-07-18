import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import type { BrowserContext } from "@playwright/test";

const db = new PrismaClient();

// Tạo một tài khoản test riêng biệt (email random) + Session hợp lệ trong DB, rồi
// gắn cookie session vào context — bỏ qua luồng OAuth thật của Google cho mục đích e2e.
export async function createTestSession(namePrefix: string) {
  const email = `${namePrefix}-${randomUUID()}@e2e.test`;

  await db.allowedUser.create({
    data: { email, canInvite: false, invitedBy: null },
  });
  const user = await db.user.create({ data: { email, name: namePrefix } });

  const sessionToken = randomUUID();
  await db.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  return { email, userId: user.id, sessionToken };
}

export async function signInAs(context: BrowserContext, sessionToken: string) {
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function cleanupTestUser(userId: string) {
  // Cascade xóa Holding/Cashflow/Session qua onDelete: Cascade trong schema.
  await db.user.delete({ where: { id: userId } }).catch(() => {});
}

// Khi test bị Playwright timeout, context/browser đã bị kill TRƯỚC khi lỗi
// được ném ra — context.close() gọi sau đó tự throw "Target page, context or
// browser has been closed". Nếu đây là dòng đầu trong `finally`, lỗi đó chặn
// luôn các bước dọn dẹp phía sau (cleanupTestUser, xoá PriceQuote đã seed...)
// không bao giờ chạy, làm leak dữ liệu test. Luôn nuốt lỗi ở đây, không nuốt
// ở các bước dọn dẹp khác — để lỗi thật của chúng (nếu có) vẫn lộ ra.
export async function closeContext(context: BrowserContext) {
  await context.close().catch(() => {});
}

export async function disconnectTestDb() {
  await db.$disconnect();
}
