import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { DashboardPage } from "../pages/dashboard-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { daysAgo, isoDate } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// PriceQuote không có UI ghi (chỉ job Python ghi được, xem
// jobs/price-fetcher/**) — seed trực tiếp qua Prisma trong spec, cùng cách
// test-session.ts đã seed Session. Dùng PrismaClient riêng (không export từ
// test-session.ts) vì dùng ở nhiều file spec (dashboard, nav-override).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("Dashboard hiển thị đúng NAV/XIRR/lãi-lỗ khi vị thế có giá tự động", async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-nav");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  // Mã ngẫu nhiên riêng cho lần chạy này — PriceQuote KHÔNG scoped theo user
  // (bảng dùng chung toàn app, xem docs/rules/schema.md), nên không dùng mã cố
  // định kiểu "FPT" (tránh đụng dữ liệu PriceQuote có sẵn từ lần verify thủ
  // công khác của database dev/test dùng chung — sẽ làm NAV/giá lệch giả
  // định của assertion bên dưới).
  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Seed PriceQuote TRƯỚC KHI tạo Holding (thứ tự quan trọng — đã tự verify
    // bug thật khi làm ngược lại): getLatestPriceQuotes (lib/valuation.ts) bọc
    // unstable_cache theo (symbol, cutoffDateIso), revalidate 1 giờ. Tạo
    // Holding qua UI xong, NewHoldingForm router.push sang /holdings/[id] —
    // getHoldingDetail() ở đó GỌI NGAY valuateHoldings() cho symbol này (dù
    // page.tsx chưa render kết quả ra UI). Nếu PriceQuote chưa tồn tại lúc đó,
    // cache sẽ ghim "không có giá" cho symbol này tới 1 giờ, khiến Dashboard
    // sau đó (dù đã seed PriceQuote) vẫn đọc phải kết quả cũ đã cache = thiếu
    // giá. Seed trước loại bỏ hẳn cửa sổ đua tranh này.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "150000", source: "vnstock" },
      update: { price: "150000", source: "vnstock" },
    });

    // Mua 100 <symbol> @ 100.000 cách đây ~2 năm — đủ xa "hôm nay" để dòng
    // tiền giả định NAV (ghép ở cutoffDate) không quá sát ngày mua, tránh ca
    // biên "kỳ rất ngắn" khiến Newton-Raphson khó hội tụ (docs/domain/05).
    const buyDate = isoDate(daysAgo(730));
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol,
      quantity: 100,
      pricePerUnit: 100_000,
      date: buyDate,
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // NAV = 100 * 150.000 = 15.000.000.
    await expect(dashboardPage.navValueBlock).toContainText("15.000.000");

    // XIRR tính được — không rơi vào "Chưa tính được" (docs/domain/05: có ít
    // nhất 1 dòng tiền âm (mua) + 1 dòng tiền dương (NAV giả định tại mốc)).
    await expect(dashboardPage.noXirrState).toHaveCount(0);
    await expect(dashboardPage.xirrCard).toContainText("%");

    // Lãi/lỗ tuyệt đối dương = NAV - vốn đã bỏ vào = 15tr - 10tr = 5.000.000.
    await expect(dashboardPage.pnlCard).toContainText("5.000.000");

    // priceFreshnessNote (mốc giá tự động gần nhất).
    await expect(dashboardPage.autoPriceFreshnessNote).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    // Dọn PriceQuote đã seed — bảng dùng chung, không cascade theo User.
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Bug #27: khối chênh lệch NAV hardcode ArrowUp + text-gain bất kể lãi/lỗ —
// vị thế mua giá cao, giá EOD thấp hơn hẳn (NAV < vốn đã bỏ vào) phải hiện
// mũi tên xuống + màu text-destructive, KHÔNG được lẫn text-gain.
test("Dashboard hiển thị đúng màu/mũi tên khi NAV lỗ so với vốn", async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-nav-loss");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Seed PriceQuote TRƯỚC Holding (xem lý do chi tiết ở test phía trên) —
    // giá EOD 50.000, thấp hơn nhiều giá mua 100.000 để NAV chắc chắn lỗ.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "50000", source: "vnstock" },
      update: { price: "50000", source: "vnstock" },
    });

    // Mua 100 <symbol> @ 100.000 -> vốn 10.000.000, NAV = 100 * 50.000 =
    // 5.000.000 -> lỗ 5.000.000 (-50%).
    const buyDate = isoDate(daysAgo(730));
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol,
      quantity: 100,
      pricePerUnit: 100_000,
      date: buyDate,
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // Số âm — "-5.000.000" (formatMoney dùng dấu trừ ASCII cho số âm, đã tự
    // verify ở formatMoney test "số âm vẫn format đúng dấu").
    await expect(dashboardPage.navDeltaAmount).toContainText("-5.000.000");

    // Đúng màu lỗ, KHÔNG lẫn màu lãi.
    await expect(dashboardPage.navDeltaAmount).toHaveClass(/text-destructive/);
    await expect(dashboardPage.navDeltaAmount).not.toHaveClass(/text-gain/);
    await expect(dashboardPage.navDeltaIcon).toHaveClass(/text-destructive/);
    await expect(dashboardPage.navDeltaIcon).not.toHaveClass(/text-gain/);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Issue #54: FAB "Mua / Bán" mở TransactionHoldingPicker (Sheet) thay vì trỏ
