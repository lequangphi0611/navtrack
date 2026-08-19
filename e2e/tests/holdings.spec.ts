import { expect, test } from "@playwright/test";

import { HoldingsPage } from "../pages/holdings-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { daysAgo, isoDate } from "../support/dates";
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

    // Tới chi tiết vị thế đã đóng để thao tác xóa giao dịch — qua đúng UI:
    // bấm dòng vị thế mở ClosedPositionSheet, rồi bấm link "Sửa / xoá giao
    // dịch đã ghi" trong sheet (code review #1, PR #81).
    await holdingsPage.openClosedHolding("VNM", detail.url);

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

test("đổi mã qua HoldingSwitcher trong form giao dịch reset toàn bộ field, không ghi nhầm giao dịch sang mã cũ", async ({
  browser,
}) => {
  // Test này dựng 2 vị thế + đi qua 1 vòng switcher đầy đủ (nhiều điều hướng
  // hơn 2 test còn lại trong file) — nới ngân sách thời gian (test.slow() ->
  // x3 timeout, API chuẩn của Playwright) làm biên an toàn chung cho cả test,
  // KHÔNG phải cách sửa bug ở bước submit cuối (xem GOTCHAS #23 — bug đó nới
  // timeout không giải quyết được, phải đổi cơ chế wait).
  test.slow();

  const sessionA = await createTestSession("holdings-switcher");
  const context = await browser.newContext();
  await signInAs(context, sessionA.sessionToken);
  const page = await context.newPage();

  try {
    const holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();

    // Dựng 2 vị thế đang mở: mã A (100 CP) và mã B (50 CP). Test này chỉ quan
    // tâm hành vi HoldingSwitcher trong TransactionForm, không phải flow điều
    // hướng dẫn tới bước dựng data -> vào thẳng NewHoldingPage lần 2 qua
    // goto() thay vì goBack() + goToNewHolding() (rule mục 4, case 3 "test
    // không quan tâm flow dẫn tới nó"), giữ test đủ nhanh trong ngân sách
    // 60s/test (nhiều bước điều hướng hơn 2 test còn lại trong file).
    const newHoldingPageA = await holdingsPage.goToNewHolding();
    const detailA = await newHoldingPageA.create({
      symbol: "AAA",
      quantity: 100,
      pricePerUnit: 50_000,
    });

    const newHoldingPageB = new NewHoldingPage(page);
    await newHoldingPageB.goto();
    const detailB = await newHoldingPageB.create({
      symbol: "BBB",
      quantity: 50,
      pricePerUnit: 80_000,
    });

    // Mở form "Thêm giao dịch" của mã A, chuyển sang Bán, điền số lượng/giá —
    // CHƯA submit (issue #138: field này phải mất đi khi đổi mã, không được
    // rơi rớt sang mã khác). Cùng lý do trên: goto() thẳng URL đã biết của A
    // thay vì đi lại qua danh sách vị thế.
    await detailA.goto();
    const form = await detailA.goToNewTransaction();
    await form.toggleSell();
    await form.fillQuantity(30);
    await form.fillPricePerUnit(60_000);

    // Bấm "Đổi mã" -> mở Sheet -> chọn mã B.
    await form.switcher.open();
    await expect(form.switcher.title).toBeVisible();
    const formB = await form.switcher.selectHoldingForTransaction("BBB");

    // Đã điều hướng đúng sang route giao dịch của mã B (không phải mã A hay
    // mã thứ ba nào khác).
    await expect(page).toHaveURL(`${detailB.url}/transactions/new`);

    // Field số lượng/giá đã rỗng lại — KHÔNG còn 30/60.000 vừa gõ cho mã A
    // (React remount qua key={holdingId}, xem NewTransactionFormSection.tsx).
    await expect(formB.quantityInput).toHaveValue("");
    await expect(formB.priceInput).toHaveValue("");
    // Chế độ đã quay về Mua — không còn kẹt ở Bán của mã A.
    await expect(formB.submitBuyButton).toBeVisible();

    // Submit một giao dịch MUA hợp lệ cho mã B — fill/click tay thay vì
    // formB.submitBuy() (vốn waitForURL(waitUntil: "load") mặc định): đây đã
    // là soft-nav (router.push, App Router) thứ 3 liên tiếp trong cùng test
    // (create B, đổi mã qua switcher, rồi submit này) và quan sát thực tế
    // (2 lần chạy, page snapshot lúc timeout) cho thấy app ĐÃ điều hướng và
    // render đúng kết quả cuối, chỉ riêng waitForURL không bao giờ resolve ở
    // vị trí thứ 3 này — nghi ngờ hạn chế của Playwright/CDP với soft-nav dồn
    // dập trong môi trường này, không phải bug domain. Assertion nội dung tự
    // auto-retry (không phụ thuộc lifecycle "load") nên né được, timeout nới
    // riêng cho bước này vì có thể mất hơn 5s mặc định của expect().
    await formB.fillQuantity(20);
    await formB.fillPricePerUnit(90_000);
    await formB.submitBuyButton.click();
    await expect(detailB.quantityText).toHaveText("70 cổ phần", {
      timeout: 45_000,
    });

    // Mã A KHÔNG bị ghi nhầm giao dịch nào trong lúc thao tác trên switcher —
    // vẫn đúng 100 CP như lúc tạo, chưa từng submit gì trên form của A.
    await detailA.goto();
    await expect(detailA.quantityText).toHaveText("100 cổ phần");
  } finally {
    await closeContext(context);
    await cleanupTestUser(sessionA.userId);
  }
});

