import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { DashboardPage } from "../pages/dashboard-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { daysAgo, isoDate } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// Phase 6, mục 4/6/13 phase-6.md + docs/domain/04-pricing-and-valuation.md
// "Cảnh báo tập trung" — badge theo từng Holding (NAV Holding / NAV danh mục
// > CONCENTRATION_WARNING_THRESHOLD, seed mặc định 30%) + màn /allocation
// riêng (mockup 6d) với chú thích liên kết khi có Holding đang cảnh báo. Test
// dưới đây phủ phần KHÔNG unit-test-được: wiring Server Action -> DB thật
// (PriceQuote/Holding) -> computeConcentration() (lib/concentration.ts, đã có
// unit test riêng cho hàm thuần) -> render đúng UI ở 2 route.
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("danh mục chỉ 1 mã -> luôn cảnh báo tập trung (~100% danh mục); bán hết -> vị thế đóng không còn badge", async ({
  browser,
}) => {
  const session = await createTestSession("concentration-single");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Seed PriceQuote TRƯỚC Holding (GOTCHAS #7).
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "100000", source: "vnstock" },
      update: { price: "100000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 100,
      pricePerUnit: 100_000,
      date: isoDate(daysAgo(730)),
    });

    // Danh mục chỉ 1 mã có giá -> concentrationPercent = 100% > ngưỡng 30% bất
    // kể phân bổ (docs/domain/04 "Danh mục chỉ có một mã... luôn bị cảnh báo").
    let holdingsPage = await detail.goBack();
    await expect(holdingsPage.concentrationBadge(symbol)).toHaveText(
      "100,0% danh mục",
    );

    // Bán hết toàn bộ -> vị thế đóng (SL=0) không bao giờ nhận badge cảnh báo
    // (docs/domain/04 "Vị thế đóng: NAV=0 -> không bao giờ bị cảnh báo") —
    // getConcentrationBadges loại bỏ hoàn toàn holding đóng khỏi mẫu số.
    const detailAgain = await holdingsPage.openHolding(symbol, detail.url);
    const form = await detailAgain.goToNewTransaction();
    await form.submitSell({ quantity: 100, pricePerUnit: 100_000 });

    holdingsPage = await detailAgain.goBack();
    await holdingsPage.openClosed();
    await expect(holdingsPage.closedHoldingButton(symbol)).toBeVisible();
    await expect(
      holdingsPage.closedHoldingButton(symbol).getByText(/danh mục|Tạm ẩn/),
    ).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

test("2 mã khác loại tài sản, một mã vượt ngưỡng: badge đúng mã, /allocation hiện % theo nhóm + chú thích liên kết", async ({
  browser,
}) => {
  const session = await createTestSession("concentration-allocation");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolStock = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolFund = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);
  const buyDate = isoDate(daysAgo(730));

  try {
    // Seed CẢ HAI PriceQuote trước khi tạo Holding tương ứng (GOTCHAS #7) — NAV
    // 8.000.000 (STOCK, 80%) + 2.000.000 (FUND, 20%) -> tổng 10.000.000.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolStock, date: quoteDate } },
      create: {
        symbol: symbolStock,
        date: quoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolFund, date: quoteDate } },
      create: {
        symbol: symbolFund,
        date: quoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol: symbolStock,
      quantity: 80,
      pricePerUnit: 100_000,
      date: buyDate,
    });
    await newHoldingPage.goto();
    const detailFund = await newHoldingPage.create({
      symbol: symbolFund,
      quantity: 20,
      pricePerUnit: 100_000,
      assetType: "Quỹ mở",
      date: buyDate,
    });

    // Mã STOCK chiếm 80% (>30%) -> badge; mã FUND chiếm 20% (≤30%) -> không.
    const holdingsPage = await detailFund.goBack();
    await expect(holdingsPage.concentrationBadge(symbolStock)).toHaveText(
      "80,0% danh mục",
    );
    await expect(holdingsPage.concentrationBadge(symbolFund)).toHaveCount(0);

    // /allocation (mục 10 phase-6.md) — vào qua Dashboard (bấm AllocationBar,
    // không goto() thẳng), legend đúng % theo nhóm AssetType + chú thích liên
    // kết đúng số mã đang cảnh báo (chỉ 1: symbolStock).
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    const allocationPage = await dashboardPage.goToAllocation();

    await expect(allocationPage.legendRow("Cổ phiếu")).toContainText("80,0%");
    await expect(allocationPage.legendRow("Quỹ mở")).toContainText("20,0%");
    await expect(allocationPage.legendRow("Quỹ mở")).toContainText("gồm CCQ");

    await expect(allocationPage.concentrationWarningLink).toContainText(
      "1 mã đang vượt ngưỡng tập trung",
    );

    // Bấm chú thích -> quay lại /holdings (Link thật, verify luôn wiring điều
    // hướng, không chỉ text hiển thị).
    const holdingsPageAgain = await allocationPage.goToHoldingsFromWarning();
    await expect(holdingsPageAgain.holdingLink(symbolStock)).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol: { in: [symbolStock, symbolFund] }, date: quoteDate },
    });
  }
});
