import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { DashboardPage } from "../pages/dashboard-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { SettingsPage } from "../pages/settings-page";
import { SnapshotPage } from "../pages/snapshot-page";
import { daysAgo } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// Issue #37 (process/DECISION.md 2026-07-15 (3), docs/domain/06-snapshots.md
// "Khi nào lưu snapshot") — Snapshot{period: MANUAL} chốt tự động sau mỗi
// mua/bán VÀ khi bấm "Chốt số liệu hôm nay" (Dashboard/`/snapshots`). Unit
// test (lib/manual-snapshot.test.ts) đã phủ planManualSnapshot() thuần —
// 3 spec dưới đây verify phần KHÔNG unit-test-được: luồng thật xuyên Server
// Action -> DB thật -> UI (banner/badge), và bất biến idempotent qua nhiều
// lần bấm/trigger thật trong ngày (không chỉ tin lời báo cáo).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("mua tạo Snapshot MANUAL cho holding + tổng danh mục, banner 'vừa giao dịch xong' hiện đúng trên /holdings/[id]", async ({
  browser,
}) => {
  const session = await createTestSession("manual-snapshot-buy");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(3);

  try {
    // Seed PriceQuote TRƯỚC khi tạo Holding — tránh unstable_cache ghim "thiếu
    // giá" (lý do chi tiết ở dashboard.spec.ts), cần để holding VALUED ngay khi
    // triggerManualSnapshot() chạy trong CÙNG transaction createHolding.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "100000", source: "vnstock" },
      update: { price: "100000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    // Redirect gắn ?cashflowId=<id> (holdingDetailAfterTransaction) — cờ cho
    // getJustRecordedBanner() dựng TransactionSnapshotBanner.
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 10,
      pricePerUnit: 100_000,
    });
    const holdingId = new URL(detail.url).pathname.split("/").pop();

    // Banner "vừa giao dịch xong" (TransactionSnapshotBanner) — đọc thẳng từ
    // getJustRecordedBanner() (features/holdings/queries.ts), không phải mock.
    await expect(detail.transactionSnapshotBannerHeading).toBeVisible();
    await expect(detail.bannerTransactionLabel("Mua 10 cổ phần")).toBeVisible();
    await expect(detail.snapshotAutoNote).toBeVisible();
    await expect(detail.navAfterTransactionNote).toBeVisible();

    // process/decisions/architecture-and-code-quality.md 2026-08-20 — route
    // fan-in với nguồn ĐỘNG: CTA "Xem lịch sử NAV" trong banner gắn
    // `?fromHolding=<id>` (lib/routes.ts::snapshotsFromHolding), page /snapshots
    // verify quyền sở hữu (isOwnHolding()) rồi trỏ back link về ĐÚNG holding
    // vừa ghi giao dịch, không phải Dashboard (fallback khi nguồn không hợp lệ).
    const snapshotPage = await detail.goToSnapshotHistory();
    await expect(snapshotPage.backLink).toBeVisible();
    // detail.url là URL TUYỆT ĐỐI (stripQuery() dùng new URL().toString(),
    // xem support/urls.ts) — so khớp qua điều hướng thật (waitForURL) thay vì
    // đọc thẳng attribute href (tương đối, sẽ luôn lệch dạng tuyệt đối/tương
    // đối dù đúng cùng đích).
    await snapshotPage.backLink.click();
    await page.waitForURL(detail.url);

    // Bằng chứng thật ở DB (không chỉ tin UI): đúng 1 dòng per-holding + 1 dòng
    // tổng danh mục (holdingId: null), period MANUAL, ghi hôm nay.
    const rows = await db.snapshot.findMany({
      where: { userId: session.userId, period: "MANUAL" },
    });
    expect(rows).toHaveLength(2);

    const holdingRow = rows.find((r) => r.holdingId === holdingId);
    const aggregateRow = rows.find((r) => r.holdingId === null);
    expect(holdingRow).toBeDefined();
    expect(aggregateRow).toBeDefined();
    // 10 * 100.000 = 1.000.000.
    expect(holdingRow?.value.toNumber()).toBe(1_000_000);
    expect(aggregateRow?.value.toNumber()).toBe(1_000_000);
    expect(holdingRow?.frozen).toBe(true);
    expect(aggregateRow?.frozen).toBe(true);
    // Tổng danh mục LUÔN AUTO — con số tính toán (sum), không phải giá trị lấy
    // thẳng từ 1 dòng nhập tay (docs/domain/06-snapshots.md mục "Cách tính").
    expect(aggregateRow?.source).toBe("AUTO");
    expect(holdingRow?.source).toBe("AUTO");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Phase 3, tiêu chí "Số liệu đã đóng băng KHÔNG đổi khi giá cập nhật sau này"
// (process/phase-3.md, docs/domain/06-snapshots.md mục "Quy tắc & bất biến" —
// `frozen = true`). Không có code nào re-derive Snapshot.value từ giá sống khi
// đọc (getManualSnapshotToday()/getSnapshotFreezePreview() đều SELECT thẳng
// cột value) — bất biến giữ bởi cấu trúc, verify bằng dữ liệu thật: cập nhật
// PriceQuote SAU khi đã chốt không được phép làm đổi dòng Snapshot đã lưu,
// trong khi NAV sống (Dashboard) phải phản ánh giá mới ngay.
test("số liệu Snapshot đã đóng băng không đổi khi PriceQuote cập nhật giá mới sau đó — NAV sống trên Dashboard thì đổi", async ({
  browser,
}) => {
  const session = await createTestSession("manual-snapshot-frozen-immutable");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(3);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "100000", source: "vnstock" },
      update: { price: "100000", source: "vnstock" },
    });

    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 10,
      pricePerUnit: 100_000,
    });
    const holdingId = new URL(detail.url).pathname.split("/").pop();

    // Snapshot MANUAL đầu tiên (tự động sau mua) = 10 * 100.000 = 1.000.000.
    const beforeRow = await db.snapshot.findFirst({
      where: { userId: session.userId, holdingId, period: "MANUAL" },
    });
    expect(beforeRow?.value.toNumber()).toBe(1_000_000);
    expect(beforeRow?.frozen).toBe(true);

    // "Cập nhật giá sau này" — upsert lại CHÍNH dòng PriceQuote đã dùng để chốt
    // (cùng symbol/date) với giá mới cao hơn hẳn, mô phỏng job EOD chạy lại/sửa
    // giá cho ngày đó.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: {
        symbol,
        date: quoteDate,
        price: "999999999",
        source: "vnstock",
      },
      update: { price: "999999999", source: "vnstock" },
    });

    // Dòng Snapshot ĐÃ ĐÓNG BĂNG không được đọc lại/tính lại — value giữ
    // nguyên 1.000.000 dù PriceQuote nguồn đã đổi.
    const afterRow = await db.snapshot.findFirst({
      where: { userId: session.userId, holdingId, period: "MANUAL" },
    });
    expect(afterRow?.value.toNumber()).toBe(1_000_000);
    expect(afterRow?.updatedAt.getTime()).toBe(beforeRow?.updatedAt.getTime());

    // Đối chứng: NAV SỐNG (không phải Snapshot) trên Dashboard PHẢI phản ánh
    // giá mới ngay — chứng minh "đóng băng" là có chủ đích, không phải do đọc
    // nhầm/cache cứng toàn app.
    //
    // getLatestPriceQuotes (lib/valuation.ts) bọc unstable_cache theo (symbol,
    // cutoffDateIso), TTL ~1h — cache key cho cutoff "Hôm nay" đã bị ghim ở các
    // bước điều hướng trước đó (tạo Holding -> đọc valuateHoldings). Đổi sang
    // mốc chốt khác ("Cuối tháng này") để query chạy với cache key MỚI, cùng
    // pattern đã dùng ở nav-override.spec.ts (không phải né bug — mốc chốt
    // khác vẫn hợp lệ vì PriceQuote seed <= cuối tháng này).
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.selectCutoff("Cuối tháng này");

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.navValueBlock).toContainText("9.999.999.990");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

