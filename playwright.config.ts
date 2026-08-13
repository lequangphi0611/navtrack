import { defineConfig } from "@playwright/test";

const isCloud = process.env.CLAUDE_CODE_REMOTE === "true";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 1,
  // timeout mặc định (30s) khá sát: mỗi test làm nhiều page.goto liên tiếp +
  // tính XIRR (Newton-Raphson) trong dev server (Turbopack, có thể cold-compile
  // route lần đầu) — dễ chạm ngưỡng ở đúng assertion cuối dù các bước trước đó
  // không sai gì (không phải lỗi domain thật). Nới thêm biên độ.
  timeout: 60_000,
  // retries=1 cả local (không chỉ CI): pnpm e2e giờ luôn chạy sau mỗi thay đổi
  // (HARNESS.md) — lần đầu dev server (Turbopack) mới khởi động, nhiều worker
  // cùng request các route chưa từng biên dịch có thể race và 404 thoáng qua,
  // không phải regression thật (retry lần 2 route đã compile xong, qua ngay).
  // Lỗi thật do code sai sẽ fail lại y hệt ở lần retry, không bị che giấu.
  retries: process.env.CI ? 2 : 1,
  // open: "never" — mặc định "on-failure" khi chạy local sẽ mở report và giữ
  // process sống (static server), khiến `docker compose down` trong scripts/e2e.mjs
  // không bao giờ chạy tới khi có test fail. Xem report thủ công: `pnpm exec playwright show-report`.
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Cloud: Chromium cài sẵn ở /opt/pw-browsers, KHÔNG được tải browser mới
    // (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1) — và có thể lệch revision so với bản
    // @playwright/test đang pin trong package.json (driver đòi
    // chromium_headless_shell-<rev khác> không có sẵn trên máy). Ép thẳng executable
    // path vào binary chromium đầy đủ (không phải headless-shell) có sẵn — cùng
    // pattern scripts/playwright-mcp.mjs. Xem
    // process/decisions/agent-workflow-and-tooling.md, mục 2026-08-13.
    ...(isCloud
      ? { launchOptions: { executablePath: "/opt/pw-browsers/chromium" } }
      : {}),
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
