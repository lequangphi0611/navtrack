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

// PriceQuote không có UI ghi — seed trực tiếp qua Prisma (cùng cách
// dashboard.spec.ts), cần cho test dưới (STOCK/FUND có cả PriceQuote lẫn
// NavOverride để verify rule ưu tiên theo ngày).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
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
    // Redirect gắn thêm ?cashflowId=<id> (issue #37, lib/routes.ts::holdingDetailAfterTransaction).
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    // Bỏ query string — saveNavOverride bên dưới redirect KHÔNG gắn cashflowId
    // (không phải 1 trong 4 action mua/bán), cần base URL sạch để so khớp đúng.
    const holdingUrl = stripQuery(page.url());

    // Trước khi nhập giá tay: Dashboard liệt vị thế vào "thiếu giá" (chưa có
    // cả PriceQuote lẫn NavOverride).
    await page.goto("/");
    await expect(page.getByText("Vàng · chưa có giá nhập tay")).toBeVisible();

    // Nhập giá tay 8.000.000 / chỉ, áp dụng hôm nay.
    await page.goto(`${holdingUrl}/price`);
    await page.locator('input[name="price"]').fill("8000000");
    const today = new Date().toISOString().slice(0, 10);
    await fillDatePicker(page, "date", today);
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
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("80.000.000");

    // Không còn nằm trong danh sách thiếu giá.
    await expect(page.getByText("Vàng · chưa có giá nhập tay")).toHaveCount(0);

    // priceFreshnessNote phản ánh có mã đang dùng giá nhập tay (nguồn MANUAL
    // đã thắng — GOLD không có nguồn AUTO nào để so sánh).
    await expect(page.getByText(/dùng giá nhập tay/)).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Issue #40 (process/DECISION.md 2026-07-14): trước đây NavOverride luôn
// thắng bất kể ngày -> một lần nhập tay sẽ "shadow" vĩnh viễn mọi PriceQuote
// mới hơn về sau. resolvePrice() đã có unit test đủ 3 nhánh so ngày
// (src/lib/valuation.test.ts) — spec này KHÔNG lặp lại các nhánh đó, chỉ
// verify phần unit test không phủ được: luồng thật xuyên Server Action ghi
// NavOverride -> query (getLatestNavOverrides/getLatestPriceQuotes, có
// unstable_cache) -> Dashboard, đúng kịch bản gốc gây ra bug.
test("NavOverride cũ hơn PriceQuote mới nhất -> Dashboard tự quay lại giá tự động, không bị shadow vĩnh viễn", async ({
  browser,
}) => {
  const session = await createTestSession("nav-override-priority");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const oldQuoteDate = daysAgo(10);
  const overrideDate = daysAgo(5);
  const newQuoteDate = daysAgo(1);

  try {
    // Seed PriceQuote (giá tự động) TRƯỚC khi tạo Holding — cùng lý do đã ghi
    // ở dashboard.spec.ts (tránh unstable_cache ghim "thiếu giá" nếu tạo
    // Holding trước).
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: oldQuoteDate } },
      create: {
        symbol,
        date: oldQuoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });

    // STOCK (mặc định của form) — loại có cả nguồn AUTO lẫn cho sửa tay.
    const buyDate = isoDate(daysAgo(730));
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("10");
    await page.locator('input[name="pricePerUnit"]').fill("100000");
    await fillDatePicker(page, "date", buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    // Redirect gắn thêm ?cashflowId=<id> (issue #37, lib/routes.ts::holdingDetailAfterTransaction).
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    // Bỏ query string — saveNavOverride bên dưới redirect KHÔNG gắn cashflowId
    // (không phải 1 trong 4 action mua/bán), cần base URL sạch để so khớp đúng.
    const holdingUrl = stripQuery(page.url());

    // Baseline: chỉ có AUTO -> NAV = 10 * 100.000 = 1.000.000.
    await page.goto("/");
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("1.000.000");
    await expect(page.getByText(/dùng giá nhập tay/)).toHaveCount(0);

    // Nhập giá tay 200.000, ngày MỚI HƠN PriceQuote hiện có (5 ngày trước >
    // 10 ngày trước) -> MANUAL thắng theo rule so ngày.
    await page.goto(`${holdingUrl}/price`);
    await page.locator('input[name="price"]').fill("200000");
    await fillDatePicker(page, "date", isoDate(overrideDate));
    await page.getByRole("button", { name: "Lưu giá nhập tay" }).click();
    await page.waitForURL(holdingUrl);

    await page.goto("/");
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("2.000.000");
    await expect(page.getByText(/dùng giá nhập tay/)).toBeVisible();

    // Giả lập job EOD chạy sau, ghi PriceQuote MỚI HƠN cả NavOverride vừa
    // nhập (1 ngày trước > 5 ngày trước) -> đúng kịch bản issue #40.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: newQuoteDate } },
      create: {
        symbol,
        date: newQuoteDate,
        price: "300000",
        source: "vnstock",
      },
      update: { price: "300000", source: "vnstock" },
    });

    // Đọc PriceQuote qua Dashboard bọc unstable_cache theo (symbol,
    // cutoffDateIso) — cutoff "Hôm nay" đã bị cache ở bước trên (còn hiệu lực
    // tới 1 giờ, job không gọi revalidateTag). Đổi sang mốc chốt khác ("Cuối
    // tháng này") để query chạy với cache key MỚI, tránh ăn phải kết quả cũ
    // đã cache — không phải cách né bug, mà vì bài test cần đọc DB thật ngay
    // lập tức thay vì chờ TTL, và mốc chốt khác vẫn hợp lệ (PriceQuote mới
    // vẫn <= cuối tháng này).
    await page.goto("/settings");
    await page.getByRole("link", { name: /Cuối tháng này/ }).click();

    await page.goto("/");
    // NAV quay lại dùng AUTO mới nhất = 10 * 300.000 = 3.000.000 — PriceQuote
    // mới hơn đã "un-shadow" NavOverride cũ, không còn kẹt vĩnh viễn ở MANUAL.
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("3.000.000");
    await expect(page.getByText(/dùng giá nhập tay/)).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol, date: { in: [oldQuoteDate, newQuoteDate] } },
    });
  }
});
