import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { DashboardPage } from "../pages/dashboard-page";
import { NavChartPage } from "../pages/nav-chart-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { daysAgo, isoDate } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// Issue #141 — /nav-chart, biến động NAV theo LOẠI tài sản (STOCK/FUND/BOND/
// GOLD), đọc Snapshot per-holding group theo Holding.type
// (getNavTrendByAssetType(), features/snapshots/queries.ts). Logic thuần build
// điểm/% đã có unit test riêng (buildNavTrendSeries/groupSnapshotRowsByType,
// lib/nav-trend.ts) — 3 test dưới đây phủ phần KHÔNG unit-test-được: wiring
// lối vào từ Dashboard, wiring DB thật (per-holding Snapshot) -> đủ điểm vẽ
// đường theo đúng loại đang lọc, và luồng CTA "+ Thêm vị thế {Loại}" ở trạng
// thái rỗng dẫn thẳng tới tạo Holding thành công.
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

// holdingId thật (uuid) nằm ở segment cuối của URL chi tiết vị thế sạch (không
// query) — cùng helper bond-coupon-and-maturity.spec.ts/dividends.spec.ts.
function holdingIdFromUrl(holdingUrl: string): string {
  const id = new URL(holdingUrl).pathname.split("/").pop();
  if (!id) throw new Error(`Không lấy được holdingId từ URL: ${holdingUrl}`);
  return id;
}

test("từ Dashboard bấm 'Giá trị tài sản' -> điều hướng đúng tới /nav-chart và render màn Biến động NAV", async ({
  browser,
}) => {
  const session = await createTestSession("nav-chart-entry");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // goToNavChart() tự click link thật (không goto() thẳng URL) + chờ URL
    // khớp — nếu link bị revert về <div> tĩnh (navTrendHref vắng mặt) hoặc
    // route /nav-chart lỗi wiring, bước click/waitForURL này tự fail.
    const navChartPage = await dashboardPage.goToNavChart();

    await expect(navChartPage.heading).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("2 mốc Snapshot per-holding (BOND) trong năm -> chọn chip 'Trái phiếu' đủ điểm vẽ đường NAV, không rơi vào nhánh 'chưa vẽ được đường'", async ({
  browser,
}) => {
  const session = await createTestSession("nav-chart-bond-data");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const buyDate = isoDate(daysAgo(60));

  try {
    // Tạo 1 Holding BOND qua UI -> createHolding() tự trigger
    // freezeManualSnapshot() (finalizeHoldingWrite(), features/holdings/actions.ts)
    // -> ghi ngay 1 Snapshot{holdingId, date: hôm nay, frozen: true} cho đúng
    // holding này. Không cần seed PriceQuote cho BOND (định giá theo mệnh giá,
    // xem tiền lệ bond-coupon-and-maturity.spec.ts).
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 10,
      pricePerUnit: 1_000_000,
      assetType: "Trái phiếu",
      date: buyDate,
    });
    const holdingId = holdingIdFromUrl(detail.url);

    // Seed thêm đúng 1 mốc snapshot ~30 ngày trước cho CHÍNH holdingId đó ->
    // cộng với mốc "hôm nay" tự trigger ở trên = 2 điểm trong kỳ mặc định
    // "Năm" (đủ ngưỡng points.length >= 2 để vẽ đường, buildNavTrendSeries).
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId,
        date: daysAgo(30),
        value: "9500000",
        source: "MANUAL",
        period: "MANUAL",
        frozen: true,
      },
    });

    const navChartPage = new NavChartPage(page);
    await navChartPage.goto();
    await navChartPage.selectAssetType("Trái phiếu");

    // Bằng chứng DƯƠNG TÍNH đường đã vẽ được: card "Cao nhất kỳ"/"Thấp nhất
    // kỳ" chỉ render ở nhánh hasLine === true (NavTrendByAssetTypeChart.tsx) —
    // chặt hơn hẳn việc chỉ check chartUnavailableState vắng mặt (không phân
    // biệt được "vẽ được đường" với "khu vực đó không render gì cả").
    await expect(navChartPage.periodHighLabel).toBeVisible();
    await expect(navChartPage.chartUnavailableState).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("chưa có holding Vàng nào -> chip 'Vàng' hiện EmptyState đúng tiêu đề, CTA dẫn tới form tạo mới pre-select đúng loại, tạo thành công", async ({
  browser,
}) => {
  const session = await createTestSession("nav-chart-empty-gold-cta");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const navChartPage = new NavChartPage(page);
    await navChartPage.goto();
    await navChartPage.selectAssetType("Vàng");

    await expect(navChartPage.emptyStateTitle("Vàng")).toBeVisible();

    // Bấm CTA -> chờ redirect chính xác /holdings/new?type=GOLD (kiểm cả query
    // param, không chỉ path) rồi trả về NewHoldingPage để nối chuỗi tạo mới.
    const newHoldingPage = await navChartPage.goToNewHolding("Vàng");
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 5,
      pricePerUnit: 7_500_000,
      // Tile "Vàng" đã pre-select sẵn từ query param (isAssetType() ở
      // /holdings/new/page.tsx) — click lại vẫn an toàn (idempotent,
      // AssetTypeTiles chỉ gọi onChange(cùng giá trị)), giữ tường minh ý định
      // test thay vì dựa ngầm vào pre-select.
      assetType: "Vàng",
    });

    await expect(detail.heading(symbol)).toBeVisible();
    // Xác nhận loại tài sản THẬT đã lưu là Vàng qua label hiển thị trên trang
    // chi tiết (AssetTypeBadge) — không suy diễn từ URL/query param, không bám
    // class CSS màu badge.
    await expect(detail.assetTypeBadge("Vàng")).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
