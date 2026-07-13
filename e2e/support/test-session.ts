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

// Ghi thẳng qua Prisma (bypass UI) — tạo `count` giao dịch BUY hợp lệ cho
// holdingId, ngày khác nhau (tăng dần) để có thứ tự ổn định trong lịch sử.
// Dùng để test cursor pagination lịch sử giao dịch mà không cần submit
// hàng chục form qua UI (chậm, không cần thiết cho việc test riêng phần
// phân trang).
export async function seedCashflows(
  holdingId: string,
  count: number,
): Promise<void> {
  const baseDate = new Date("2024-01-01T00:00:00.000Z");
  const dayMs = 24 * 60 * 60 * 1000;

  await db.cashflow.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      holdingId,
      type: "BUY" as const,
      date: new Date(baseDate.getTime() + i * dayMs),
      quantity: "1",
      pricePerUnit: "10000",
      amount: "-10000",
      feeAmount: "0",
      taxAmount: "0",
      note: `seed-${i}`,
    })),
  });
}

export async function cleanupTestUser(userId: string) {
  // Cascade xóa Holding/Cashflow/Session qua onDelete: Cascade trong schema.
  await db.user.delete({ where: { id: userId } }).catch(() => {});
}

export async function disconnectTestDb() {
  await db.$disconnect();
}
