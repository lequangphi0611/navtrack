import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { DashboardPage } from "../pages/dashboard-page";
import { daysAgo } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// Phase 6, mục 9 phase-6.md (mockup 6a/6b/6c) — biểu đồ NAV theo thời gian
// (NavTrendChart), đọc THUẦN từ Snapshot{holdingId: null, frozen: true} đã
// đóng băng + nối thêm 1 điểm "hôm nay" động (getNavTrend(),
// features/snapshots/queries.ts) — không tạo/tính lại snapshot. `points.length
// < 2` là biến thể "chưa vẽ được đường" (6b); test dưới verify đúng NGƯỠNG
// chuyển nhánh (1 điểm vs 2 điểm) bằng dữ liệu Snapshot thật, không phải suy
// diễn từ đọc code (logic thuần build points đã có unit test riêng).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("danh mục mới chưa có snapshot đã chốt -> chỉ 1 điểm 'hôm nay' động, hiện biến thể 'chưa vẽ được đường NAV'", async ({
  browser,
}) => {
  const session = await createTestSession("nav-trend-empty");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(dashboardPage.navTrendChartHeading).toBeVisible();
    await expect(dashboardPage.navTrendEmptyState).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("có 1 mốc Snapshot tổng danh mục đã đóng băng trong năm nay -> đủ 2 điểm (mốc đó + hôm nay động), vẽ được đường NAV", async ({
  browser,
}) => {
  const session = await createTestSession("nav-trend-with-points");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // Snapshot tổng danh mục (holdingId: null) đã đóng băng ở quá khứ, trong
    // phạm vi 365 ngày (kỳ "Năm" — mặc định đang chọn khi mở NavTrendChart,
    // xem useState("YEAR") trong NavTrendChart.tsx). getNavTrend() tự nối
    // thêm điểm "hôm nay" động (NAV sống hiện tại) — không cần snapshot thứ 2.
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: null,
        date: daysAgo(30),
        value: "5000000",
        source: "MANUAL",
        period: "MANUAL",
        frozen: true,
      },
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(dashboardPage.navTrendChartHeading).toBeVisible();
    await expect(dashboardPage.navTrendEmptyState).toHaveCount(0);
    await expect(dashboardPage.navTrendPointerHint).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
