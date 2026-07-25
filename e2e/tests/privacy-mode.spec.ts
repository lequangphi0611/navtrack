import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { BottomNav } from "../pages/bottom-nav";
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

// Phase 6, mục 8/11 phase-6.md — chế độ ẩn số tiền: nút mắt bật/tắt nhanh +
// mặc định User.hideAmountsByDefault, che VND tuyệt đối, GIỮ %/XIRR. Cùng một
// trạng thái với PrivacyToggle ở /settings (process/DECISION.md 2026-07-21 (1)),
// không có tầng "override phiên" riêng — mỗi route tự đọc lại DB khi điều
// hướng/reload (PrivacyToggle.tsx), nên test này verify đúng phần KHÔNG unit
// test được: ghi Server Action thật -> DB thật -> đọc lại đúng ở 2 route khác
// nhau.
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("bật ẩn số tiền ở header Dashboard: che NAV/PnL, giữ %, lưu mặc định qua reload và đồng bộ với /settings", async ({
  browser,
}) => {
  const session = await createTestSession("privacy-mode");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Seed PriceQuote TRƯỚC Holding (dashboard.spec.ts đã tự verify bug thật
    // khi làm ngược lại — unstable_cache ghim "thiếu giá").
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "150000", source: "vnstock" },
      update: { price: "150000", source: "vnstock" },
    });

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

    // Mặc định: User mới -> hideAmountsByDefault = false -> NAV hiện số thật,
    // chưa có "••••••" nào trên trang.
    await expect(dashboardPage.navValueBlock).toContainText("15.000.000");
    await expect(dashboardPage.maskedAmounts).toHaveCount(0);

    // Bấm nút mắt -> NAV/PnL che thành "••••••", nhưng XIRR (%) KHÔNG bị ẩn
    // (docs/domain: chỉ VND tuyệt đối bị che, giữ % & XIRR).
    await dashboardPage.toggleHideAmounts();
    await expect(dashboardPage.navValueBlock).toContainText("••••••");
    await expect(dashboardPage.navValueBlock).not.toContainText("15.000.000");
    await expect(dashboardPage.xirrCard).toContainText("%");
    await expect(dashboardPage.xirrCard).not.toContainText("••••••");

    // Server Action setHideAmountsByDefault ghi NGAY (optimistic UI +
    // startTransition, không phải state client thuần) -> reload trang (mount
    // mới, state client mất) vẫn phải giữ ẩn vì đọc lại User.hideAmountsByDefault
    // từ DB.
    await page.reload();
    await expect(dashboardPage.navValueBlock).toContainText("••••••");

    // Cùng MỘT trạng thái với PrivacyToggle ở /settings — Switch phải đang bật.
    const bottomNav = new BottomNav(page);
    const settingsPage = await bottomNav.goToSettings();
    await expect(settingsPage.hideAmountsSwitch).toBeChecked();

    // Tắt lại từ /settings -> quay về Dashboard (qua BottomNav, không goto()
    // thẳng) phải thấy số tiền trở lại bình thường.
    await settingsPage.toggleHideAmounts();
    await expect(settingsPage.hideAmountsSwitch).not.toBeChecked();

    const dashboardAgain = await bottomNav.goToDashboard();
    await expect(dashboardAgain.navValueBlock).toContainText("15.000.000");
    await expect(dashboardAgain.maskedAmounts).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});
