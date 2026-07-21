import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

import { daysAgo, isoDate } from "./support/dates";
import { fillDatePicker } from "./support/date-picker";
import {
  cleanupTestUser,
  closeContext,
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
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Issue #77 criterion 1 (src/lib/revalidate-holding-routes.ts::revalidateHoldingDependentRoutes):
// khoá lại đúng câu chữ tiêu chí "ghi cổ tức -> soft-nav -> Dashboard/holdings thấy số
// cập nhật" — spec PHẢI dùng toàn bộ Link click sau lần page.goto đầu tiên (tạo Holding),
// không page.goto ở giữa (tương đương mở tab mới, tự xoá sạch Router Cache trong bộ nhớ,
// không phản ánh đúng trải nghiệm soft-nav thật — cùng nguyên tắc cutoff.spec.ts).
//
// MINH BẠCH về giới hạn: đã thử tạm bỏ revalidateHoldingDependentRoutes(holdingId) khỏi
// recordDividend để xem spec có FAIL đúng chỗ không (như cutoff.spec.ts tự verify được) —
// KHÔNG tái hiện được staleness qua kịch bản Link-click tuần tự này (spec vẫn pass dù bỏ
// dòng đó), nhiều khả năng vì Next.js 16 mặc định `staleTimes.dynamic = 0` (không cache
// segment dynamic phía client) + Server Action tự trigger refresh client cache của chính
// session đang thao tác, nên round-trip qua chính 1 tab/1 user không lộ được gap mà
// revalidatePath xử lý (gap đó có thể chỉ lộ ở tab/session KHÁC, hoặc ở tầng cache khác
// production mới có, vd CDN/edge — chưa verify được ở đây). Giữ lại vì spec vẫn khoá đúng
// hành vi MONG MUỐN theo tiêu chí #77 (không phải giả — có chạy thật, có seed dữ liệu thật),
// chỉ KHÔNG có bằng chứng nó sẽ đỏ nếu revalidateHoldingDependentRoutes() bị revert sau này.
//
// LƯU Ý khi chọn tín hiệu để assert "đã cập nhật": ghi cổ tức CỔ PHIẾU khi đã có
// giá cũ tự tạo NavOverride bù pha loãng (giá mới = giá cũ × SL_trước/SL_sau,
// xem dividend-math.ts + test "Ghi cổ tức cổ phiếu khi đã có giá cũ..." ở trên) —
// GIỮ NGUYÊN tổng giá trị SL×giá, nên NAV KHÔNG đổi (100×150.000 = 110×136.364 ≈
// 15.000.000 cả trước lẫn sau, đây là hành vi domain đúng, không phải cache cũ).
// Tín hiệu đáng tin để phân biệt cũ/mới ở đây là NGUỒN GIÁ: trước cổ tức toàn bộ
// AUTO (PriceQuote), sau cổ tức holding này chuyển MANUAL (NavOverride vừa tạo,
// cùng ngày nên thắng theo resolvePrice()) — getPriceFreshnessNote() phản ánh qua
// hậu tố "· N mã dùng giá nhập tay" (portfolio-valuation.ts).
test("Ghi cổ tức cổ phiếu: soft-nav quay lại /holdings và Dashboard vẫn thấy số liệu mới, không dính Router Cache cũ (issue #77)", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-revalidate-soft-nav");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);

  try {
    // Giá 150.000/CP (AUTO, PriceQuote), 100 CP -> NAV = 15.000.000.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "150000", source: "vnstock" },
      update: { price: "150000", source: "vnstock" },
    });

    const holdingUrl = await createStockHolding(page, symbol, "100");

    // Ghé /holdings rồi Dashboard TRƯỚC khi ghi cổ tức, toàn bộ qua Link click
    // (PageHeader "Quay lại" -> BottomNav "Tổng quan") -> ghim Router Cache với
    // trạng thái CŨ (100 cổ phần, toàn bộ giá AUTO — chưa có "mã dùng giá nhập tay").
    // HoldingsGroupCard ghép SL + giá chung 1 dòng ("100 cổ phần · giá 150k")
    // -> không dùng exact:true (khác holding detail, nơi SL đứng riêng 1 dòng).
    await page.getByRole("link", { name: "Quay lại" }).click();
    await page.waitForURL(/\/holdings$/);
    await expect(page.getByText("100 cổ phần")).toBeVisible();

    await page.getByRole("link", { name: "Tổng quan" }).click();
    await page.waitForURL(/\/$/);
    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("15.000.000");
    await expect(page.getByText(/mã dùng giá nhập tay/)).toHaveCount(0);

    // Quay lại holding qua toàn Link click (Danh mục -> chọn mã -> Ghi cổ tức),
    // không page.goto — giữ nguyên Router Cache đã ghim ở trên.
    await page.getByRole("link", { name: "Danh mục" }).click();
    await page.waitForURL(/\/holdings$/);
    await page.getByText(symbol, { exact: true }).click();
    await page.waitForURL(holdingUrl);
    await page.getByRole("link", { name: "Ghi cổ tức" }).click();
    await page.waitForURL(`${holdingUrl}/dividends/new`);

    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();
    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();
    await expect(
      page.getByText("+10 cổ phần thưởng", { exact: true }),
    ).toBeVisible();

    // Soft-nav "Về chi tiết" -> holding detail: PHẢI thấy badge nguồn giá đổi
    // "Tự động" -> "Nhập tay" (NavOverride bù pha loãng vừa tạo cùng ngày, thắng
    // PriceQuote 7 ngày trước theo resolvePrice()) — không phải page.goto/reload.
    await page
      .getByRole("link", { name: new RegExp(`Về chi tiết ${symbol}`) })
      .click();
    await page.waitForURL(holdingUrl);
    await expect(page.getByText("Nhập tay", { exact: true })).toBeVisible();

    // "Quay lại" -> /holdings: PHẢI thấy 110 cổ phần (không phải 100 cũ đã ghim
    // Router Cache ở trên) dù không hề page.goto/reload.
    await page.getByRole("link", { name: "Quay lại" }).click();
    await page.waitForURL(/\/holdings$/);
    await expect(page.getByText("110 cổ phần")).toBeVisible();
    await expect(page.getByText("100 cổ phần")).toHaveCount(0);

    // Soft-nav sang Dashboard: PHẢI thấy ghi chú nguồn giá cập nhật "1 mã dùng
    // giá nhập tay" (không còn 0 như đã ghim Router Cache ở trên).
    await page.getByRole("link", { name: "Tổng quan" }).click();
    await page.waitForURL(/\/$/);
    await expect(page.getByText("1 mã dùng giá nhập tay")).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
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
    await closeContext(context);
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
    await closeContext(context);
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
    await closeContext(context);
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
    await fillDatePicker(page, "date", buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    const holdingUrl = stripQuery(page.url());

    // 100% × 10.000đ mệnh giá × 10 CP = gộp 100.000, thuế 5% = 5.000, net =
    // 95.000 (docs/domain/03-dividends.md) — lần đầu ghi cổ tức của holding
    // này nên totalDividendReceived (tổng lịch sử) phải bằng đúng net vừa
    // tính. Tỷ lệ 100% (thay vì 10%) cố ý chọn LỚN — với vị thế mua cách đây
    // 730 ngày, cổ tức phải đủ lớn so với vốn để phần "before != after" ở
    // dưới không bị trùng số do làm tròn 1 chữ số thập phân (100% dư margin
    // ~0.26pp so với ngưỡng làm tròn 0.05pp, ổn định bất kể ngày chạy test).
    await page.goto(`${holdingUrl}/dividends/new`);
    await page.locator('input[name="percent"]').fill("100");
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

    // Tổng cổ tức đã nhận — lần đầu nên bằng đúng net (95.000 -> compact
    // "95k", formatMoney compact, lib/format.ts).
    await expect(page.getByText(`Tổng cổ tức ${symbol} đã nhận`)).toBeVisible();
    await expect(page.getByText("95k", { exact: true })).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Issue #61: ghi cổ tức TIỀN MẶT thổi phồng NAV tạm thời (tiền rời khỏi vốn
// công ty nhưng PriceQuote/NavOverride chưa kịp phản ánh) -> recordDividend
// TỰ tạo NavOverride bù pha loãng, ghi TẠI `date` (ngày chia), trừ đúng
// grossAmount/CP (GỘP, trước thuế — xem dividend-math.ts::computeCashDividendPriceAdjustment)
// khỏi giá cũ.
test("Ghi cổ tức tiền mặt khi đã có giá cũ: tự tạo NavOverride bù pha loãng theo đúng công thức", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-nav-adjust-cash");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(30);

  try {
    // Giá cũ 50.000/CP, đủ xa trước ngày chia (hôm nay, mặc định của form) để
    // chắc chắn là giá "cũ" dùng làm gốc điều chỉnh.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "50000", source: "vnstock" },
      update: { price: "50000", source: "vnstock" },
    });

    // 100 CP, tỷ lệ 10%, mệnh giá 10.000, thuế 5% (seedDividendSettings) ->
    // grossAmount = 10.000 × 10% × 100 = 100.000 -> 1.000/CP -> giá mới =
    // 50.000 − 1.000 = 49.000.
    const holdingUrl = await createStockHolding(page, symbol, "100");
    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    await page.goto(`${holdingUrl}/dividends/new`);
    // "Tiền mặt" là mặc định -> không cần bấm SegmentedControl.
    // KHÔNG tick "giá đã phản ánh thị trường" (chưa có checkbox thật trong UI
    // — design-implementer sẽ thêm; mặc định form submit
    // priceAlreadyReflectsMarket=undefined -> schema default "false", đúng
    // hành vi "không tick").
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    const override = await db.navOverride.findFirst({
      where: { holdingId },
      orderBy: { date: "desc" },
    });
    expect(override).not.toBeNull();
    expect(new Decimal(override!.price.toString()).toString()).toBe("49000");
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Issue #61: user tick "giá đã phản ánh thị trường" (vd đã tự cập nhật giá
// tay, hoặc job giá đã chạy lại) -> recordDividend bỏ qua HOÀN TOÀN bước tự
// điều chỉnh, dù có giá cũ để tính. UI checkbox thật (DividendForm.tsx, submit
// qua hidden input `priceAlreadyReflectsMarket` "true"/"false") giờ đã có —
// tương tác checkbox thật thay vì page.evaluate() inject hidden input (cách
// verifier tự cập nhật theo đúng comment DECISION.md 2026-07-17: "sẽ đổi sang
// tương tác checkbox thật khi UI xong").
test("Ghi cổ tức cổ phiếu: tick “giá đã phản ánh thị trường” -> KHÔNG tự tạo NavOverride dù có giá cũ", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-nav-adjust-skip");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(30);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "50000", source: "vnstock" },
      update: { price: "50000", source: "vnstock" },
    });

    const holdingUrl = await createStockHolding(page, symbol, "100");
    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");

    // Checkbox thật (DividendForm.tsx) — accessible name lấy từ text trong
    // cùng <label> bao input. `force: true` vì input là "peer sr-only"
    // (CSS ẩn, kích thước ~1px) — actionability check của Playwright coi
    // chính <label> bao ngoài "che" input tại điểm hit-test, dù người dùng
    // thật click vào label vẫn toggle checkbox bình thường qua cơ chế native
    // label-for (pattern chuẩn cho custom checkbox ẩn input + span trang trí).
    await page
      .getByRole("checkbox", { name: "Giá hiện tại đã phản ánh đợt chia này" })
      .check({ force: true });

    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();
    // Tick checkbox -> Server Action bỏ qua bước tự điều chỉnh -> khối "Giá
    // đã tự động điều chỉnh" (DividendForm.tsx::DividendSuccessContent)
    // KHÔNG được render.
    await expect(page.getByText("Giá đã tự động điều chỉnh")).toHaveCount(0);

    const override = await db.navOverride.findFirst({ where: { holdingId } });
    expect(override).toBeNull();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Issue #61: ghi cổ tức CỔ PHIẾU không tick checkbox, có giá cũ -> tự tạo
// NavOverride bù pha loãng theo công thức giá_mới = giá_cũ × SL_trước / SL_sau
// (dividend-math.ts::computeStockDividendPriceAdjustment) — giữ nguyên TỔNG
// GIÁ TRỊ trước/sau. Bổ sung coverage còn thiếu: các test STOCK hiện có (dòng
// trên) chỉ verify case CASH không tick + case STOCK tick (bỏ qua), chưa có
// case STOCK không tick.
test("Ghi cổ tức cổ phiếu khi đã có giá cũ, không tick checkbox: tự tạo NavOverride giữ nguyên tổng giá trị", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-nav-adjust-stock");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(30);

  try {
    // Giá cũ 60.000/CP, đủ xa trước ngày chia (hôm nay, mặc định form).
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "60000", source: "vnstock" },
      update: { price: "60000", source: "vnstock" },
    });

    // 100 CP, tỷ lệ 10% -> stockQuantity thưởng = 10 (tròn sẵn, không lẫn chủ
    // đề làm tròn) -> SL_trước = 100, SL_sau = 110 -> giá mới = 60.000 × 100 /
    // 110 = 54.545,4545... — dùng Decimal.js (không round số nguyên) để khớp
    // đúng công thức thuần, không hardcode chuỗi làm tròn tay có thể sai lệch
    // độ chính xác so với dividend-math.ts.
    const holdingUrl = await createStockHolding(page, symbol, "100");
    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");
    // KHÔNG tick checkbox — mặc định false, đúng hành vi "tự điều chỉnh".
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    const override = await db.navOverride.findFirst({
      where: { holdingId },
      orderBy: { date: "desc" },
    });
    expect(override).not.toBeNull();

    // NavOverride.price là @db.Decimal(20, 4) (prisma/schema.prisma) -> giá
    // trả về từ dividend-math.ts (full precision) bị Postgres làm tròn còn 4
    // chữ số thập phân khi lưu -> so khớp với giá trị ĐÃ làm tròn 4dp (không
    // phải full-precision) để không fail giả do sai khác độ chính xác lưu trữ.
    const expectedNewPrice = new Decimal(60000)
      .mul(100)
      .div(110)
      .toDecimalPlaces(4)
      .toString();
    expect(new Decimal(override!.price.toString()).toString()).toBe(
      expectedNewPrice,
    );

    // Bất biến cốt lõi của công thức (docs/domain/03-dividends.md "Bù pha
    // loãng NAV"): tổng giá trị SL×giá giữ nguyên trước/sau — cho phép sai số
    // nhỏ (<= 0.01) phát sinh từ việc giá/CP bị làm tròn còn 4dp khi lưu
    // (110 CP × tối đa 0,00005 lệch/CP ≈ 0,0055).
    const valueBefore = new Decimal(60000).mul(100);
    const valueAfter = new Decimal(override!.price.toString()).mul(110);
    expect(valueAfter.minus(valueBefore).abs().lte(0.01)).toBe(true);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Review PR #62 finding #4: ghi 2 lần cổ tức CỔ PHIẾU cùng vị thế, CÙNG ngày
