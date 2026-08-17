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

// Issue #130 (process/UI_allocation-group-pnl.md) — NAV ròng + lãi/lỗ theo
// vốn theo TỪNG nhóm tài sản trên /allocation, cộng thẻ tổng NAV/tổng lãi-lỗ
// đầu trang. computeAllocationGroupDetails() (lib/allocation-group-pnl.ts) đã
// có unit test riêng cho công thức thuần; test dưới đây phủ phần KHÔNG
// unit-test-được: wiring DB thật (PriceQuote/Holding) -> getAllocationDetail()
// -> render đúng UI ở /allocation, gồm cả nút ẩn số tiền mới (chỉ ẩn VND, giữ
// %) và ca biên mã thiếu giá (loại khỏi NAV/lãi-lỗ nhóm, không mặc định 0).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("2 nhóm đủ giá: NAV ròng + lãi/lỗ theo vốn (VND+%) đúng từng nhóm và thẻ tổng; ẩn số tiền chỉ ẩn VND", async ({
  browser,
}) => {
  const session = await createTestSession("allocation-group-pnl-full");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolStock = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolFund = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);
  const buyDate = isoDate(daysAgo(730));

  try {
    // STOCK: mua 100 @ 100.000 (vốn 10.000.000), giá hiện tại 130.000 -> NAV
    // 13.000.000, lãi 3.000.000 (+30,0%).
    // FUND: mua 100 @ 100.000 (vốn 10.000.000), giá hiện tại 90.000 -> NAV
    // 9.000.000, lỗ -1.000.000 (-10,0%).
    // -> Tổng NAV 22.000.000, tổng lãi/lỗ +2.000.000 (+10,0% trên tổng vốn
    // 20.000.000). % phân bổ: STOCK 13tr/22tr = 59,1%, FUND 9tr/22tr = 40,9%.
    // Seed PriceQuote TRƯỚC Holding (GOTCHAS #7).
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolStock, date: quoteDate } },
      create: {
        symbol: symbolStock,
        date: quoteDate,
        price: "130000",
        source: "vnstock",
      },
      update: { price: "130000", source: "vnstock" },
    });
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolFund, date: quoteDate } },
      create: {
        symbol: symbolFund,
        date: quoteDate,
        price: "90000",
        source: "vnstock",
      },
      update: { price: "90000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol: symbolStock,
      quantity: 100,
      pricePerUnit: 100_000,
      date: buyDate,
    });
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol: symbolFund,
      quantity: 100,
      pricePerUnit: 100_000,
      assetType: "Quỹ mở",
      date: buyDate,
    });

    // Vào /allocation qua Dashboard (bấm AllocationBar, không goto() thẳng).
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    const allocationPage = await dashboardPage.goToAllocation();

    // Dòng nhóm Cổ phiếu: % phân bổ 59,1%, NAV ròng 13.000.000, lãi/lỗ theo
    // vốn 3.000.000 (+30,0%).
    const stockCard = allocationPage.groupCard("Cổ phiếu");
    await expect(stockCard).toContainText("59,1%");
    await expect(stockCard).toContainText("NAV ròng");
    await expect(stockCard).toContainText("13.000.000");
    await expect(stockCard).toContainText("3.000.000");
    await expect(stockCard).toContainText("+30,0%");
    // Nhãn "theo vốn" — không phải "so với kỳ trước" (dễ hiểu nhầm).
    await expect(stockCard).toContainText("Lãi/lỗ theo vốn");

    // Dòng nhóm Quỹ mở: % phân bổ 40,9%, NAV ròng 9.000.000, lỗ -1.000.000
    // (-10,0%) — dấu trừ đúng cả tiền lẫn %.
    const fundCard = allocationPage.groupCard("Quỹ mở");
    await expect(fundCard).toContainText("40,9%");
    await expect(fundCard).toContainText("9.000.000");
    await expect(fundCard).toContainText("1.000.000");
    await expect(fundCard).toContainText("−10,0%");

    // Thẻ tổng NAV ròng/tổng lãi-lỗ đầu trang: Σ NAV = 22.000.000, Σ lãi/lỗ =
    // 2.000.000 (+10,0% trên tổng vốn CÁC MÃ ĐÃ ĐỊNH GIÁ, không phải
    // navDeltaPercent toàn danh mục — đúng "Điểm cần xác nhận #2" của digest).
    // Không mang badge "Chưa đầy đủ" vì không mã nào thiếu giá.
    await expect(allocationPage.totalCard).toContainText("Tổng NAV ròng");
    await expect(allocationPage.totalCard).toContainText("22.000.000");
    await expect(allocationPage.totalCard).toContainText("2.000.000");
    await expect(allocationPage.totalCard).toContainText("+10,0%");
    await expect(allocationPage.totalCard).not.toContainText("Chưa đầy đủ");

    // Bấm nút mắt -> VND (NAV/lãi-lỗ từng nhóm + thẻ tổng) bị ẩn thành
    // "••••••", nhưng % phân bổ VÀ % lãi/lỗ theo vốn vẫn hiện nguyên (không
    // bao giờ bị ẩn — quy tắc cốt lõi issue #130).
    await expect(allocationPage.hideAmountsToggle).toHaveAccessibleName(
      "Ẩn số tiền",
    );
    await allocationPage.toggleHideAmounts();
    await expect(allocationPage.hideAmountsToggle).toHaveAccessibleName(
      "Hiện số tiền",
    );

    await expect(stockCard).not.toContainText("13.000.000");
    await expect(stockCard).toContainText("59,1%");
    await expect(stockCard).toContainText("+30,0%");
    await expect(fundCard).not.toContainText("9.000.000");
    await expect(fundCard).toContainText("40,9%");
    await expect(fundCard).toContainText("−10,0%");
    await expect(allocationPage.totalCard).not.toContainText("22.000.000");
    await expect(allocationPage.totalCard).toContainText("+10,0%");
    // NAV/pnl của cả 2 nhóm + thẻ tổng cùng ẩn -> đúng 6 chỗ hiện "••••••"
    // (navAmount+pnlAmount mỗi nhóm x2 nhóm + totalNavAmount+totalPnlAmount).
    // Donut center KHÔNG hiện VND (chỉ "N nhóm / dù đang ẩn tiền") nên không
    // cộng thêm — count cứng ở đây phát hiện được nếu 1 trong 6 chỗ quên ẩn.
    await expect(allocationPage.maskedAmounts).toHaveCount(6);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol: { in: [symbolStock, symbolFund] }, date: quoteDate },
    });
  }
});

