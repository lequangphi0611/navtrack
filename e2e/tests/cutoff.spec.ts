import { expect, test } from "@playwright/test";

import { DashboardPage } from "../pages/dashboard-page";
import { SettingsPage } from "../pages/settings-page";
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

// Luồng đổi mốc chốt định giá ở Cài đặt (mockup 2e) — quan trọng nhất vì đây
// đúng luồng vừa phát hiện + fix 1 bug router Next.js thật (xem
// src/app/(dashboard)/settings/CutoffHardNavGuard.tsx): click chọn mốc chốt
// dùng <Link> soft-navigate, Route Handler /api/cutoff redirect NGƯỢC LẠI
// đúng /settings -> Next.js Client Router Cache coi "cùng segment, không đổi
// gì" nên bỏ qua re-render dù cookie/URL đã cập nhật đúng. CutoffHardNavGuard
// ép hard navigation cho các link này để tránh ca đó. Spec dưới đây PHẢI fail
// nếu guard bị gỡ/hỏng (đã tự verify thủ công, xem báo cáo cuối task).
test("đổi mốc chốt ở Cài đặt lan đúng sang Dashboard (không bị kẹt UI cũ)", async ({
  browser,
}) => {
  const session = await createTestSession("cutoff-switch");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await expect(settingsPage.cutoffSectionHeading).toBeVisible();

    const todayOption = settingsPage.cutoffOption("Hôm nay");
    const endOfMonthOption = settingsPage.cutoffOption("Cuối tháng này");
    const endOfYearOption = settingsPage.cutoffOption("Cuối năm nay");

    await expect(todayOption).toBeVisible();
    await expect(endOfMonthOption).toBeVisible();
    await expect(endOfYearOption).toBeVisible();

    // Mặc định "Hôm nay" đang chọn — component không có aria-current, chỉ
    // phân biệt active bằng class (đã tự verify tắt CutoffHardNavGuard làm
    // spec FAIL đúng chỗ dưới, không phải false-negative — xem báo cáo cuối).
    await settingsPage.expectSelected("Hôm nay");
    await settingsPage.expectNotSelected("Cuối tháng này");

    // Click link thật (không giả lập gì đặc biệt) — nếu CutoffHardNavGuard
    // hoạt động đúng, đây là hard navigation full page.
    await settingsPage.selectCutoff("Cuối tháng này");

    // Điểm mấu chốt: sau khi click, "Cuối tháng này" phải hiện active — nếu
    // thiếu guard, UI vẫn kẹt ở "Hôm nay" active dù cookie đã đổi (đúng bug
    // đã fix). KHÔNG reload thủ công ở đây — reload sẽ luôn pass dù bug tái
    // diễn, làm mất giá trị của spec.
    await settingsPage.expectSelected("Cuối tháng này");
    await settingsPage.expectNotSelected("Hôm nay");

    // Lựa chọn phải lan đúng sang route khác (Dashboard) — chứng minh cookie
    // dùng chung, không phải state cục bộ ở /settings.
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.cutoffLink).toContainText("Cuối tháng này");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
