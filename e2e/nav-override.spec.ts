import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";

test.afterAll(async () => {
  await disconnectTestDb();
});

test("nhập giá tay (NavOverride) cho vị thế Vàng cập nhật NAV toàn danh mục", async ({
  browser,
}) => {
  const session = await createTestSession("nav-override");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  // Mã ngẫu nhiên — PriceQuote/việc phân loại "thiếu giá" tra theo symbol dùng
  // chung toàn app (không scoped theo user, xem docs/rules/schema.md), nên
  // tránh mã cố định như "SJC" có thể đụng dữ liệu PriceQuote/NavOverride có
  // sẵn từ lần verify thủ công khác của database dev/test dùng chung.
  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    // GOLD mặc định định giá thủ công — không có giá tự động vnstock
    // (docs/domain/04-pricing-and-valuation.md) nên chưa có PriceQuote nào
    // cho mã này ngay sau khi tạo.
    await page.goto("/holdings/new");
    await page.getByRole("button", { name: "Vàng", exact: true }).click();
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("10");
    await page.locator('input[name="pricePerUnit"]').fill("7000000");
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);
    const holdingUrl = page.url();

    // Trước khi nhập giá tay: Dashboard liệt vị thế vào "thiếu giá" (chưa có
    // cả PriceQuote lẫn NavOverride).
    await page.goto("/");
    await expect(page.getByText("Vàng · chưa có giá nhập tay")).toBeVisible();

    // Nhập giá tay 8.000.000 / chỉ, áp dụng hôm nay.
    await page.goto(`${holdingUrl}/price`);
    await page.locator('input[name="price"]').fill("8000000");
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('input[name="date"]').fill(today);
    await page.getByRole("button", { name: "Lưu giá nhập tay" }).click();

    // saveNavOverride (Server Action) redirect về đúng chi tiết vị thế khi
    // thành công — validation lỗi sẽ KHÔNG redirect, ở lại trang nhập giá.
    await page.waitForURL(holdingUrl);
    await expect(page.getByRole("heading", { name: symbol })).toBeVisible();

    // GHI CHÚ (đã xác nhận đọc code trước khi viết spec): HoldingDetailScreen
    // hiện CHƯA wiring prop `valuation` (NAV/PriceSourceBadge) vào route
    // /holdings/[id] — xem src/app/(dashboard)/holdings/[id]/page.tsx +
    // process/UI_phase_2.md mục 2c ("chưa có valuation") + process/phase-2.md
    // (không có tiêu chí wiring màn này ở Phase 2). Route DUY NHẤT hiện đọc
    // NavOverride để hiển thị là Dashboard (getPortfolioValuation) — verify
    // hiệu ứng NavOverride qua đó thay vì badge "Nhập tay" trên trang chi
    // tiết (chưa có trên route thật để assert).
    await page.goto("/");

    // NAV giờ gồm cả vị thế này = 10 * 8.000.000 = 80.000.000.
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator(".."),
    ).toContainText("80.000.000");

    // Không còn nằm trong danh sách thiếu giá.
    await expect(page.getByText("Vàng · chưa có giá nhập tay")).toHaveCount(0);

    // priceFreshnessNote phản ánh có mã đang dùng giá nhập tay (nguồn MANUAL
    // đã thắng — GOLD không có nguồn AUTO nào để so sánh).
    await expect(page.getByText(/dùng giá nhập tay/)).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
  }
});