test("nhánh NEW_PURCHASE: phí tự tính vào avgCost, chặn trùng mã, chặn ngày tương lai", async ({
  browser,
}) => {
  // issue #142 — 3 hành vi MỚI của nhánh "Vừa mua hôm nay" (NEW_PURCHASE),
  // khác hẳn nhánh "Đã có từ trước" (EXISTING, mặc định) đã cover ở test đầu
  // file: (1) card "Phí giao dịch" tự tính TRANSACTION_FEE_BUY_STOCK thật vào
  // avgCost thay vì hardcode "0" như trước #142, (2) trùng mã BỊ CHẶN (khác
  // EXISTING tự gộp im lặng), (3) chặn ngày tương lai.
  const session = await createTestSession("holdings-new-purchase");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const holdingsPage = new HoldingsPage(page);
    await holdingsPage.goto();

    // --- 1. NEW_PURCHASE có phí -> avgCost = (SL×giá+phí)/SL ---
    // 100 CP @ 100.000 = gross 10.000.000; phí mua STOCK baseline 0,3%
    // (TRANSACTION_FEE_BUY_STOCK, seed sẵn `pnpm db:seed`) = 30.000 -> avgCost
    // = (10.000.000 + 30.000) / 100 = 100.300. Nếu card phí bị revert về
    // hardcode "0" (hành vi CŨ trước #142), avgCost sẽ ra đúng 100.000
    // ("100k") thay vì 100.300 ("100,3k") -> assertion dưới bắt được ngay.
    let newHoldingPage = await holdingsPage.goToNewHolding();
    await newHoldingPage.selectSource("NEW_PURCHASE");
    // Card phí đã tự điền theo giá trị vừa fill (không cần sửa tay) — chỉ xác
    // nhận số tự tính đúng TRƯỚC khi submit, tránh test giả (không chạm phần
    // vừa sửa) nếu card không thật sự tính từ Setting.
    const detail = await newHoldingPage.create({
      symbol: "NEWBUY",
      quantity: 100,
      pricePerUnit: 100_000,
    });
    await expect(detail.heading("NEWBUY")).toBeVisible();
    await expect(detail.avgCost).toContainText("100,3k");

    // --- 2. Trùng mã ở nhánh NEW_PURCHASE -> DuplicateHoldingAlert, KHÔNG tự
    // gộp im lặng như nhánh EXISTING (test đầu file) ---
    const holdingsPage2 = await detail.goBack();
    newHoldingPage = await holdingsPage2.goToNewHolding();
    await newHoldingPage.selectSource("NEW_PURCHASE");
    await newHoldingPage.submitExpectingFailure({
      symbol: "NEWBUY",
      quantity: 20,
      pricePerUnit: 105_000,
    });
    await expect(newHoldingPage.duplicateAlertHeading("NEWBUY")).toBeVisible();
    // Số liệu vị thế đang giữ hiển thị đúng — 100 cổ phần, giá vốn 100.300
    // (đã tính phí ở bước 1), KHÔNG phải giá vừa gõ (20/105.000).
    await expect(newHoldingPage.duplicateAlertDetail).toContainText(
      "100 cổ phần",
    );
    await expect(newHoldingPage.duplicateAlertDetail).toContainText("100.300");
    // Bấm link -> chuyển đúng sang route ghi giao dịch mua thêm của Holding
    // NEWBUY đã có (không tạo bản ghi mới nào).
    await newHoldingPage.goToExistingTransactionFromDuplicate("NEWBUY");
    await expect(page).toHaveURL(`${detail.url}/transactions/new`);

    // --- 3. Ngày tương lai ở nhánh NEW_PURCHASE -> validate lỗi, không tạo
    // được vị thế mới (khác EXISTING/mọi form khác — cố ý, xem
    // newHoldingSchema.refine) ---
    const holdingsPage3 = new HoldingsPage(page);
    await holdingsPage3.goto();
    newHoldingPage = await holdingsPage3.goToNewHolding();
    await newHoldingPage.selectSource("NEW_PURCHASE");
    await newHoldingPage.submitExpectingFailure({
      symbol: "FUTBUY",
      quantity: 10,
      pricePerUnit: 50_000,
      date: isoDate(daysAgo(-5)), // 5 ngày SAU hôm nay
    });
    await expect(newHoldingPage.validationErrorAlert).toBeVisible();
    // Vẫn ở /holdings/new (KHÔNG router.push khi submit thất bại).
    await expect(page).toHaveURL(newHoldingPage.url);

    // Xác nhận không có Holding FUTBUY nào được tạo lọt qua validate.
    const holdingsPageFinal = new HoldingsPage(page);
    await holdingsPageFinal.goto();
    await expect(holdingsPageFinal.holdingLink("FUTBUY")).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
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