test("nhóm Cổ phiếu có mã thiếu giá: NAV/lãi-lỗ nhóm chỉ tính trên mã đã có giá, viền/ghi chú chưa đầy đủ, badge ở thẻ tổng", async ({
  browser,
}) => {
  const session = await createTestSession("allocation-group-pnl-partial");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolA = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolB = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolC = `E2E${randomUUID().slice(0, 6).toUpperCase()}`; // thiếu giá
  const quoteDate = daysAgo(7);
  const buyDate = isoDate(daysAgo(730));

  try {
    // A: mua 60 @ 100.000 (vốn 6.000.000), giá 150.000 -> NAV 9.000.000.
    // B: mua 40 @ 100.000 (vốn 4.000.000), giá 100.000 -> NAV 4.000.000.
    // C: mua 10 @ 50.000 (vốn 500.000) -> KHÔNG seed PriceQuote -> thiếu giá.
    // Nếu NAV/lãi-lỗ nhóm mặc định 0 cho C thay vì LOẠI HẲN (bug tiềm ẩn: cộng
    // cost basis của C vào mẫu số nhưng NAV vẫn không đổi), pnl% nhóm sẽ lệch
    // xuống ~23,8% (2.500.000/10.500.000) thay vì đúng 30,0%
    // (3.000.000/10.000.000, chỉ tính A+B) -> assertion số dưới đây phát hiện
    // được cả 2 kiểu lỗi (mặc định 0 lẫn cộng nhầm cost basis).
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol: symbolA, date: quoteDate } },
      create: {
        symbol: symbolA,
        date: quoteDate,
        price: "150000",
        source: "vnstock",
      },
      update: { price: "150000", source: "vnstock" },
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
    await newHoldingPage.create({
      symbol: symbolC,
      quantity: 10,
      pricePerUnit: 50_000,
      date: buyDate,
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    const allocationPage = await dashboardPage.goToAllocation();

    const stockCard = allocationPage.groupCard("Cổ phiếu");
    // Nhãn đổi thành "NAV ròng · 2/3 mã có giá" (pricedCount/totalCount).
    await expect(stockCard).toContainText("NAV ròng · 2/3 mã có giá");
    // NAV/lãi-lỗ CHỈ của A+B (NAV 9tr+4tr=13.000.000, loại C hoàn toàn, không
    // mặc định 0).
    await expect(stockCard).toContainText("13.000.000");
    await expect(stockCard).toContainText("3.000.000");
    await expect(stockCard).toContainText("+30,0%");
    // Ghi chú amber nêu đúng số mã thiếu + tên mã, khẳng định "không mặc định
    // 0 ₫" (đúng câu literal trong component, xác nhận không phải suy diễn).
    await expect(stockCard).toContainText(
      `1 mã thiếu giá (${symbolC}) — NAV nhóm cổ phiếu chưa đầy đủ`,
    );
    await expect(stockCard).toContainText("không mặc định 0 ₫");

    // Thẻ tổng đầu trang mang badge "Chưa đầy đủ · 1 mã thiếu giá" (chỉ 1
    // nhóm STOCK trong danh mục test này nên tổng == nhóm STOCK).
    await expect(allocationPage.totalCard).toContainText("Chưa đầy đủ");
    await expect(allocationPage.totalCard).toContainText("1 mã thiếu giá");
    await expect(allocationPage.totalCard).toContainText("13.000.000");
    await expect(allocationPage.totalCard).toContainText("+30,0%");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol: { in: [symbolA, symbolB] }, date: quoteDate },
    });
  }
});
