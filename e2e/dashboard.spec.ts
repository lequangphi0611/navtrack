import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { daysAgo, isoDate } from "./support/dates";
import { fillDatePicker } from "./support/date-picker";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";
import { stripQuery } from "./support/urls";

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
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="pricePerUnit"]').fill("100000");
    await fillDatePicker(page, "date", buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    // Redirect gắn thêm ?cashflowId=<id> (issue #37, lib/routes.ts::holdingDetailAfterTransaction).
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );

    await page.goto("/");

    // NAV = 100 * 150.000 = 15.000.000. Lên 2 cấp (không phải 1) vì commit
    // 13146d6 bọc label vào 1 row riêng chung với pill "Lịch sử" — số NAV giờ
    // là sibling của row đó, không còn là con trực tiếp.
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("15.000.000");

    // XIRR tính được — không rơi vào "Chưa tính được" (docs/domain/05: có ít
    // nhất 1 dòng tiền âm (mua) + 1 dòng tiền dương (NAV giả định tại mốc)).
    await expect(page.getByText("Chưa tính được")).toHaveCount(0);
    // Nhãn "XIRR" trơn (PortfolioStatsRow.tsx) — cố ý đổi thành "XIRR (sau
    // thuế)" ở Phase 5 (process/phase-5.md mục "Cấu trúc lại ReturnMetrics/
    // card lãi-lỗ trên Dashboard", process/DECISION.md 2026-07-18): hàng 2 cột
    // Dashboard-only ghép "XIRR (sau thuế)" + "Vốn đã bỏ ra mua", thay hẳn
    // ReturnMetrics 2 cột XIRR+PnL cũ. Cùng cấp cha-con trực tiếp (label +
    // value là 2 con của cùng 1 div, xem PortfolioStatsRow.tsx) — chỉ cần lên
    // 1 cấp, không phải 2 như trước.
    const xirrCard = page
      .getByText("XIRR (sau thuế)", { exact: true })
      .locator("..");
    await expect(xirrCard).toContainText("%");

    // Lãi/lỗ tuyệt đối dương = NAV - vốn đã bỏ vào = 15tr - 10tr = 5.000.000.
    // Nhãn "Lãi/lỗ tuyệt đối" (ReturnMetrics cũ) đổi thành "Lãi/lỗ (thực nhận)"
    // ở Phase 5 (process/phase-5.md: "nhãn 'Lãi/lỗ (thực nhận)'... vì đã trừ
    // cả phí, không chỉ thuế", process/DECISION.md 2026-07-18) — card riêng
    // full-width mới (PnlCostDragCard.tsx) thay nửa PnL của ReturnMetrics cũ.
    // Cấu trúc: label -> div cha (.p-4.5) -> root card (2 cấp, xem
    // PnlCostDragCard.tsx) chứa cả pnlValue span, khác 1 cấp của XIRR ở trên.
    await expect(
      page
        .getByText("Lãi/lỗ (thực nhận)", { exact: true })
        .locator("..")
        .locator(".."),
    ).toContainText("5.000.000");

    // priceFreshnessNote (mốc giá tự động gần nhất).
    await expect(page.getByText(/Giá tự động cập nhật EOD/)).toBeVisible();
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
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="pricePerUnit"]').fill("100000");
    await fillDatePicker(page, "date", buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    // Redirect gắn thêm ?cashflowId=<id> (issue #37, lib/routes.ts::holdingDetailAfterTransaction).
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );

    await page.goto("/");

    const navDeltaRow = page
      .getByText("so với vốn đã bỏ vào", { exact: true })
      .locator("..");
    const navDeltaAmount = navDeltaRow.locator("span").first();
    const navDeltaIcon = navDeltaRow.locator("svg");

    // Số âm — "-5.000.000" (formatMoney dùng dấu trừ ASCII cho số âm, đã tự
    // verify ở formatMoney test "số âm vẫn format đúng dấu").
    await expect(navDeltaAmount).toContainText("-5.000.000");

    // Đúng màu lỗ, KHÔNG lẫn màu lãi.
    await expect(navDeltaAmount).toHaveClass(/text-destructive/);
    await expect(navDeltaAmount).not.toHaveClass(/text-gain/);
    await expect(navDeltaIcon).toHaveClass(/text-destructive/);
    await expect(navDeltaIcon).not.toHaveClass(/text-gain/);
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
    for (const symbol of [symbolA, symbolB]) {
      await page.goto("/holdings/new");
      await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
      await page.locator('input[name="quantity"]').fill("10");
      await page.locator('input[name="pricePerUnit"]').fill("50000");
      await page.getByRole("button", { name: "Xong", exact: true }).click();
      await page.waitForURL(
        /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
      );
    }

    await page.goto("/");

    await page.getByRole("button", { name: "Mở menu nhanh" }).click();
    await page.getByRole("button", { name: "Mua / Bán", exact: true }).click();

    // Scope vào đúng Sheet (role="dialog", @base-ui/react/dialog) — 2 Holding
    // vừa tạo CHƯA có PriceQuote nên cũng xuất hiện ở MissingPriceList trên
    // chính Dashboard phía sau Sheet; không scope sẽ đụng "strict mode
    // violation" (2 phần tử cùng khớp text mã).
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Chọn mã giao dịch")).toBeVisible();
    await expect(sheet.getByText(symbolA, { exact: true })).toBeVisible();
    await expect(sheet.getByText(symbolB, { exact: true })).toBeVisible();

    // Lọc client-side theo symbol A — symbol B phải biến mất khỏi danh sách,
    // không round-trip server (không có network request nào cần chờ).
    await sheet.getByPlaceholder("Tìm mã…").fill(symbolA);
    await expect(sheet.getByText(symbolA, { exact: true })).toBeVisible();
    await expect(sheet.getByText(symbolB, { exact: true })).toHaveCount(0);

    // Chọn đúng mã A -> điều hướng thẳng ROUTES.newTransaction(holdingId) của
    // ĐÚNG mã A, không phải /holdings (danh sách) hay mã B.
    await sheet.getByText(symbolA, { exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+\/transactions\/new$/);
    // TransactionForm hiện "{symbol} · {quantity} đang giữ" trong cùng 1 div
    // (name null -> fallback symbol) — không dùng `exact: true` vì text node
    // của symbol không tách riêng khỏi span con liền kề.
    await expect(page.getByText(new RegExp(symbolA))).toBeVisible();

    const transactionFormUrl = stripQuery(page.url());
    expect(transactionFormUrl).toContain("/transactions/new");
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
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("10");
    await page.locator('input[name="pricePerUnit"]').fill("50000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Mở menu nhanh" }).click();
    await page.getByRole("button", { name: "Mua / Bán", exact: true }).click();

    await page.getByPlaceholder("Tìm mã…").fill("KHONGTONTAIXYZ");
    await expect(page.getByText("Không tìm thấy mã phù hợp.")).toBeVisible();
    await expect(page.getByText("Chưa có vị thế nào đang mở.")).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
