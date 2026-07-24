import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { daysAgo } from "./support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";

// Issue #46 (process/DECISION.md 2026-07-15 (4)) — getSnapshotHistory()/
// getSnapshotDetail(id) đọc chuỗi Snapshot{holdingId, frozen: true} thật thay
// sample data hardcode ở /snapshots và /snapshots/[id]. Unit test
// (lib/snapshot-history.test.ts, lib/snapshot-recompute.test.ts) đã phủ logic
// thuần dựng chart/badge/recompute — 4 spec dưới đây verify phần KHÔNG
// unit-test-được: luồng thật xuyên DB -> query Prisma thật (liên kết breakdown
// qua (userId, date, period), resolvePrice batched) -> UI, cách ly quyền
// giữa 2 tài khoản, và ngưỡng recomputedComparison trên dữ liệu giá thật.
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

test("mở /snapshots thấy đúng lịch sử thật (không phải sample cũ); bấm vào một mốc mở đúng /snapshots/[id] với NAV/breakdown đúng", async ({
  browser,
}) => {
  const session = await createTestSession("snapshot-history");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  // Giá duy nhất, đủ xa trong quá khứ để cả cutoff lịch sử (snapshot.date) lẫn
  // cutoff hôm nay đều thấy CÙNG một dòng PriceQuote -> historicalPrice ===
  // currentPrice -> recomputedComparison = null (3c, không phải 3f) cho dòng
  // MANUAL trong test này (3f được test riêng ở spec dưới).
  const quoteDate = daysAgo(60);
  const manualDate = daysAgo(5);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "100000", source: "vnstock" },
      update: { price: "100000", source: "vnstock" },
    });

    const holding = await db.holding.create({
      data: {
        userId: session.userId,
        type: "STOCK",
        symbol,
        unit: "cổ phần",
      },
    });

    // 3 mốc tổng danh mục đã đóng băng — đủ 3 period để verify cả 3 biến thể
    // badge (ĐỊNH KỲ/CUỐI NĂM/THỦ CÔNG) trên dữ liệu thật, không phải sample.
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: null,
        date: daysAgo(40),
        value: "2000000",
        source: "AUTO",
        period: "PERIODIC",
        frozen: true,
      },
    });
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: null,
        date: daysAgo(400),
        value: "1500000",
        source: "AUTO",
        period: "YEAR_END",
        frozen: true,
      },
    });
    const manualAggregate = await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: null,
        date: manualDate,
        value: "1000000",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });
    // Dòng per-holding CÙNG (date, period) với dòng tổng — liên kết breakdown
    // (Trọng tâm quyết định #2, process/DECISION.md issue #46). quantity suy
    // ngược = 1.000.000 / 100.000 = 10.
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: holding.id,
        date: manualDate,
        value: "1000000",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });

    await page.goto("/snapshots");

    // Dòng "live" luôn ở đầu — mốc hôm nay tính động, không lưu. Label "Hôm
    // nay" nằm chung 1 <div> với span "· trực tiếp" (không tách riêng thành
    // element có text khớp exact) — match theo dateNote đặc trưng của dòng
    // live thay vì label.
    await expect(page.getByText(/tính động, chưa lưu/)).toBeVisible();

    // Cả 3 badge suy từ period đều hiện trên dữ liệu thật vừa seed.
    await expect(page.getByText("ĐỊNH KỲ", { exact: true })).toBeVisible();
    await expect(page.getByText("CUỐI NĂM", { exact: true })).toBeVisible();
    await expect(page.getByText("THỦ CÔNG", { exact: true })).toBeVisible();

    // Giá trị thật (không phải số sample cũ) — 2tr/1,5tr/1tr theo compact.
    await expect(page.getByText("2tr", { exact: true })).toBeVisible();
    await expect(page.getByText("1,5tr", { exact: true })).toBeVisible();

    // Bấm vào mốc THỦ CÔNG -> điều hướng đúng /snapshots/[id] của đúng dòng
    // tổng danh mục vừa seed.
    await page.getByRole("link", { name: /Chốt thủ công/ }).click();
    await page.waitForURL(new RegExp(`/snapshots/${manualAggregate.id}$`));

    // NAV đã đóng băng hiển thị đúng con số thật (không phải sample). Label
    // và giá trị NAV nằm cách nhau 2 cấp DOM (label lồng trong 1 flex div con
    // của card, giá trị là sibling của flex div đó — khác pattern Dashboard
    // 1 cấp) nên cần .locator("..") 2 lần.
    await expect(
      page.getByText("NAV đã đóng băng").locator("..").locator(".."),
    ).toContainText("1.000.000");

    // Không có lệch giá (historicalPrice === currentPrice) -> 3c, KHÔNG hiện
    // khối so sánh 3f.
    await expect(page.getByText("Chốt thủ công · toàn danh mục")).toBeVisible();
    await expect(page.getByText("Nếu tính lại với giá mới")).toHaveCount(0);
    await expect(
      page.getByText(/Giá trị đóng băng dùng giá EOD tại/),
    ).toBeVisible();

    // Meta đúng nguồn/chu kỳ của dòng tổng danh mục.
    await expect(
      page.getByText("Chu kỳ", { exact: true }).locator(".."),
    ).toContainText("MANUAL");
    await expect(
      page.getByText("Nguồn", { exact: true }).locator(".."),
    ).toContainText("AUTO");

    // Breakdown per-holding đúng dòng đã seed cùng mốc.
    await expect(page.getByText(symbol)).toBeVisible();
    await expect(
      page.getByText("Giá trị từng vị thế").locator("..").locator(".."),
    ).toContainText("1tr");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