// thẳng /holdings — chọn đúng mã trong picker phải điều hướng thẳng
// ROUTES.newTransaction(holdingId) của mã đó, không phải trang danh sách.
test('FAB "Mua / Bán" mở picker chọn mã, chọn xong vào thẳng màn giao dịch của đúng mã', async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-quick-menu-trade");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolA = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolB = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    // Tạo 2 Holding đang mở — picker phải liệt kê cả 2, và filter phải thu
    // hẹp đúng theo mã gõ vào (client-side, không phải server round-trip).
    const newHoldingPage = new NewHoldingPage(page);
    for (const symbol of [symbolA, symbolB]) {
      await newHoldingPage.goto();
      await newHoldingPage.create({
        symbol,
        quantity: 10,
        pricePerUnit: 50_000,
      });
    }

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    const picker = await dashboardPage.openTradePicker();

    // Scope vào đúng Sheet (role="dialog", @base-ui/react/dialog) — 2 Holding
    // vừa tạo CHƯA có PriceQuote nên cũng xuất hiện ở MissingPriceList trên
    // chính Dashboard phía sau Sheet; TransactionHoldingPicker đã tự scope
    // locator theo dialog để tránh "strict mode violation".
    await expect(picker.title).toBeVisible();
    await expect(picker.holdingEntry(symbolA)).toBeVisible();
    await expect(picker.holdingEntry(symbolB)).toBeVisible();

    // Lọc client-side theo symbol A — symbol B phải biến mất khỏi danh sách,
    // không round-trip server (không có network request nào cần chờ).
    await picker.search(symbolA);
    await expect(picker.holdingEntry(symbolA)).toBeVisible();
    await expect(picker.holdingEntry(symbolB)).toHaveCount(0);

    // Chọn đúng mã A -> điều hướng thẳng ROUTES.newTransaction(holdingId) của
    // ĐÚNG mã A, không phải /holdings (danh sách) hay mã B.
    const form = await picker.selectHolding(symbolA);
    await expect(form.holdingSummary(symbolA)).toBeVisible();
    expect(page.url()).toContain("/transactions/new");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Không có mã nào tìm thấy -> hiện no-match state, KHÔNG hiện empty state
// "Chưa có vị thế nào đang mở" (2 nhánh khác nhau trong
// TransactionHoldingPicker.tsx — dễ lẫn nếu chỉ check `holdings.length === 0`
// mà quên tách theo kết quả filter).
test('Picker "Mua / Bán": gõ mã không tồn tại hiện đúng no-match state', async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-quick-menu-no-match");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol,
      quantity: 10,
      pricePerUnit: 50_000,
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    const picker = await dashboardPage.openTradePicker();

    await picker.search("KHONGTONTAIXYZ");
    await expect(picker.noMatchState).toBeVisible();
    await expect(picker.emptyState).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// process/decisions/architecture-and-code-quality.md 2026-08-20 — route
// fan-in: /holdings/[id]/transactions/new có 2 lối vào (nút "Thêm giao dịch"
// ở HoldingDetailScreen, và FAB "Mua / Bán" trên Dashboard qua picker này).
// Trước fix, "Đóng" luôn trỏ về CHÍNH holding đó — đúng ở lối vào thứ nhất,
// SAI ở lối vào thứ hai (user chưa từng ghé HoldingDetailScreen).
test('FAB "Mua / Bán": "Đóng" trên màn giao dịch quay lại Dashboard, không phải trang chi tiết vị thế', async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-quick-menu-trade-close");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol,
      quantity: 10,
      pricePerUnit: 50_000,
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    const picker = await dashboardPage.openTradePicker();
    const form = await picker.selectHolding(symbol);

    // KHÔNG dùng TransactionForm.close() ở đây — hàm đó chờ redirect về
    // holdingUrl (đúng cho lối vào "Thêm giao dịch"), sai cho lối vào FAB này.
    await expect(form.closeLink).toBeVisible();
    await form.closeLink.click();
    await page.waitForURL("/");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Cùng bối cảnh route fan-in — FAB "Thêm vị thế" (đảo ngược từ nút "+" trên
// /holdings) phải quay lại Dashboard khi huỷ form, không phải /holdings (user
// chưa từng ghé).
test('FAB "Thêm vị thế": back trên /holdings/new quay lại Dashboard, không phải /holdings', async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-quick-menu-new-holding");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    const newHoldingPage = await dashboardPage.openNewHoldingFromQuickMenu();
    await expect(newHoldingPage.backLink).toBeVisible();
    await newHoldingPage.backLink.click();
    await expect(page).toHaveURL("/");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Regression — entry point ĐÚNG cũ (không đổi bởi route fan-in): pill "Lịch
// sử" trong NavHeroCard trỏ thẳng ROUTES.snapshots KHÔNG gắn `?fromHolding=`
// (khác TransactionSnapshotBanner.navHistoryLink, có holding nguồn). Page đích
// phải rơi vào nhánh fallback backHref = ROUTES.dashboard — nếu ai đó lỡ đổi
// fallback mặc định của /snapshots (vd sang ROUTES.holdings) thì test này bắt
// được ngay, dù không liên quan trực tiếp bugfix `from=`/`fromHolding=` đang
// verify.
test('Dashboard NavHeroCard "Lịch sử" -> /snapshots -> "Quay lại" về đúng Dashboard', async ({
  browser,
}) => {
  const session = await createTestSession("dashboard-nav-hero-snapshots");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    const snapshotPage = await dashboardPage.goToSnapshotHistory();
    await expect(page).toHaveURL(snapshotPage.url);
    await expect(snapshotPage.backLink).toBeVisible();
    await snapshotPage.backLink.click();
    await expect(page).toHaveURL("/");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
