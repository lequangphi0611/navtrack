import { expect, test } from "@playwright/test";

import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  seedCashflows,
  signInAs,
} from "./support/test-session";

test.afterAll(async () => {
  await disconnectTestDb();
});

test("lịch sử giao dịch phân trang — 'Xem thêm' tải hết dòng còn lại", async ({
  browser,
}) => {
  const sessionA = await createTestSession("cashflow-pagination");
  const context = await browser.newContext();
  await signInAs(context, sessionA.sessionToken);
  const page = await context.newPage();

  try {
    // Tạo holding + 1 giao dịch mua qua UI, seed thêm 24 giao dịch trực tiếp
    // qua Prisma (bypass UI, xem seedCashflows) -> tổng 25 giao dịch.
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill("PAG");
    await page.locator('input[name="quantity"]').fill("1");
    await page.locator('input[name="pricePerUnit"]').fill("10000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);
    const holdingUrl = page.url();

    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    await seedCashflows(holdingId, 24);

    // Trang đầu -> đúng 20 dòng lịch sử + nút "Xem thêm" hiển thị.
    await page.goto(holdingUrl);
    await expect(page.getByRole("link", { name: "Sửa" })).toHaveCount(20);
    const loadMoreButton = page.getByRole("button", { name: "Xem thêm" });
    await expect(loadMoreButton).toBeVisible();

    // Bấm "Xem thêm" -> đủ 25 dòng, nút biến mất (đã hết trang).
    await loadMoreButton.click();
    await expect(page.getByRole("link", { name: "Sửa" })).toHaveCount(25);
    await expect(loadMoreButton).not.toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(sessionA.userId);
  }
});