test("cách ly quyền: user khác cố mở URL /snapshots/[id] của snapshot thuộc user A -> 404, không lộ dữ liệu", async ({
  browser,
}) => {
  const sessionA = await createTestSession("snapshot-detail-isolation-a");
  const sessionB = await createTestSession("snapshot-detail-isolation-b");
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await signInAs(contextA, sessionA.sessionToken);
  await signInAs(contextB, sessionB.sessionToken);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    const snapshotA = await db.snapshot.create({
      data: {
        userId: sessionA.userId,
        holdingId: null,
        date: daysAgo(10),
        value: "12345678",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });

    // Chính chủ mở được bình thường.
    await pageA.goto(`/snapshots/${snapshotA.id}`);
    await expect(
      pageA.getByText("NAV đã đóng băng").locator("..").locator(".."),
    ).toContainText("12.345.678");

    // User B (không liên quan) cố mở thẳng URL của snapshot A -> 404, không
    // lộ số liệu (cùng pattern "cách ly dữ liệu giữa hai tài khoản",
    // e2e/holdings.spec.ts).
    await pageB.goto(`/snapshots/${snapshotA.id}`);
    await expect(pageB.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(pageB.getByText("12.345.678")).toHaveCount(0);
  } finally {
    await closeContext(contextA);
    await closeContext(contextB);
    await cleanupTestUser(sessionA.userId);
    await cleanupTestUser(sessionB.userId);
  }
});

test("mở /snapshots/[id] khi holdingId không null hoặc snapshot không tồn tại -> 404", async ({
  browser,
}) => {
  const session = await createTestSession("snapshot-detail-guard");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const holding = await db.holding.create({
      data: {
        userId: session.userId,
        type: "STOCK",
        symbol,
        unit: "cổ phần",
      },
    });
    // Dòng per-holding (holdingId != null) không có trang chi tiết riêng —
    // chỉ xem được lồng bên trong dòng tổng (getSnapshotDetail 404 nếu
    // holdingId != null, cùng pattern getHoldingDetail).
    const holdingSnapshot = await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: holding.id,
        date: daysAgo(10),
        value: "999999",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });

    await page.goto(`/snapshots/${holdingSnapshot.id}`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await page.goto("/snapshots/does-not-exist");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

test("giá lịch sử khác giá hiện tại đủ ngưỡng -> hiện đúng recomputedComparison (3f, 'Nếu tính lại với giá mới')", async ({
  browser,
}) => {
  const session = await createTestSession("snapshot-recompute");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  // 3 mốc cách xa nhau (30/15/1 ngày trước) để tránh mọi nhập nhằng múi giờ
  // giữa "hôm nay" local (daysAgo) và "hôm nay" ICT (resolveCutoffDate) —
  // cùng kỹ thuật daysAgo(N) N lớn đã dùng ở dashboard.spec.ts/nav-override.spec.ts.
  const historicalQuoteDate = daysAgo(30);
  const snapshotDate = daysAgo(15);
  const currentQuoteDate = daysAgo(1);

  try {
    // Giá tại mốc chốt: 100.000 -> giá hiện tại (mới hơn): 150.000.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: historicalQuoteDate } },
      create: {
        symbol,
        date: historicalQuoteDate,
        price: "100000",
        source: "vnstock",
      },
      update: { price: "100000", source: "vnstock" },
    });
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: currentQuoteDate } },
      create: {
        symbol,
        date: currentQuoteDate,
        price: "150000",
        source: "vnstock",
      },
      update: { price: "150000", source: "vnstock" },
    });

    const holding = await db.holding.create({
      data: {
        userId: session.userId,
        type: "STOCK",
        symbol,
        unit: "cổ phần",
      },
    });

    // frozenValue = 1.000.000 = quantity(10) * historicalPrice(100.000).
    const aggregate = await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: null,
        date: snapshotDate,
        value: "1000000",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });
    await db.snapshot.create({
      data: {
        userId: session.userId,
        holdingId: holding.id,
        date: snapshotDate,
        value: "1000000",
        source: "AUTO",
        period: "MANUAL",
        frozen: true,
      },
    });

    await page.goto(`/snapshots/${aggregate.id}`);

    // Subtitle + banner đổi sang biến thể "giá đã đổi" (3f).
    await expect(page.getByText("Giá đã đổi từ khi chốt")).toBeVisible();
    await expect(
      page.getByText(/Giá thị trường đã cập nhật sau ngày chốt/),
    ).toBeVisible();

    // Khối so sánh: recomputed = 10 * 150.000 = 1.500.000, delta = 500.000.
    await expect(page.getByText("Nếu tính lại với giá mới")).toBeVisible();
    await expect(page.getByText("1,5tr").first()).toBeVisible();
    await expect(page.getByText(/500k/)).toBeVisible();

    // 3c (info banner "không đổi") KHÔNG hiện song song với 3f.
    await expect(
      page.getByText(/Giá trị đóng băng dùng giá EOD tại/),
    ).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: {
        symbol,
        date: { in: [historicalQuoteDate, currentQuoteDate] },
      },
    });
  }
});