// chia (mặc định form luôn là hôm nay, không đổi giữa 2 lần submit) -> lần
// sau phải TÍNH TIẾP trên giá đã điều chỉnh của lần trước (resolveOldPriceInTx
// đọc lại NavOverride vừa ghi làm "giá cũ", mới hơn PriceQuote gốc) và
// `navOverride.upsert` theo (holdingId, date) phải cập nhật ĐÚNG 1 dòng, không
// tạo trùng. Hành vi domino này đã tự tay verify thủ công (không phải giả
// định) nhưng trước đây chưa có test khoá lại — thêm ở đây để refactor sau
// không lỡ làm hỏng mà không ai biết.
test("Ghi cổ tức cổ phiếu 2 lần cùng ngày chia trên cùng vị thế: lần sau tính tiếp trên giá đã điều chỉnh của lần trước, không tạo NavOverride trùng", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-nav-adjust-compound");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(30);

  try {
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "60000", source: "vnstock" },
      update: { price: "60000", source: "vnstock" },
    });

    const holdingUrl = await createStockHolding(page, symbol, "100");
    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    // Lần 1: 100 CP, 10% -> SL_trước=100, SL_sau=110, giá mới = 60.000×100/110
    // (giống test STOCK không-tick ở trên).
    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();
    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    const firstOverride = await db.navOverride.findFirst({
      where: { holdingId },
    });
    expect(firstOverride).not.toBeNull();

    // Lần 2: CÙNG ngày chia -> "giá cũ" đọc lại NavOverride vừa ghi ở lần 1
    // (mới hơn PriceQuote gốc 30 ngày trước). SL_trước lần 2 = 110 (100 gốc +
    // 10 thưởng lần 1, đã cộng vào Holding.quantity) -> thưởng lần 2 = 11 ->
    // SL_sau = 121.
    await page.goto(`${holdingUrl}/dividends/new`);
    await page.getByRole("button", { name: "Cổ phiếu", exact: true }).click();
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();
    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    const overridesAfterSecond = await db.navOverride.findMany({
      where: { holdingId },
    });
    // upsert theo (holdingId, date) — cùng ngày chia cả 2 lần -> vẫn đúng 1
    // dòng duy nhất, không tạo trùng.
    expect(overridesAfterSecond).toHaveLength(1);

    const expectedSecondPrice = new Decimal(firstOverride!.price.toString())
      .mul(110)
      .div(121)
      .toDecimalPlaces(4)
      .toString();
    expect(
      new Decimal(overridesAfterSecond[0]!.price.toString()).toString(),
    ).toBe(expectedSecondPrice);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});

