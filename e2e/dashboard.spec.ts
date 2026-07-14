import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { daysAgo, isoDate } from "./support/dates";
import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";

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
    await page.locator('input[name="date"]').fill(buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);

    await page.goto("/");

    // NAV = 100 * 150.000 = 15.000.000.
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator(".."),
    ).toContainText("15.000.000");

    // XIRR tính được — không rơi vào "Chưa tính được" (docs/domain/05: có ít
    // nhất 1 dòng tiền âm (mua) + 1 dòng tiền dương (NAV giả định tại mốc)).
    await expect(page.getByText("Chưa tính được")).toHaveCount(0);
    const xirrCard = page
      .getByText("XIRR", { exact: true })
      .locator("..")
      .locator("..");
    await expect(xirrCard).toContainText("%");

    // Lãi/lỗ tuyệt đối dương = NAV - vốn đã bỏ vào = 15tr - 10tr = 5.000.000.
    await expect(
      page.getByText("Lãi/lỗ tuyệt đối").locator(".."),
    ).toContainText("5.000.000");

    // priceFreshnessNote (mốc giá tự động gần nhất).
    await expect(page.getByText(/Giá tự động cập nhật EOD/)).toBeVisible();
  } finally {
    await context.close();
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
    await page.locator('input[name="date"]').fill(buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+$/);

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
    await context.close();
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});
