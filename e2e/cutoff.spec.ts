import { expect, test } from "@playwright/test";

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
    await page.goto("/settings");
    await expect(
      page.getByText("Mốc chốt định giá", { exact: true }),
    ).toBeVisible();

    const todayOption = page.getByRole("link", { name: /Hôm nay/ });
    const endOfMonthOption = page.getByRole("link", {
      name: /Cuối tháng này/,
    });
    const endOfYearOption = page.getByRole("link", { name: /Cuối năm nay/ });

    await expect(todayOption).toBeVisible();
    await expect(endOfMonthOption).toBeVisible();
    await expect(endOfYearOption).toBeVisible();

    // Mặc định "Hôm nay" đang chọn — component không có aria-current, chỉ
    // phân biệt active bằng class (đã tự verify tắt CutoffHardNavGuard làm
    // spec FAIL đúng chỗ dưới, không phải false-negative — xem báo cáo cuối).
    await expect(todayOption).toHaveClass(/border-primary\/40/);
    await expect(endOfMonthOption).not.toHaveClass(/border-primary\/40/);

    // Click link thật (không giả lập gì đặc biệt) — nếu CutoffHardNavGuard
    // hoạt động đúng, đây là hard navigation full page.
    await endOfMonthOption.click();

    // Điểm mấu chốt: sau khi click, "Cuối tháng này" phải hiện active — nếu
    // thiếu guard, UI vẫn kẹt ở "Hôm nay" active dù cookie đã đổi (đúng bug
    // đã fix). KHÔNG reload thủ công ở đây — reload sẽ luôn pass dù bug tái
    // diễn, làm mất giá trị của spec.
    await expect(page).toHaveURL(/\/settings$/);
    await expect(endOfMonthOption).toHaveClass(/border-primary\/40/);
    await expect(todayOption).not.toHaveClass(/border-primary\/40/);

    // Lựa chọn phải lan đúng sang route khác (Dashboard) — chứng minh cookie
    // dùng chung, không phải state cục bộ ở /settings.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Mốc chốt/ })).toContainText(
      "Cuối tháng này",
    );
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
