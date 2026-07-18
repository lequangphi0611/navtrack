import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
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
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
