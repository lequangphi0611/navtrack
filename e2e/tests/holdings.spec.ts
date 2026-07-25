import { expect, test } from "@playwright/test";

import { HoldingsPage } from "../pages/holdings-page";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

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
    let holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();
    await expect(holdingsPage.emptyState).toBeVisible();

    // Nhập vị thế ban đầu: 100 FPT @ 100k
    const newHoldingPage = await holdingsPage.goToNewHolding();
    let detail = await newHoldingPage.create({
      symbol: "FPT",
      quantity: 100,
      pricePerUnit: 100_000,
    });
    await expect(detail.heading("FPT")).toBeVisible();
    await expect(detail.quantityText).toHaveText("100 cổ phần");

    // Xuất hiện trong danh sách vị thế mở (quay lại danh sách qua "Quay lại")
    holdingsPage = await detail.goBack();
    await expect(holdingsPage.holdingLink("FPT")).toBeVisible();

    // Mở lại chi tiết vị thế để tiếp tục ghi giao dịch
    detail = await holdingsPage.openHolding("FPT", detail.url);

    // Mua thêm 100 @ 120k qua TransactionForm (auto-prefill phí mua
    // TRANSACTION_FEE_BUY_STOCK = 0.3%, seed sẵn bởi `pnpm db:seed` — khác
    // NewHoldingPage ở trên, không có field phí) -> giá vốn bình quân =
    // (100×100.000 + 100×120.000 + phí 36.000) / 200 = 110.180.
    let form = await detail.goToNewTransaction();
    await form.submitBuy({ quantity: 100, pricePerUnit: 120_000 });
    await expect(detail.quantityText).toHaveText("200 cổ phần");
    await expect(detail.avgCost).toContainText("110,18k");

    // Bán một phần 50 @ 130k -> giá vốn bình quân giữ nguyên (chỉ BUY đổi
    // avgCost), SL giảm
    form = await detail.goToNewTransaction();
    await form.submitSell({ quantity: 50, pricePerUnit: 130_000 });
    await expect(detail.quantityText).toHaveText("150 cổ phần");
    await expect(detail.avgCost).toContainText("110,18k");

    // Bán vượt số lượng đang giữ -> bị chặn
    form = await detail.goToNewTransaction();
    await form.submitSellExceedingQuantity({
      quantity: 999,
      pricePerUnit: 130_000,
    });
    await expect(detail.sellExceedsQuantityError).toBeVisible();

    // Đóng form, quay về danh sách, khai báo lại mã đã có -> tự gộp vào
    // Holding cũ, không tạo bản ghi mới
    detail = await form.close();
    holdingsPage = await detail.goBack();
    const newHoldingPageAgain = await holdingsPage.goToNewHolding();
    detail = await newHoldingPageAgain.create({
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
    let holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();
    const newHoldingPage = await holdingsPage.goToNewHolding();
    const detail = await newHoldingPage.create({
      symbol: "VNM",
      quantity: 50,
      pricePerUnit: 80_000,
    });

    // Bán hết toàn bộ -> SL về 0
    const form = await detail.goToNewTransaction();
    await form.submitSell({ quantity: 50, pricePerUnit: 90_000 });
    await expect(detail.quantityText).toHaveText("0 cổ phần");

    // Vị thế đóng (SL=0) không còn hiện trong danh sách vị thế mở
    holdingsPage = await detail.goBack();
    await expect(holdingsPage.holdingLink("VNM")).toHaveCount(0);

    // Vị thế đóng xuất hiện đúng ở route "Đã đóng" (điều hướng qua segmented nav)
    // — dòng vị thế đóng là <button> mở ClosedPositionSheet (phase-6), không
    // phải <Link>, xem closedHoldingButton().
    await holdingsPage.openClosed();
    await expect(holdingsPage.closedHoldingButton("VNM")).toBeVisible();

    // Tới chi tiết vị thế đã đóng để thao tác xóa giao dịch — ClosedPositionSheet
    // chỉ có "Mở lại vị thế" (tạo giao dịch mua mới), không có link nào về thẳng
    // /holdings/[id], nên điều hướng trực tiếp qua URL đã biết từ lúc tạo.
    await detail.goto();

    // Xóa BUY khi vẫn còn SELL phụ thuộc -> bị chặn
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
  // 2 tài khoản độc lập -> dựng song song bằng Promise.all (review PR #97
  // finding #8), không phải chạy tuần tự từng await riêng lẻ.
  const [sessionA, sessionB] = await Promise.all([
    createTestSession("isolation-a"),
    createTestSession("isolation-b"),
  ]);
  const [contextA, contextB] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  await Promise.all([
    signInAs(contextA, sessionA.sessionToken),
    signInAs(contextB, sessionB.sessionToken),
  ]);
  const [pageA, pageB] = await Promise.all([
    contextA.newPage(),
    contextB.newPage(),
  ]);

  try {
    const holdingsPageA = new HoldingsPage(pageA);
    await holdingsPageA.goto();
    const newHoldingPageA = await holdingsPageA.goToNewHolding();
    const detailA = await newHoldingPageA.create({
      symbol: "HPG",
      quantity: 20,
      pricePerUnit: 25_000,
    });

    // Account B không thấy danh mục của Account A
    const holdingsPageB = new HoldingsPage(pageB);
    await holdingsPageB.goto();
    await expect(holdingsPageB.emptyState).toBeVisible();

    // Truy cập thẳng URL của account A (không có link nào dẫn tới, mô phỏng
    // đoán/rò rỉ URL) -> vẫn phải bị chặn dù đi thẳng URL chứ không qua flow.
    await pageB.goto(detailA.url);
    await expect(pageB.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
    await cleanupTestUser(sessionA.userId);
    await cleanupTestUser(sessionB.userId);
  }
});