test("bấm 'Chốt ngay' trên Dashboard hiện badge 'Đã chốt lúc HH:mm'; tải lại trang vẫn đúng (server truth, không phải state client)", async ({
  browser,
}) => {
  const session = await createTestSession("manual-snapshot-today-card");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.snapshotTodayButton).toBeVisible();
    await expect(dashboardPage.snapshotTodayBadge).toHaveCount(0);

    await dashboardPage.snapshotTodayButton.click();
    await expect(dashboardPage.snapshotTodayBadge).toBeVisible();
    const takenAtText = (
      await dashboardPage.snapshotTodayBadge.innerText()
    ).trim();

    // Server truth (getManualSnapshotToday() đọc DB), không phải chỉ giữ lại
    // client state useActionState — tải lại trang (mount mới, state client mất)
    // vẫn phải hiện đúng, và nút "Chốt ngay" không còn xuất hiện lại.
    await page.reload();
    await expect(page.getByText(takenAtText)).toBeVisible();
    await expect(dashboardPage.snapshotTodayButton).toHaveCount(0);

    // User không có Holding nào — NAV = 0 là số thật, vẫn ghi đúng 1 dòng tổng
    // danh mục (docs/domain/06-snapshots.md mục "Ca biên").
    const rows = await db.snapshot.findMany({
      where: { userId: session.userId, period: "MANUAL" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.holdingId).toBeNull();
    expect(rows[0]?.value.toNumber()).toBe(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("bấm 'Đóng băng số liệu' trên /snapshots nhiều lần trong ngày (qua nhiều lần tải trang) vẫn chỉ đúng 1 dòng Snapshot/mốc trong DB", async ({
  browser,
}) => {
  const session = await createTestSession("manual-snapshot-freeze-sheet");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(3);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "50000", source: "vnstock" },
      update: { price: "50000", source: "vnstock" },
    });

    // Redirect gắn ?cashflowId=<id> — createHolding tự trigger 1 lần chốt
    // MANUAL đầu tiên (1 dòng holding + 1 dòng tổng, xem test "mua tạo
    // Snapshot MANUAL..." phía trên).
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    await newHoldingPage.create({
      symbol,
      quantity: 20,
      pricePerUnit: 50_000,
    });

    // Bấm "Đóng băng số liệu" (SnapshotFreezeSheet) 3 lần, MỖI LẦN QUA MỘT LẦN
    // TẢI TRANG MỚI: SnapshotFreezeSheetProps KHÔNG có prop "đã chốt hôm nay"
    // từ server (khác SnapshotTodayCard) — useActionState reset về null lúc
    // mount, nên form luôn cho bấm lại được ngay cả khi đã chốt trong ngày
    // (process/DECISION.md 2026-07-15 (3)) — mô phỏng đúng ca "bấm nhiều lần".
    const snapshotPage = new SnapshotPage(page);
    for (let i = 0; i < 3; i += 1) {
      await snapshotPage.goto();
      await snapshotPage.openFreezeSheet();
      await snapshotPage.submitFreeze();
      await expect(snapshotPage.freezeDoneBadge).toBeVisible();
    }

    // Tổng cộng đã chốt 4 lần (1 tự động sau mua + 3 lần bấm tay) — vẫn đúng 1
    // dòng per-holding + 1 dòng tổng danh mục, KHÔNG nhân theo số lần bấm
    // (khóa dedup (userId|holdingId, date, period), upsert idempotent —
    // docs/domain/06-snapshots.md mục "Ca biên").
    const rows = await db.snapshot.findMany({
      where: { userId: session.userId, period: "MANUAL" },
    });
    expect(rows).toHaveLength(2);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

test("2 tab bấm 'Đóng băng số liệu' CÙNG LÚC (Promise.all, không qua tải trang tuần tự) vẫn chỉ tạo đúng 1 dòng Snapshot/mốc — race thật trên transaction Serializable, không phải giả lập", async ({
  browser,
}) => {
  // Khác test "nhiều lần trong ngày" phía trên (tuần tự qua nhiều lần tải trang,
  // không bao giờ thật sự overlap 2 transaction) — test này bắn 2 request freeze
  // từ 2 tab CÙNG một user thật sự đồng thời, để nhánh bắt P2002/P2034 trong
  // freezeManualSnapshot() (src/features/snapshots/actions.ts) có cơ hội chạy
  // qua ít nhất 1 lần, không chỉ được suy luận qua đọc code.
  const session = await createTestSession("manual-snapshot-concurrent");
  // 2 tab độc lập của cùng user -> dựng song song bằng Promise.all (review PR
  // #97 finding #8), không phải chạy tuần tự từng await riêng lẻ.
  const [contextA, contextB] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  await Promise.all([
    signInAs(contextA, session.sessionToken),
    signInAs(contextB, session.sessionToken),
  ]);
  const [pageA, pageB] = await Promise.all([
    contextA.newPage(),
    contextB.newPage(),
  ]);

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(3);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "50000", source: "vnstock" },
      update: { price: "50000", source: "vnstock" },
    });

    // Tạo 1 Holding đang mở (quantity > 0) qua UI ở tab A — cũng tự trigger 1
    // lần chốt MANUAL đầu tiên (side effect của createHolding), giống các test
    // phía trên.
    const newHoldingPageA = new NewHoldingPage(pageA);
    await newHoldingPageA.goto();
    await newHoldingPageA.create({
      symbol,
      quantity: 20,
      pricePerUnit: 50_000,
    });

    const snapshotPageA = new SnapshotPage(pageA);
    const snapshotPageB = new SnapshotPage(pageB);
    await snapshotPageA.goto();
    await snapshotPageB.goto();
    await snapshotPageA.openFreezeSheet();
    await snapshotPageB.openFreezeSheet();
    await expect(snapshotPageA.freezeSubmitButton).toBeVisible();
    await expect(snapshotPageB.freezeSubmitButton).toBeVisible();

    // Bắn 2 submit CÙNG LÚC qua Promise.all (không await tuần tự) — 2 request
    // POST tới Server Action gần như overlap, khác hẳn cách tải-lại-trang-rồi-bấm
    // tuần tự ở test phía trên.
    await Promise.all([
      snapshotPageA.submitFreeze(),
      snapshotPageB.submitFreeze(),
    ]);

    // Mỗi tab phải kết thúc ở 1 trong 2 trạng thái hợp lệ: chốt thành công
    // (badge "Đã chốt lúc") hoặc thua trong đua tranh, được báo thử lại (Alert
    // "Không chốt được") — KHÔNG được crash/treo/hiện lỗi khác.
    const settleStates = [
      snapshotPageA.freezeDoneBadge.or(snapshotPageA.freezeErrorState),
      snapshotPageB.freezeDoneBadge.or(snapshotPageB.freezeErrorState),
    ];
    await Promise.all(
      settleStates.map((locator) => expect(locator).toBeVisible()),
    );

    // Bất biến idempotent (khóa dedup (holdingId|userId, date, period)) phải giữ
    // đúng dù 2 transaction overlap thật — vẫn chỉ 1 dòng per-holding + 1 dòng
    // tổng danh mục, không nhân đôi do race.
    const rows = await db.snapshot.findMany({
      where: { userId: session.userId, period: "MANUAL" },
    });
    expect(rows).toHaveLength(2);
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});
