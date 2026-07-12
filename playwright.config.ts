import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // retries=1 cả local (không chỉ CI): pnpm e2e giờ luôn chạy sau mỗi thay đổi
  // (HARNESS.md) — lần đầu dev server (Turbopack) mới khởi động, nhiều worker
  // cùng request các route chưa từng biên dịch có thể race và 404 thoáng qua,
  // không phải regression thật (retry lần 2 route đã compile xong, qua ngay).
  // Lỗi thật do code sai sẽ fail lại y hệt ở lần retry, không bị che giấu.
  retries: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
