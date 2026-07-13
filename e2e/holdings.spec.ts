import { expect, test } from "@playwright/test";

import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";

test.afterAll(async () => {
  await disconnectTestDb();
});

test("nhập vị thế ban đầu, ghi giao dịch mua/bán, tính giá vốn bình quân", async ({
  browser,
}) => {
  const sessionA = await createTestSession("holdings-a");
  const context = await browser.newContext();
  await signInAs(context, sessionA.sessionToken);
  const page = await context.newPage();

  try {
    // Empty state
    await page.goto("/holdings");
    await expect(page.getByText("Chưa có vị thế nào")).toBeVisible();

    // Nhập vị thế ban đầu: 100 FPT @ 100k
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill("FPT");
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('[data-testid="pricePerUnit"]').fill("100000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "FPT" })).toBeVisible();
    await expect(page.getByText("100 cổ phần", { exact: true })).toBeVisible();

    const holdingUrl = page.url();

    // Xuất hiện trong danh sách vị thế mở
    await page.goto("/holdings");
    await expect(page.getByRole("link", { name: /FPT/ })).toBeVisible();

    // Mua thêm 100 @ 120k -> giá vốn bình quân recompute thành 110k
    await page.goto(`${holdingUrl}/transactions/new`);
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('[data-testid="pricePerUnit"]').fill("120000");
    await page.getByRole("button", { name: "Ghi nhận giao dịch mua" }).click();
    await page.waitForURL(holdingUrl);
    await expect(page.getByText("200 cổ phần", { exact: true })).toBeVisible();
    const avgCostAfterBuy = await page
      .locator("text=/Giá vốn bình quân/")
      .locator("..")
      .innerText();
    expect(avgCostAfterBuy).toContain("110.000");

    // Bán một phần 50 @ 130k -> giá vốn bình quân giữ nguyên, SL giảm
    await page.goto(`${holdingUrl}/transactions/new`);
    await page.getByRole("button", { name: "Bán" }).click();
    await page.locator('input[name="quantity"]').fill("50");
    await page.locator('[data-testid="pricePerUnit"]').fill("130000");
    await page.getByRole("button", { name: "Ghi nhận giao dịch bán" }).click();
    await page.waitForURL(holdingUrl);
    await expect(page.getByText("150 cổ phần", { exact: true })).toBeVisible();
    const avgCostAfterSell = await page
      .locator("text=/Giá vốn bình quân/")
      .locator("..")
      .innerText();
    expect(avgCostAfterSell).toContain("110.000");

    // Bán vượt số lượng đang giữ -> bị chặn
    await page.goto(`${holdingUrl}/transactions/new`);
    await page.getByRole("button", { name: "Bán" }).click();
    await page.locator('input[name="quantity"]').fill("999");
    await page.locator('[data-testid="pricePerUnit"]').fill("130000");
    await page.getByRole("button", { name: "Ghi nhận giao dịch bán" }).click();
    await expect(page.getByText(/Bán vượt quá số lượng/)).toBeVisible();

    // Mua trùng mã đang giữ -> tự gộp vào Holding cũ, không tạo bản ghi mới
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill("FPT");
    await page.locator('input[name="quantity"]').fill("10");
    await page.locator('[data-testid="pricePerUnit"]').fill("140000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(holdingUrl);
    await expect(page.getByText("160 cổ phần", { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(sessionA.userId);
  }
});

test("bán hết về 0 ẩn khỏi danh sách vị thế mở; xóa giao dịch có ràng buộc bị chặn", async ({
  browser,
}) => {
  const sessionA = await createTestSession("holdings-close");
  const context = await browser.newContext();
  await signInAs(context, sessionA.sessionToken);
  const page = await context.newPage();

  try {
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill("VNM");
    await page.locator('input[name="quantity"]').fill("50");
    await page.locator('[data-testid="pricePerUnit"]').fill("80000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);
    const holdingUrl = page.url();

    // Bán hết toàn bộ -> SL về 0
    await page.goto(`${holdingUrl}/transactions/new`);
    await page.getByRole("button", { name: "Bán" }).click();
    await page.locator('input[name="quantity"]').fill("50");
    await page.locator('[data-testid="pricePerUnit"]').fill("90000");
    await page.getByRole("button", { name: "Ghi nhận giao dịch bán" }).click();
    await page.waitForURL(holdingUrl);
    await expect(page.getByText("0 cổ phần", { exact: true })).toBeVisible();

    // Vị thế đóng (SL=0) không còn hiện trong danh sách vị thế mở
    await page.goto("/holdings");
    await expect(page.getByRole("link", { name: /VNM/ })).toHaveCount(0);

    // Vị thế đóng xuất hiện đúng ở route "Đã đóng" (điều hướng qua segmented nav)
    await page.getByRole("link", { name: "Đã đóng" }).click();
    await page.waitForURL("/holdings/closed");
    await expect(page.getByRole("link", { name: /VNM/ })).toBeVisible();

    // Xóa BUY khi vẫn còn SELL phụ thuộc -> bị chặn
    await page.goto(holdingUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator("div.rounded-2xl.border-border")
      .filter({ hasText: "80.000" })
      .getByRole("button", { name: "Xóa" })
      .click();
    await expect(
      page.getByText(/Không thể xóa — có giao dịch bán sau đó/),
    ).toBeVisible();

    // Xóa SELL (không có giao dịch phụ thuộc) -> thành công, quay lại SL 50
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator("div.rounded-2xl.border-border")
      .filter({ hasText: "90.000" })
      .getByRole("button", { name: "Xóa" })
      .click();
    await expect(page.getByText("50 cổ phần", { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(sessionA.userId);
  }
});

test("cách ly dữ liệu giữa hai tài khoản", async ({ browser }) => {
  const sessionA = await createTestSession("isolation-a");
  const sessionB = await createTestSession("isolation-b");
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await signInAs(contextA, sessionA.sessionToken);
  await signInAs(contextB, sessionB.sessionToken);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await pageA.goto("/holdings/new");
    await pageA.getByPlaceholder("VD: FPT", { exact: true }).fill("HPG");
    await pageA.locator('input[name="quantity"]').fill("20");
    await pageA.locator('[data-testid="pricePerUnit"]').fill("25000");
    await pageA.getByRole("button", { name: "Xong", exact: true }).click();
    await pageA.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);
    const holdingUrl = pageA.url();

    // Account B không thấy danh mục của Account A
    await pageB.goto("/holdings");
    await expect(pageB.getByText("Chưa có vị thế nào")).toBeVisible();
    await pageB.goto(holdingUrl);
    await expect(pageB.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
    await cleanupTestUser(sessionA.userId);
    await cleanupTestUser(sessionB.userId);
  }
});
