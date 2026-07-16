import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

import { daysAgo, isoDate } from "./support/dates";
import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";
import { afterTransactionUrl, stripQuery } from "./support/urls";

// `DIVIDEND_TAX_RATE`/`DIVIDEND_PAR_VALUE` (Setting, docs/domain/03-dividends.md)
// KHÔNG được seed tự động cho DB e2e — scripts/e2e.mjs chỉ `prisma migrate
// deploy`, không chạy `pnpm db:seed` (khác DB dev). Thiếu 2 key này,
// resolveDecimalSetting() (features/dividends/actions.ts + page.tsx) throw
// AppError ngay lúc render -> trang /dividends/new sập. Seed trực tiếp qua
// Prisma trước cả file — không cleanup vì Setting không scoped theo user, giữ
// lại vô hại cho lần chạy sau (idempotent upsert, giống PriceQuote ở
// nav-override.spec.ts).
const db = new PrismaClient();
const DIVIDEND_SETTING_BASELINE = new Date("2020-01-01");

// `fullyParallel: true` (playwright.config.ts) có thể phân test của file này
// ra NHIỀU worker -> test.beforeAll chạy một lần MỖI worker, không phải một
// lần duy nhất cho cả file. Nhiều worker cùng upsert() một dòng chưa tồn tại
// đua nhau INSERT -> P2002 (unique constraint) dù dùng upsert (không atomic
// tuyệt đối dưới race thật). Coi P2002 là "đã có worker khác seed xong" — bỏ
// qua, không phải lỗi.
async function upsertSettingIgnoringRace(
  data: Prisma.SettingCreateInput & { key: string; effectiveFrom: Date },
) {
  try {
    await db.setting.upsert({
      where: {
        key_effectiveFrom: {
          key: data.key,
          effectiveFrom: data.effectiveFrom,
        },
      },
      update: {},
      create: data,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}

async function seedDividendSettings() {
  await upsertSettingIgnoringRace({
    key: "DIVIDEND_TAX_RATE",
    value: "5",
    valueType: "DECIMAL",
    label: "Thuế cổ tức tiền mặt (%)",
    group: "TAX",
    unit: "%",
    effectiveFrom: DIVIDEND_SETTING_BASELINE,
  });
  await upsertSettingIgnoringRace({
    key: "DIVIDEND_PAR_VALUE",
    value: "10000",
    valueType: "DECIMAL",
    label: "Mệnh giá cổ tức (đ/CP)",
    group: "TAX",
    unit: "đ/CP",
    effectiveFrom: DIVIDEND_SETTING_BASELINE,
  });
}

test.beforeAll(async () => {
  await seedDividendSettings();
});

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

// Tạo Holding STOCK qua UI (form /holdings/new mặc định type STOCK, unit "cổ
// phần" đã điền sẵn — cùng pattern holdings.spec.ts) rồi trả về URL chi tiết
// đã bỏ query `?cashflowId=...`.
async function createStockHolding(
  page: import("@playwright/test").Page,
  symbol: string,
  quantity: string,
) {
  await page.goto("/holdings/new");
  await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
  await page.locator('input[name="quantity"]').fill(quantity);
  await page.locator('input[name="pricePerUnit"]').fill("50000");
  await page.getByRole("button", { name: "Xong", exact: true }).click();
  // waitForURL cần base URL trước khi biết nó — chờ pattern chung rồi mới
  // stripQuery ra base thật (afterTransactionUrl cần base URL làm input).
  await page.waitForURL(/\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/);
  const holdingUrl = stripQuery(page.url());
  return holdingUrl;
}

test("Ghi cổ tức tiền mặt: tự tính gộp/thuế/thực nhận, hiện đúng trong lịch sử", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-cash");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // 100 CP, mệnh giá 10.000đ, tỷ lệ 10% -> gộp = 10.000 × 10% × 100 =
    // 100.000; thuế 5% = 5.000; net = 95.000 (docs/domain/03-dividends.md).
    const holdingUrl = await createStockHolding(page, "FPT", "100");

    await page.goto(`${holdingUrl}/dividends/new`);
    // "Tiền mặt" là lựa chọn mặc định của SegmentedControl -> không cần bấm.
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(page.getByText(/Đã ghi cổ tức FPT/)).toBeVisible();
    await expect(page.getByText(/gộp 100\.000/)).toBeVisible();
    await expect(page.getByText(/thuế 5\.000/)).toBeVisible();
    await expect(page.getByText(/95\.000/)).toBeVisible();

    // Lịch sử: percentLabel suy ngược từ grossAmount/mệnh giá (Dividend không
    // lưu percent trực tiếp) -> phải khớp lại đúng 10% đã nhập.
    await page.getByRole("link", { name: "Xem lịch sử cổ tức" }).click();
    await page.waitForURL(`${holdingUrl}/dividends`);
    await expect(page.getByText("Tiền mặt 10%")).toBeVisible();
    await expect(page.getByText("+95k", { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
  }
});

// Issue #52 fix (process/DECISION.md 2026-07-16 (2)): stockQuantity làm tròn
// XUỐNG (floor) khi lẻ, kèm label báo đã làm tròn — cổ phiếu không chia lẻ.
test("Ghi cổ tức cổ phiếu: số lẻ tự làm tròn xuống, báo rõ + cộng đúng vào SL nắm giữ", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-stock-floor");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // 105 CP × 12% = 12,6 -> floor 12 (ví dụ đúng của docs/domain/03-dividends.md).
    const holdingUrl = await createStockHolding(page, "MSN", "105");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("12");

    // Preview (trước khi ghi) đã báo làm tròn ngay khi gõ %.
    await expect(
      page.getByText(/Đã làm tròn xuống từ 12,6 cổ phần/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(page.getByText(/Đã ghi cổ tức MSN/)).toBeVisible();
    await expect(
      page.getByText("+12 cổ phần thưởng", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("117 cổ phần", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Đã làm tròn xuống từ 12,6 cổ phần/),
    ).toBeVisible();

    // Xác nhận cache Holding.quantity đã cộng đúng số ĐÃ LÀM TRÒN (12, không
    // phải 12,6) qua CẢ 2 kênh: trang chi tiết vị thế (hard nav, loại trừ
    // cache client-side) và lịch sử cổ tức — trước fix #59, getHoldingDetail()
    // dùng derivePosition(cashflows) (chỉ biết Cashflow) nên hiện SAI SL sau
    // khi nhận cổ tức cổ phiếu; giờ dùng derivePositionIncludingStockDividends()
    // nên phải khớp đúng cache.
    await page.goto(holdingUrl);
    await expect(page.getByText("117 cổ phần", { exact: true })).toBeVisible();

    await page.goto(`${holdingUrl}/dividends`);
    await expect(page.getByText("Cổ phiếu 11%")).toBeVisible();
    await expect(page.getByText(/105 cổ phần → 117 cổ phần/)).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
  }
});

// Issue #52 fix: cho phép user tự sửa số lượng khi công ty phát hành áp quy
// ước làm tròn khác công thức tuyến tính của app — validate tolerance 2 đơn
// vị so với số RAW (chưa làm tròn) tính từ %.
test("Ghi cổ tức cổ phiếu: cho phép chỉnh tay số lượng, chặn khi lệch quá 2 đơn vị", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-stock-override");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // 105 CP × 12% = raw 12,6 -> tolerance cho phép override trong [10,6; 14,6].
    const holdingUrl = await createStockHolding(page, "VNM", "105");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("12");
    await page
      .getByRole("button", { name: "Sửa số lượng nếu công ty làm tròn khác" })
      .click();

    const submitButton = page.getByRole("button", {
      name: "Ghi cổ tức",
      exact: true,
    });
    const overrideInput = page.locator('input[name="stockQuantityOverride"]');

    // Lệch 7,4 đơn vị so với raw 12,6 -> vượt tolerance 2, chặn submit.
    await overrideInput.fill("20");
    await expect(page.getByText(/Chỉ được lệch tối đa 2 đơn vị/)).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Lệch 1,4 đơn vị -> trong tolerance, submit được, dùng ĐÚNG số user nhập
    // (không phải số hệ thống floor 12).
    await overrideInput.fill("14");
    await expect(page.getByText(/Chỉ được lệch tối đa 2 đơn vị/)).toHaveCount(
      0,
    );
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText(/Đã ghi cổ tức VNM/)).toBeVisible();
    await expect(
      page.getByText("+14 cổ phần thưởng", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("119 cổ phần", { exact: true })).toBeVisible();
    // User đã tự chỉnh -> KHÔNG hiện label "đã làm tròn" (chỉ hiện khi hệ
    // thống tự floor, xem features/dividends/actions.ts::recordDividend).
    await expect(page.getByText(/Đã làm tròn xuống từ/)).toHaveCount(0);

    // Lịch sử: percentLabel suy ngược từ SỐ ĐÃ LƯU (14/105 ≈ 13%), không phải
    // % gốc đã nhập (12%) — đúng thiết kế "Dividend không lưu percent trực tiếp".
    await page.getByRole("link", { name: "Xem lịch sử cổ tức" }).click();
    await page.waitForURL(`${holdingUrl}/dividends`);
    await expect(page.getByText("Cổ phiếu 13%")).toBeVisible();
    await expect(page.getByText(/105 cổ phần → 119 cổ phần/)).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
  }
});

// Issue #59 (khoá lại bằng e2e sau khi sửa src/lib/cost-basis.ts +
// src/features/holdings/actions.ts/queries.ts): trước fix, derivePosition()
// chỉ biết Cashflow, nên (1) trang chi tiết vị thế hiện SAI SL ngay sau khi
// nhận cổ tức cổ phiếu, và (2) mọi giao dịch mua/bán SAU ĐÓ ghi đè cache bằng
// kết quả derivePosition() cashflow-only, XOÁ MẤT phần cổ tức cổ phiếu đã
// cộng — có thể khiến một lệnh bán hợp lệ (SL bán nằm trong phần cổ tức) bị
// chặn nhầm "bán vượt quá số lượng đang giữ".
test("Cổ tức cổ phiếu: SL hiện đúng ngay sau khi ghi, không bị giao dịch sau đó ghi đè mất, bán vượt cashflow-only nhưng hợp lệ nhờ cổ tức vẫn được chấp nhận", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-position-consistency");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  try {
    // 100 CP × 10% = 10 CP thưởng (số tròn, không lẫn chủ đề làm tròn của 2 test trên).
    const holdingUrl = await createStockHolding(page, "HPG", "100");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();
    await expect(page.getByText(/Đã ghi cổ tức HPG/)).toBeVisible();

    // (1) Trang chi tiết vị thế phải hiện ĐÚNG 110 CP ngay sau khi ghi — hard
    // navigation (page.goto, không phải click Link) để loại trừ mọi nghi ngờ
    // về cache client-side, chỉ còn lại đúng phép tính server-side.
    await page.goto(holdingUrl);
    await expect(page.getByText("110 cổ phần", { exact: true })).toBeVisible();

    // (2) Bán 105 CP — CHỈ hợp lệ nếu tính cả 10 CP cổ tức (100 mua-only
    // không đủ). Trước fix: derivePosition() cashflow-only sẽ SAI báo "bán
    // vượt quá số lượng đang giữ" cho lệnh bán hợp lệ này.
    await page.goto(`${holdingUrl}/transactions/new`);
    await page.getByRole("button", { name: "Bán" }).click();
    await page.locator('input[name="quantity"]').fill("105");
    await page.locator('input[name="pricePerUnit"]').fill("60000");
    await page.getByRole("button", { name: "Ghi nhận giao dịch bán" }).click();
    await page.waitForURL(afterTransactionUrl(holdingUrl));

    // Bán thành công (không bị chặn nhầm) VÀ cache không bị ghi đè mất 10 CP
    // cổ tức: 100 + 10 − 105 = 5 CP — KHÔNG PHẢI 0 (nếu cache bị ghi đè mất
    // phần cổ tức trước khi trừ) hay bị chặn hoàn toàn (nếu wentNegative sai).
    await expect(page.getByText("5 cổ phần", { exact: true })).toBeVisible();

    // avgCost không đổi qua cả cổ tức (miễn phí, không có giá) lẫn SELL
    // (phương pháp bình quân di động, chỉ BUY mới recompute) — vẫn đúng 50k
    // (giá mua duy nhất, từ createStockHolding).
    const avgCostAfterSell = await page
      .locator("text=/Giá vốn bình quân/")
      .locator("..")
      .innerText();
    expect(avgCostAfterSell).toContain("50k");
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
  }
});

// Fix (business-implementer, verify 2026-07-16): DividendRecordedResult.
// xirrBeforePercent/xirrAfterPercent/totalDividendReceived trước đây LUÔN
// undefined (getCurrentPortfolioXirrPercent() chưa tồn tại) nên khối "Ảnh
// hưởng lên hiệu suất" (mockup Phase 4 Screens, 4d) không bao giờ render. Cần
// PriceQuote + Cashflow đủ xa "hôm nay" để dòng tiền giả định NAV (ghép tại
// cutoffDate) hội tụ được XIRR (cùng lý do dashboard.spec.ts) — một Holding
// chỉ có 1 BUY không giá tự động sẽ luôn NO_POSITIVE_FLOW/NO_CONVERGE ở CẢ
// before lẫn after, khối này sẽ luôn ẩn và không verify được gì.
test("Ghi cổ tức tiền mặt: hiện khối XIRR danh mục trước/sau + tổng cổ tức đã nhận", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-xirr-impact");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Seed PriceQuote TRƯỚC Holding — thứ tự quan trọng, cùng lý do
    // dashboard.spec.ts (tránh unstable_cache ghim "thiếu giá").
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "100000", source: "vnstock" },
      update: { price: "100000", source: "vnstock" },
    });

    // Mua 10 <symbol> @ 90.000 cách đây ~2 năm — đủ xa "hôm nay" để dòng tiền
    // giả định NAV (ghép tại cutoffDate = hôm nay) hội tụ được, tránh ca biên
    // "kỳ rất ngắn" (docs/domain/05, cùng lý do dashboard.spec.ts).
    const buyDate = isoDate(daysAgo(730));
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("10");
    await page.locator('input[name="pricePerUnit"]').fill("90000");
    await page.locator('input[name="date"]').fill(buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    const holdingUrl = stripQuery(page.url());

    // 10% × 10.000đ mệnh giá × 10 CP = gộp 10.000, thuế 5% = 500, net = 9.500
    // (docs/domain/03-dividends.md) — lần đầu ghi cổ tức của holding này nên
    // totalDividendReceived (tổng lịch sử) phải bằng đúng net vừa tính.
    await page.goto(`${holdingUrl}/dividends/new`);
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    // Khối "Ảnh hưởng lên hiệu suất" (mockup 4d) — trước fix luôn ẩn.
    await expect(page.getByText("Ảnh hưởng lên hiệu suất")).toBeVisible();
    await expect(page.getByText("XIRR danh mục")).toBeVisible();

    // "xx,x% → yy,y%" nằm nguyên trong 1 span (DividendForm.tsx) — không
    // assert giá trị tuyệt đối (phụ thuộc ngày chạy test), chỉ verify đúng
    // định dạng (formatXirrBarePercent, lib/format.ts) và before != after
    // (dividend vừa ghi phải làm XIRR đổi, không phải hiện lặp lại 1 số).
    const xirrValue = page.getByText(/^\d+,\d% → \d+,\d%$/);
    await expect(xirrValue).toBeVisible();
    const xirrText = await xirrValue.innerText();
    const match = xirrText.match(/^(\d+,\d)% → (\d+,\d)%$/);
    expect(match).not.toBeNull();
    expect(match?.[1]).not.toBe(match?.[2]);

    // Tổng cổ tức đã nhận — lần đầu nên bằng đúng net (9.500 -> compact
    // "9,5k", formatMoney compact, lib/format.ts).
    await expect(page.getByText(`Tổng cổ tức ${symbol} đã nhận`)).toBeVisible();
    await expect(page.getByText("9,5k", { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});
