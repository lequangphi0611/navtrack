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

// Issue #131/#132 (process/DECISION.md 2026-08-16: route riêng /allocation/stock,
// không accordion) — drill-down "% theo mã trong nhóm cổ phiếu". Mẫu số KHÁC
// concentrationPercent (toàn danh mục, test phía trên) — mẫu số ở đây là NAV
// nhóm cổ phiếu, mã MISSING_PRICE bị loại khỏi mẫu số hoàn toàn (không suy diễn
// NAV=0). computeStockGroupAllocation() (lib/stock-group-allocation.ts) đã có
// unit test riêng cho công thức thuần — test này phủ phần KHÔNG unit-test-được:
// wiring getStockAllocationDetail() -> DB thật -> route /allocation/stock ->
// cập nhật giá xong tính lại đúng mẫu số mới.
test("/allocation/stock: 2 mã có giá + 1 mã thiếu giá -> đúng % mẫu số nhóm cổ phiếu, cập nhật giá xong tính lại", async ({
  browser,
}) => {
  const session = await createTestSession("stock-allocation-detail");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolA = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolB = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolC = `E2E${randomUUID().slice(0, 6).toUpperCase()}`; // thiếu giá lúc đầu
  const quoteDate = daysAgo(7);
  const buyDate = isoDate(daysAgo(730));

  try {
    // A: NAV 6.000.000 (60 * 100k), B: NAV 4.000.000 (40 * 100k) -> mẫu số
    // nhóm cổ phiếu = 10.000.000 (60%/40%). symbolC KHÔNG seed PriceQuote ->
    // MISSING_PRICE, loại khỏi mẫu số hoàn toàn.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolA, date: quoteDate } },
      create: {
        symbol: symbolA,
        date: quoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolB, date: quoteDate } },
      create: {
        symbol: symbolB,
        date: quoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol: symbolA,
      quantity: 60,
      pricePerUnit: 100_000,
      date: buyDate,
    });
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol: symbolB,
      quantity: 40,
      pricePerUnit: 100_000,
      date: buyDate,
    });
    await newHoldingPage.goto();
    const detailC = await newHoldingPage.create({
      symbol: symbolC,
      quantity: 10,
      pricePerUnit: 50_000,
      date: buyDate,
    });

    // Vào /allocation qua Dashboard rồi bấm dòng "Cổ phiếu" -> /allocation/stock
    // (Link thật, verify luôn wiring điều hướng — không goto() thẳng).
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    const allocationPage = await dashboardPage.goToAllocation();
    const stockPage = await allocationPage.goToStockDetail();

    // % trong nhóm cổ phiếu: A = 60%, B = 40% (mẫu số CHỈ A+B, KHÔNG cộng C).
    await expect(stockPage.symbolInList(symbolA)).toBeVisible();
    await expect(stockPage.symbolInList(symbolB)).toBeVisible();
    // exact:true tách số % LỚN cột phải (mẫu số nhóm cổ phiếu) khỏi badge
    // ConcentrationBadge cũ có thể trùng số (mẫu số toàn danh mục) — trong
    // test này danh mục CHỈ có 3 mã cổ phiếu nên 2 mẫu số trùng giá trị, badge
    // hiện "~60,0% danh mục" (chứa "60,0%" như substring) cạnh mã A.
    await expect(page.getByText("60,0%", { exact: true })).toBeVisible();
    await expect(page.getByText("40,0%", { exact: true })).toBeVisible();

    // C thiếu giá -> tách khu vực riêng "Không tính vào tỉ trọng", có CTA.
    await expect(stockPage.symbolInList(symbolC)).toBeVisible();
    await expect(page.getByText("Không tính vào tỉ trọng")).toBeVisible();
    await expect(stockPage.missingPriceUpdateLink).toBeVisible();

    // Footer tổng nhóm cổ phiếu: 100,0% + đúng mẫu số 10.000.000 (A+B).
    await expect(stockPage.groupTotalFooter).toContainText("100,0%");
    await expect(stockPage.groupTotalFooter).toContainText("10.000.000");

    // Đổi sort (cơ chế UI thuần, client-side) -> nhãn đổi, xác nhận wiring click.
    await expect(stockPage.sortToggle).toHaveText(/% giảm dần/);
    await stockPage.sortToggle.click();
    await expect(stockPage.sortToggle).toHaveText(/Theo mã A→Z/);

    // Bấm "Cập nhật giá" cho C -> NavOverrideForm -> lưu giá tay.
    const navOverrideForm = await stockPage.goToUpdatePrice(detailC.url);
    await navOverrideForm.save({ price: 500_000, date: isoDate(new Date()) });

    // Quay lại /allocation/stock -> C không còn MISSING_PRICE, mẫu số đổi
    // (A+B+C = 15.000.000), khu vực "Không tính vào tỉ trọng" biến mất.
    await dashboardPage.goto();
    const allocationPageAfter = await dashboardPage.goToAllocation();
    const stockPageAfter = await allocationPageAfter.goToStockDetail();

    await expect(stockPageAfter.symbolInList(symbolC)).toBeVisible();
    // "N mã có giá · mẫu số ..." (đếm mã ĐÃ có giá — chỉ hiện khi
    // missingPricedRows rỗng) chỉ đúng "3 mã" khi C được tính vào, thay vì
    // vẫn còn 2 -> xác nhận C không còn nằm trong khu vực "Không tính vào tỉ
    // trọng" mà không cần đếm số lần "—" xuất hiện (giòn hơn).
    await expect(page.getByText(/3 mã có giá/)).toBeVisible();
    await expect(page.getByText("Không tính vào tỉ trọng")).toHaveCount(0);
    await expect(stockPageAfter.groupTotalFooter).toContainText("100,0%");
    await expect(stockPageAfter.groupTotalFooter).toContainText("15.000.000");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol: { in: [symbolA, symbolB] }, date: quoteDate },
    });
  }
});