// Issue #83 — load-more cursor-based cho "Các mốc đã chốt". SNAPSHOT_HISTORY_LIMIT
// = 20 (features/snapshots/queries.ts) nên trang đầu getSnapshotHistory() phải
// dừng đúng ở 20 dòng dù DB có nhiều hơn; getMoreSnapshotHistory() (Server
// Action loadMoreSnapshotHistory, gọi qua nút "Xem thêm") phải tải nốt phần
// còn lại, không trùng/thiếu dòng.
test("'Các mốc đã chốt': trang đầu dừng ở 20 dòng, bấm 'Xem thêm' tải nốt phần còn lại (issue #83)", async ({
  browser,
}) => {
  const session = await createTestSession("snapshot-history-load-more");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // 25 mốc THỦ CÔNG rời rạc, chỉ khác date/value — value = i triệu (i =
    // 1..25, i=25 mới nhất/i=1 cũ nhất) để mỗi dòng có "vân tay" riêng qua
    // formatMoney compact ("1tr".."25tr", tất cả khác nhau) — dùng để xác
    // nhận ĐÚNG dòng nào đã render, không chỉ đếm số lượng chung chung (đếm
    // đúng số nhưng lặp/thiếu dòng vẫn có thể trùng đếm nếu chỉ check count).
    const total = 25;
    await db.snapshot.createMany({
      data: Array.from({ length: total }, (_, idx) => {
        const i = idx + 1;
        return {
          userId: session.userId,
          holdingId: null,
          date: daysAgo(total + 1 - i),
          value: `${i * 1_000_000}`,
          source: "AUTO" as const,
          period: "PERIODIC" as const,
          frozen: true,
        };
      }),
    });

    await page.goto("/snapshots");

    // Trang đầu (desc theo date -> i=25..6, 20 dòng): dòng mới nhất (25tr) và
    // dòng cuối trang 1 (6tr) hiện; 5 dòng cũ nhất (5tr..1tr, thuộc trang 2)
    // CHƯA hiện.
    await expect(page.getByText("20 snapshot", { exact: true })).toBeVisible();
    await expect(page.getByText("25tr", { exact: true })).toBeVisible();
    await expect(page.getByText("6tr", { exact: true })).toBeVisible();
    await expect(page.getByText("5tr", { exact: true })).toHaveCount(0);
    await expect(page.getByText("1tr", { exact: true })).toHaveCount(0);

    const loadMoreButton = page.getByRole("button", { name: "Xem thêm" });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();

    // Sau khi tải thêm: đủ 25/25, 5 dòng còn lại hiện ra, nút "Xem thêm" biến
    // mất (nextCursor null — trang 2 chỉ có 5 dòng, ít hơn LIMIT nên
    // getMoreSnapshotHistory() trả hết trong 1 lần).
    await expect(page.getByText("25 snapshot", { exact: true })).toBeVisible();
    await expect(page.getByText("5tr", { exact: true })).toBeVisible();
    await expect(page.getByText("1tr", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem thêm" })).toHaveCount(0);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Issue #83 — nhãn cột biểu đồ NAV thêm năm ("T12/25" thay vì "T12") để phân
// biệt 2 mốc CÙNG tháng, KHÁC năm (trước fix: cả hai render cùng "T{tháng}",
// không phân biệt được trên trục biểu đồ).
test("Biểu đồ NAV gắn nhãn năm để phân biệt 2 mốc cùng tháng khác năm (issue #83)", async ({
  browser,
}) => {
  const session = await createTestSession("snapshot-history-chart-label");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // recentDate/oldDate lệch ĐÚNG 1 năm (cùng tháng/ngày) — tái hiện chính
    // xác ca 2 mốc cùng tháng khác năm. Tính label bằng ĐÚNG công thức production
    // (lib/snapshot-history.ts::buildSnapshotHistoryView) để test không phụ
    // thuộc múi giờ chạy CI — chỉ cần xác nhận 2 nhãn tính ra THỰC SỰ khác
    // nhau (nhờ hậu tố năm) và cả hai đều render đúng trên UI.
    const recentDate = daysAgo(20);
    const oldDate = new Date(recentDate);
    oldDate.setUTCFullYear(oldDate.getUTCFullYear() - 1);

    const recentLabel = `T${recentDate.getUTCMonth() + 1}/${String(
      recentDate.getUTCFullYear(),
    ).slice(-2)}`;
    const oldLabel = `T${oldDate.getUTCMonth() + 1}/${String(
      oldDate.getUTCFullYear(),
    ).slice(-2)}`;
    // Sanity trên chính test data — nếu 2 nhãn tình cờ trùng nhau (edge case
    // lịch), assertion bên dưới sẽ pass giả dù code label sai; chặn sớm ở đây.
    expect(recentLabel).not.toBe(oldLabel);

    await db.snapshot.createMany({
      data: [
        {
          userId: session.userId,
          holdingId: null,
          date: recentDate,
          value: "2000000",
          source: "AUTO" as const,
          period: "PERIODIC" as const,
          frozen: true,
        },
        {
          userId: session.userId,
          holdingId: null,
          date: oldDate,
          value: "1000000",
          source: "AUTO" as const,
          period: "PERIODIC" as const,
          frozen: true,
        },
      ],
    });

    await page.goto("/snapshots");

    // Trước fix #83, cả 2 nhãn này render giống hệt "T{tháng}" (không có hậu
    // tố năm) -> getByText(recentLabel với "/YY") sẽ KHÔNG tìm thấy phần tử
    // nào, test fail đúng như kỳ vọng nếu suffix năm bị revert.
    await expect(page.getByText(recentLabel, { exact: true })).toBeVisible();
    await expect(page.getByText(oldLabel, { exact: true })).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
