import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { NewHoldingPage } from "../pages/new-holding-page";
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

// Nút "Xuất danh mục (JSON)" ở Cài đặt (issue #151) — link tải file, browser
// tự xử lý download qua GET. Route handler (src/app/api/portfolio/export/route.ts)
// chỉ là vỏ mỏng gọi getPortfolioExport() (features/holdings/queries/portfolio-export.ts,
// bản thân nó gọi thẳng findHoldingRows() + buildPortfolioExportPayload() —
// hàm thuần ĐÃ có 12 unit test đầy đủ cho logic lọc/format, xem
// src/features/holdings/portfolio-export.test.ts). Phần KHÔNG được unit test
// phủ (theo quy ước docs/rules/testing.md — queries.ts/route handler chỉ qua
// e2e): (1) proxy.ts middleware có thực sự chặn route MỚI này khi chưa đăng
// nhập không, (2) findHoldingRows() lọc đúng userId khi có ≥2 user thật trong
// DB (không phải data giả lập trong test thuần), (3) header Content-Disposition
// thật sự được server set đúng. Cả 3 test dưới đây nhắm đúng 3 khoảng trống đó.

test("Cài đặt hiện link 'Xuất danh mục (JSON)' trỏ đúng route export", async ({
  browser,
}) => {
  const session = await createTestSession("export-settings-link");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    await expect(settingsPage.exportLink).toBeVisible();
    // href tuyệt đối tới đúng route handler — sẽ fail nếu ai đó gõ nhầm path
    // hoặc route bị đổi tên/chuyển chỗ mà quên sửa link này.
    await expect(settingsPage.exportLink).toHaveAttribute(
      "href",
      "/api/portfolio/export",
    );
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("gọi route export khi đã đăng nhập: chỉ trả về vị thế CỔ PHIẾU của ĐÚNG user đó, kèm header tải file đúng", async ({
  browser,
}) => {
  const sessionA = await createTestSession("export-user-a");
  const sessionB = await createTestSession("export-user-b");

  const contextA = await browser.newContext();
  await signInAs(contextA, sessionA.sessionToken);
  const pageA = await contextA.newPage();

  const contextB = await browser.newContext();
  await signInAs(contextB, sessionB.sessionToken);
  const pageB = await contextB.newPage();

  const symbolA = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolAGold = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolB = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    // User A: 1 vị thế CỔ PHIẾU đang mở (EXISTING, không có field phí -> avgCost
    // = pricePerUnit đúng như holdings.spec.ts đã xác nhận) + 1 vị thế VÀNG
    // (loại tài sản khác) — dùng để xác nhận filter STOCK-only chạy trên dữ
    // liệu THẬT đã persist qua Holding, không chỉ trên input giả lập của unit test.
    const newHoldingPageA = new NewHoldingPage(pageA);
    await newHoldingPageA.goto();
    await newHoldingPageA.create({
      symbol: symbolA,
      quantity: 100,
      pricePerUnit: 65_000,
    });
    await newHoldingPageA.goto();
    await newHoldingPageA.create({
      symbol: symbolAGold,
      quantity: 5,
      pricePerUnit: 5_000_000,
      assetType: "Vàng",
    });

    // User B: 1 vị thế CỔ PHIẾU khác — chỉ dùng để chứng minh export của A
    // KHÔNG rò dữ liệu chéo user (userId filter thật, không phải giả lập).
    const newHoldingPageB = new NewHoldingPage(pageB);
    await newHoldingPageB.goto();
    await newHoldingPageB.create({
      symbol: symbolB,
      quantity: 50,
      pricePerUnit: 20_000,
    });

    const response = await pageA.request.get("/api/portfolio/export");
    expect(response.status()).toBe(200);

    const contentDisposition = response.headers()["content-disposition"];
    expect(contentDisposition).toMatch(
      /^attachment; filename="navtrack-portfolio-\d{4}-\d{2}-\d{2}\.json"$/,
    );

    const body = (await response.json()) as {
      schema_version: number;
      source: string;
      holdings: { symbol: string; quantity: string; avg_cost: string }[];
    };

    expect(body.schema_version).toBe(1);
    expect(body.source).toBe("navtrack");

    // Đúng 1 vị thế: STOCK của user A. KHÔNG có vàng của chính A (chứng minh
    // filter STOCK-only chạy thật trên DB), KHÔNG có cổ phiếu của B (chứng
    // minh findHoldingRows() lọc đúng userId, không trả toàn bộ bảng Holding).
    expect(body.holdings).toHaveLength(1);
    expect(body.holdings[0]?.symbol).toBe(symbolA);
    expect(body.holdings[0]?.quantity).toBe("100.0000");
    expect(body.holdings[0]?.avg_cost).toBe("65000.0000");
    expect(body.holdings.some((h) => h.symbol === symbolB)).toBe(false);
    expect(body.holdings.some((h) => h.symbol === symbolAGold)).toBe(false);
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
    await cleanupTestUser(sessionA.userId);
    await cleanupTestUser(sessionB.userId);
  }
});

test("gọi route export khi CHƯA đăng nhập: bị proxy.ts chặn, redirect về /sign-in thay vì trả JSON", async ({
  browser,
}) => {
  const context = await browser.newContext();

  try {
    const response = await context.request.get("/api/portfolio/export", {
      maxRedirects: 0,
    });

    // proxy.ts (middleware) chặn TRƯỚC khi vào route handler — route handler
    // tự trả 401 JSON chỉ là phòng thủ thêm, không phải nhánh thực tế chạy ở
    // đây (xem comment trong route.ts). Test này sẽ fail nếu middleware quên
    // thêm route mới vào danh sách bị chặn, hoặc PUBLIC_PATH_PREFIXES lỡ tay
    // khớp nhầm prefix "/api/portfolio".
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/sign-in");
  } finally {
    await closeContext(context);
  }
});
