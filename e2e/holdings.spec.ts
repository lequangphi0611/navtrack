import { expect, test } from "@playwright/test";

import { HoldingDetailPage } from "./pages/holding-detail-page";
import { HoldingsPage } from "./pages/holdings-page";
import { NewHoldingPage } from "./pages/new-holding-page";
import { TransactionForm } from "./pages/transaction-form";
import {
  cleanupTestUser,
  closeContext,
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
    const holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();
    await expect(holdingsPage.emptyState).toBeVisible();

    // Nhập vị thế ban đầu: 100 FPT @ 100k
    const holdingUrl = await new NewHoldingPage(page).create({
      symbol: "FPT",
      quantity: 100,
      pricePerUnit: 100_000,
    });
    const detail = new HoldingDetailPage(page, holdingUrl);
    await expect(detail.heading("FPT")).toBeVisible();
    await expect(detail.quantityText).toHaveText("100 cổ phần");

    // Xuất hiện trong danh sách vị thế mở
    await holdingsPage.goto();
    await expect(holdingsPage.holdingLink("FPT")).toBeVisible();

    // Mua thêm 100 @ 120k -> giá vốn bình quân recompute thành 110k
    const form = new TransactionForm(page, holdingUrl);
    await form.addBuy({ quantity: 100, pricePerUnit: 120_000 });
    await expect(detail.quantityText).toHaveText("200 cổ phần");
    await expect(detail.avgCost).toContainText("110k");

    // Bán một phần 50 @ 130k -> giá vốn bình quân giữ nguyên, SL giảm
    await form.addSell({ quantity: 50, pricePerUnit: 130_000 });
    await expect(detail.quantityText).toHaveText("150 cổ phần");
    await expect(detail.avgCost).toContainText("110k");

    // Bán vượt số lượng đang giữ -> bị chặn
    await form.submitSellExceedingQuantity({
      quantity: 999,
      pricePerUnit: 130_000,
    });
    await expect(detail.sellExceedsQuantityError).toBeVisible();

    // Mua trùng mã đang giữ -> tự gộp vào Holding cũ, không tạo bản ghi mới
    await new NewHoldingPage(page).create({
      symbol: "FPT",
      quantity: 10,
      pricePerUnit: 140_000,
    });
    await expect(detail.quantityText).toHaveText("160 cổ phần");
  } finally {
    await closeContext(context);
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
    const holdingUrl = await new NewHoldingPage(page).create({
      symbol: "VNM",
      quantity: 50,
      pricePerUnit: 80_000,
    });
    const detail = new HoldingDetailPage(page, holdingUrl);
    const form = new TransactionForm(page, holdingUrl);

    // Bán hết toàn bộ -> SL về 0
    await form.addSell({ quantity: 50, pricePerUnit: 90_000 });
    await expect(detail.quantityText).toHaveText("0 cổ phần");

    // Vị thế đóng (SL=0) không còn hiện trong danh sách vị thế mở
    const holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();
    await expect(holdingsPage.holdingLink("VNM")).toHaveCount(0);

    // Vị thế đóng xuất hiện đúng ở route "Đã đóng" (điều hướng qua segmented nav)
    await holdingsPage.openClosed();
    await expect(holdingsPage.holdingLink("VNM")).toBeVisible();

    // Xóa BUY khi vẫn còn SELL phụ thuộc -> bị chặn
    await detail.goto();
    await detail.deleteTransaction("80.000");
    await expect(detail.deleteBlockedError).toBeVisible();

    // Xóa SELL (không có giao dịch phụ thuộc) -> thành công, quay lại SL 50
    await detail.deleteTransaction("90.000");
    await expect(detail.quantityText).toHaveText("50 cổ phần");
  } finally {
    await closeContext(context);
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
    const holdingUrl = await new NewHoldingPage(pageA).create({
      symbol: "HPG",
      quantity: 20,
      pricePerUnit: 25_000,
    });

    // Account B không thấy danh mục của Account A
    const holdingsPageB = new HoldingsPage(pageB);
    await holdingsPageB.goto();
    await expect(holdingsPageB.emptyState).toBeVisible();
    await pageB.goto(holdingUrl);
    await expect(pageB.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
    await cleanupTestUser(sessionA.userId);
    await cleanupTestUser(sessionB.userId);
  }
});
