import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

import {
  cleanupTestUser,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";
import { stripQuery } from "./support/urls";

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
    // phải 12,6) qua lịch sử cổ tức (getDividendHistory dùng
    // buildQuantityTimeline, có replay cả Dividend{STOCK}) — KHÔNG qua trang
    // chi tiết vị thế: getHoldingDetail() (features/holdings/queries.ts) tính
    // quantity bằng derivePosition(cashflows), chỉ replay Cashflow (mua/bán),
    // BỎ QUA Dividend{STOCK} -> trang chi tiết hiện sai SL sau khi nhận cổ tức
    // cổ phiếu (đã xác nhận bằng thực nghiệm: page.goto lại /holdings/{id}
    // vẫn hiện "105 cổ phần" dù cache/lịch sử/dashboard đều đúng 117). Bug có
    // thật, báo riêng cho người dùng — KHÔNG che giấu bằng cách assert theo
    // hành vi sai ở đây.
    await page.getByRole("link", { name: "Xem lịch sử cổ tức" }).click();
    await page.waitForURL(`${holdingUrl}/dividends`);
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