// Issue #61: Holding chưa có giá nào (MISSING_PRICE — không PriceQuote lẫn
// NavOverride) -> ghi cổ tức vẫn thành công bình thường, resolveOldPriceInTx
// trả null nên KHÔNG tạo NavOverride nào (không có gì để điều chỉnh).
test("Ghi cổ tức tiền mặt khi Holding chưa có giá nào: vẫn ghi được, không tạo NavOverride", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-nav-adjust-missing");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    // Không seed PriceQuote nào cho symbol này -> MISSING_PRICE.
    const holdingUrl = await createStockHolding(page, symbol, "100");
    const holdingId = holdingUrl.split("/").filter(Boolean).pop();
    if (!holdingId) throw new Error("Không lấy được holdingId từ URL");

    await page.goto(`${holdingUrl}/dividends/new`);
    await page.locator('input[name="percent"]').fill("10");
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();

    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    const override = await db.navOverride.findFirst({ where: { holdingId } });
    expect(override).toBeNull();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Issue #65: mốc dòng tiền XIRR của cổ tức CASH chuyển từ `date` (ngày chia)
// sang `paymentDate ?? date` (tiền thực về, fallback khi bỏ trống) —
// src/lib/xirr-cashflow.ts, src/lib/portfolio-valuation.ts,
// src/features/holdings/queries.ts. xirr-cashflow.test.ts đã khoá chặt hàm
// PURE buildXirrCashflows, nhưng KHÔNG đủ để bắt lỗi nối dây: nếu queries.ts
// lỡ quên select `paymentDate` từ DB hay quên truyền xuống
// buildXirrCashflows, unit test (test hàm cô lập, tự tạo input tay) vẫn xanh
// trong khi người dùng thật KHÔNG BAO GIỜ thấy hiệu ứng trên UI. Test này
// khoá lại đúng đường dây thật: input `paymentDate` (DatePicker,
// DividendForm.tsx) -> Server Action recordDividend -> Dividend.paymentDate
// (DB) -> queries.ts đọc lại -> buildXirrCashflows -> XIRR hiện ở trang chi
// tiết vị thế (ReturnMetrics).
//
// Thiết kế: 2 Holding giống hệt nhau (cùng SL, giá mua, ngày mua, PriceQuote,
// % cổ tức, CÙNG ngày chia `date`) — chỉ khác đúng MỘT biến: Holding A để
// trống `paymentDate` (fallback `date`), Holding B điền `paymentDate` trễ 200
// ngày so với `date`. Nếu wiring đúng, XIRR hai bên PHẢI khác nhau (dòng tiền
// cổ tức bị dịch mốc 200 ngày trong công thức chiết khấu Newton-Raphson) —
// nếu bị revert (cả hai đều dùng `date`, giống hệt nhau), XIRR A và B sẽ
// trùng khớp tuyệt đối -> test fail rõ ràng, không mập mờ ("test này sẽ fail
// nếu phần vừa sửa bị revert" — có, chắc chắn).
test("Cổ tức tiền mặt có paymentDate trễ hơn ngày chia làm thay đổi XIRR hiển thị ở trang chi tiết vị thế (issue #65)", async ({
  browser,
}) => {
  const session = await createTestSession("dividend-paymentdate-xirr");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbolA = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const symbolB = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(7);
  const buyDate = isoDate(daysAgo(730));
  const dividendDate = isoDate(daysAgo(400)); // ngày chia — GIỐNG NHAU ở cả 2 holding
  const latePaymentDate = isoDate(daysAgo(200)); // trễ 200 ngày so với ngày chia — CHỈ Holding B điền

  async function readHoldingXirrPercent(
    p: import("@playwright/test").Page,
  ): Promise<string> {
    // Cấu trúc ReturnMetrics.tsx: span "XIRR" -> cha (row label+badge) -> cha
    // (card) -> giá trị formatSignedPercent nằm ở div SIBLING của row, cùng
    // trong card — lên 2 cấp từ span "XIRR" để lấy đúng card rồi tìm giá trị
    // theo định dạng "+x,x%"/"−x,x%" bên trong.
    const card = p
      .getByText("XIRR", { exact: true })
      .locator("..")
      .locator("..");
    await expect(card).not.toContainText("Chưa tính được");
    const value = card.getByText(/^[+−]\d+,\d%$/);
    await expect(value).toBeVisible();
    return value.innerText();
  }

  async function createHoldingWithCashDividend(
    symbol: string,
    paymentDate: string | null,
  ): Promise<string> {
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="pricePerUnit"]').fill("90000");
    await fillDatePicker(page, "date", buyDate);
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    const holdingUrl = stripQuery(page.url());

    await page.goto(`${holdingUrl}/dividends/new`);
    // "Tiền mặt" mặc định — không cần bấm SegmentedControl. 200% để chênh
    // lệch thời điểm 200 ngày tạo khác biệt XIRR đủ lớn, không lẫn vào sai số
    // làm tròn 1 chữ số thập phân của formatSignedPercent (đã tự verify bằng
    // công thức XIRR thuần trước khi viết test, xem assertion cuối).
    await page.locator('input[name="percent"]').fill("200");
    // fillDatePicker phải là bước CUỐI trước submit (ghi thẳng DOM, bỏ qua
    // React state — field percent .fill() ở trên có thể trigger re-render
    // ghi đè DOM nếu gọi SAU, xem comment fillDatePicker ở support/date-picker.ts).
    await fillDatePicker(page, "date", dividendDate);
    if (paymentDate) {
      await fillDatePicker(page, "paymentDate", paymentDate);
    }
    await page.getByRole("button", { name: "Ghi cổ tức", exact: true }).click();
    await expect(
      page.getByText(new RegExp(`Đã ghi cổ tức ${symbol}`)),
    ).toBeVisible();

    return holdingUrl;
  }

  try {
    for (const symbol of [symbolA, symbolB]) {
      await db.priceQuote.upsert({
        where: { symbol_date: { symbol, date: quoteDate } },
        create: { symbol, date: quoteDate, price: "150000", source: "vnstock" },
        update: { price: "150000", source: "vnstock" },
      });
    }

    const holdingUrlA = await createHoldingWithCashDividend(symbolA, null);
    const holdingUrlB = await createHoldingWithCashDividend(
      symbolB,
      latePaymentDate,
    );

    await page.goto(holdingUrlA);
    const xirrA = await readHoldingXirrPercent(page);

    await page.goto(holdingUrlB);
    const xirrB = await readHoldingXirrPercent(page);

    expect(xirrA).not.toBe(xirrB);

    // Hướng thay đổi khớp trực giác domain (paymentDate trễ hơn -> dòng tiền
    // dương về TAY MUỘN HƠN, ít thời gian sinh lời hơn -> XIRR năm hoá THẤP
    // HƠN). Assert cả hướng (không chỉ "khác nhau") để bắt luôn lỗi đảo dấu
    // ngày (vd code lỡ dùng khoảng cách `date - paymentDate` thay vì đúng
    // `paymentDate ?? date` làm mốc điểm dòng tiền) — đã tự verify bằng công
    // thức XIRR thuần (Newton-Raphson) với đúng bộ số của test này trước khi
    // viết: A ~ 40,5% > B ~ 38,5%.
    const parsePercent = (s: string) =>
      parseFloat(s.replace("%", "").replace(",", "."));
    expect(parsePercent(xirrA)).toBeGreaterThan(parsePercent(xirrB));
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({
      where: { symbol: { in: [symbolA, symbolB] }, date: quoteDate },
    });
  }
});
