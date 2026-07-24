import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

import { daysAgo } from "./support/dates";
import { fillDatePicker, selectDateOnCalendar } from "./support/date-picker";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";
import { afterTransactionUrl, stripQuery } from "./support/urls";

// Phase 5 (docs/domain/07-tax.md) — thuế bán + phí giao dịch. Cùng lý do đã
// ghi ở dividends.spec.ts: scripts/e2e.mjs chỉ `prisma migrate deploy`, KHÔNG
// chạy `pnpm db:seed` cho DB e2e -> SALE_TAX_STOCK/TRANSACTION_FEE_*_STOCK
// không có sẵn, phải seed trực tiếp qua Prisma ở đây. Seed thêm MỘT mốc
// effectiveFrom thứ hai (khác giá trị) để bài test thật sự phủ "đổi thuế
// suất áp đúng suất thời điểm" (phase-5.md mục tiêu chí) — không chỉ đổi
// ngày mà số tiền vẫn y hệt (không phân biệt được recompute có chạy đúng
// công thức mới hay chỉ copy nguyên giá trị cũ).
const db = new PrismaClient();
const BASELINE = new Date("2020-01-01");

async function upsertSettingIgnoringRace(
  data: Prisma.SettingCreateInput & { key: string; effectiveFrom: Date },
) {
  try {
    await db.setting.upsert({
      where: {
        key_effectiveFrom: { key: data.key, effectiveFrom: data.effectiveFrom },
      },
      update: {},
      create: data,
    });
  } catch (err) {
    // fullyParallel có thể chạy beforeAll của file này ở nhiều worker — coi
    // P2002 (đã có worker khác seed xong) là race vô hại, không phải lỗi
    // (giống upsertSettingIgnoringRace ở dividends.spec.ts).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}

// Mốc đổi thuế suất/biểu phí — "10 ngày trước" tính từ lúc chạy test (không
// hardcode ngày cụ thể, cùng triết lý daysAgo()/isoDate() ở support/dates.ts).
// originalSellDate (20 ngày trước) < RATE_CHANGE_DATE (10 ngày trước) <
// newSellDate (2 ngày trước) — đủ đệm nhiều ngày để chịu được sai số làm
// tròn giờ/timezone khi so sánh effectiveFrom <= ngày giao dịch.
const RATE_CHANGE_DATE = daysAgo(10);

async function seedTaxAndFeeSettings() {
  await upsertSettingIgnoringRace({
    key: "SALE_TAX_STOCK",
    value: "0.1",
    valueType: "DECIMAL",
    label: "Thuế bán cổ phiếu (%)",
    group: "TAX",
    unit: "%",
    effectiveFrom: BASELINE,
  });
  await upsertSettingIgnoringRace({
    key: "SALE_TAX_STOCK",
    value: "0.2",
    valueType: "DECIMAL",
    label: "Thuế bán cổ phiếu (%)",
    group: "TAX",
    unit: "%",
    effectiveFrom: RATE_CHANGE_DATE,
  });
  await upsertSettingIgnoringRace({
    key: "TRANSACTION_FEE_BUY_STOCK",
    value: "0.3",
    valueType: "DECIMAL",
    label: "Phí mua cổ phiếu (%)",
    group: "FEE",
    unit: "%",
    effectiveFrom: BASELINE,
  });
  await upsertSettingIgnoringRace({
    key: "TRANSACTION_FEE_SELL_STOCK",
    value: "0.3",
    valueType: "DECIMAL",
    label: "Phí bán cổ phiếu (%)",
    group: "FEE",
    unit: "%",
    effectiveFrom: BASELINE,
  });
  await upsertSettingIgnoringRace({
    key: "TRANSACTION_FEE_SELL_STOCK",
    value: "0.5",
    valueType: "DECIMAL",
    label: "Phí bán cổ phiếu (%)",
    group: "FEE",
    unit: "%",
    effectiveFrom: RATE_CHANGE_DATE,
  });
}

test.beforeAll(async () => {
  await seedTaxAndFeeSettings();
});

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

// Format dd/MM/yyyy giống HỆT DATE_FORMATTER (lib/format.ts::formatDate) —
// đối chiếu nhãn "áp dụng từ ..." hiển thị trên card so sánh cũ/mới mà không
// import trực tiếp module app (giữ e2e độc lập khỏi nội bộ app, cùng quy ước
// các support/* khác trong thư mục này).
const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

test("SELL tự tính thuế/phí theo Setting, sửa tay được, đổi ngày sửa lại đúng suất mới; Dashboard hiện lãi/lỗ thực nhận + chi phí ăn mòn", async ({
  browser,
}) => {
  const session = await createTestSession("tax-fee");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const quoteDate = daysAgo(1);
  const buyDate = daysAgo(30);
  const originalSellDate = daysAgo(20); // trước RATE_CHANGE_DATE -> suất cũ (0.1%/0.3%)
  const newSellDate = daysAgo(2); // sau RATE_CHANGE_DATE -> suất mới (0.2%/0.5%)

  try {
    // Seed PriceQuote TRƯỚC KHI tạo Holding (bug thật đã tự verify ở
    // dashboard.spec.ts): getHoldingDetail() gọi valuateHoldings() ngay khi
    // trang chi tiết vị thế render lần đầu sau khi tạo — nếu PriceQuote chưa
    // tồn tại lúc đó, unstable_cache ghim "thiếu giá" cho symbol này tới 1
    // giờ, khiến Dashboard sau này (dù đã seed) vẫn đọc cache cũ.
    await db.priceQuote.upsert({
      where: { symbol_date: { symbol, date: quoteDate } },
      create: { symbol, date: quoteDate, price: "150000", source: "vnstock" },
      update: { price: "150000", source: "vnstock" },
    });

    // Vị thế ban đầu: 100 CP @ 100.000 (NewHoldingForm không có field phí —
    // Cashflow.feeAmount = "0", không ảnh hưởng công thức chi phí ăn mòn bên
    // dưới ngoài phần gross đã tính).
    await page.goto("/holdings/new");
    await page.getByPlaceholder("VD: FPT", { exact: true }).fill(symbol);
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="pricePerUnit"]').fill("100000");
    await fillDatePicker(page, "date", buyDate.toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.waitForURL(
      /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/,
    );
    const holdingUrl = stripQuery(page.url());

    // --- Form ghi giao dịch mới: BUY mặc định KHÔNG có field Thuế bán ---
    await page.goto(`${holdingUrl}/transactions/new`);
    await expect(page.getByText("Thuế bán", { exact: true })).toHaveCount(0);
    const feeCardBuy = page
      .getByLabel("Phí giao dịch")
      .locator("..")
      .locator("..");
    await expect(feeCardBuy.getByText("TỰ ĐIỀN · SỬA ĐƯỢC")).toBeVisible();

    // Chọn ngày qua UI thật (KHÔNG fillDatePicker — cần kích hoạt re-render
    // để card thuế/phí tính lại preview theo ngày này, xem selectDateOnCalendar).
    await selectDateOnCalendar(page, originalSellDate);
    await page.locator('input[name="quantity"]').fill("40");
    await page.locator('input[name="pricePerUnit"]').fill("130000");

    // Phí mua @ originalSellDate (trước RATE_CHANGE_DATE): 40×130.000×0,3% = 15.600.
    await expect(page.getByLabel("Phí giao dịch")).toHaveValue("15600");

    // --- Chuyển "Bán" -> field Thuế bán xuất hiện, tự điền đúng số ---
    await page.getByRole("button", { name: "Bán" }).click();
    const taxCard = page.getByLabel("Thuế bán").locator("..").locator("..");
    await expect(taxCard.getByText("TỰ ĐIỀN · SỬA ĐƯỢC")).toBeVisible();
    // Thuế bán @ originalSellDate: 40×130.000×0,1% = 5.200.
    await expect(page.getByLabel("Thuế bán")).toHaveValue("5200");
    // Phí bán @ originalSellDate: cùng 0,3% baseline như phí mua -> vẫn 15.600.
    await expect(page.getByLabel("Phí giao dịch")).toHaveValue("15600");

    // --- Sửa tay được, "Đặt lại" khôi phục đúng số tự tính ---
    const resetButton = taxCard.getByRole("button", { name: "Đặt lại" });
    await expect(resetButton).toBeDisabled();
    await page.getByLabel("Thuế bán").fill("999999");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();
    await expect(page.getByLabel("Thuế bán")).toHaveValue("5200");
    await expect(resetButton).toBeDisabled();

    await page.getByRole("button", { name: "Ghi nhận giao dịch bán" }).click();
    await page.waitForURL(afterTransactionUrl(holdingUrl));
    // Trang chi tiết vị thế ĐÃ có valuation (seed PriceQuote ở trên) -> Component
    // rẽ sang nhánh "valued" (HoldingDetailScreen.tsx), nhánh này KHÔNG hiện dòng
    // "Số lượng: N cổ phần" riêng (chỉ nhánh Phase-1-chưa-định-giá-được mới có) —
    // xác nhận SL còn lại đúng gián tiếp qua NAV: 60 CP còn lại × 150.000 = 9.000.000.
    const navBox = page
      .getByText("Giá trị hiện tại", { exact: true })
      .locator("../..");
    await expect(navBox).toContainText("9.000.000");

    const cashflowId = new URL(page.url()).searchParams.get("cashflowId");
    if (!cashflowId) {
      throw new Error(
        `Thiếu cashflowId trên URL sau khi ghi SELL: ${page.url()}`,
      );
    }

    // --- Sửa ngày một SELL đã ghi -> tính lại cả thuế lẫn phí theo suất mới ---
    await page.goto(`${holdingUrl}/transactions/${cashflowId}/edit`);
    // editUnchanged: chưa đổi field nào -> hiện GIÁ TRỊ ĐÃ LƯU, không phải
    // formula tính lại (bugfix "không ghi đè taxAmount/feeAmount ngoài ý muốn").
    await expect(page.getByLabel("Thuế bán")).toHaveValue("5200");
    await expect(page.getByLabel("Phí giao dịch")).toHaveValue("15600");
    await expect(
      page.getByText(
        "Giá trị đã lưu cho giao dịch này — sửa tay nếu cần khớp lại.",
      ),
    ).toHaveCount(2);

    await selectDateOnCalendar(page, newSellDate);

    await expect(page.getByText("Bạn đổi ngày bán")).toBeVisible();
    await expect(page.getByText("Thuế bán · tính lại")).toBeVisible();
    await expect(page.getByText("Phí giao dịch · tính lại")).toBeVisible();

    const taxRecompute = page.getByText("Thuế bán · tính lại").locator("../..");
    // Giá trị cũ (gạch ngang) = 5.200 (giữ nguyên, KHÔNG đổi khi mở form).
    const oldTaxAmount = taxRecompute.getByText("5200", { exact: true });
    await expect(oldTaxAmount).toBeVisible();
    await expect(oldTaxAmount).toHaveClass(/line-through/);
    // Giá trị mới @ newSellDate (sau RATE_CHANGE_DATE, suất 0,2%): 40×130.000×0,2% = 10.400.
    await expect(taxRecompute.getByLabel("Thuế bán · tính lại")).toHaveValue(
      "10400",
    );
    await expect(taxRecompute).toContainText(
      `SALE_TAX_STOCK áp dụng từ ${DATE_FORMATTER.format(RATE_CHANGE_DATE)}`,
    );

    const feeRecompute = page
      .getByText("Phí giao dịch · tính lại")
      .locator("../..");
    const oldFeeAmount = feeRecompute.getByText("15600", { exact: true });
    await expect(oldFeeAmount).toBeVisible();
    await expect(oldFeeAmount).toHaveClass(/line-through/);
    // Giá trị mới @ newSellDate (sau RATE_CHANGE_DATE, suất 0,5%): 40×130.000×0,5% = 26.000.
    await expect(
      feeRecompute.getByLabel("Phí giao dịch · tính lại"),
    ).toHaveValue("26000");
    await expect(feeRecompute).toContainText(
      `TRANSACTION_FEE_SELL_STOCK áp dụng từ ${DATE_FORMATTER.format(RATE_CHANGE_DATE)}`,
    );

    // Card so sánh vẫn sửa tay được sau khi tính lại — không khoá field.
    await taxRecompute.getByLabel("Thuế bán · tính lại").fill("11111");
    await expect(taxRecompute.getByLabel("Thuế bán · tính lại")).toHaveValue(
      "11111",
    );

    // Đổi ngày MỘT LẦN NỮA ngay sau khi đã gõ tay — SellRecomputeCompareCard
    // phải bỏ hẳn giá trị gõ tay đó và hiện số tính lại theo ngày mới nhất,
    // KHÔNG giữ "11111" (bất biến ghi ở SellRecomputeCompareCard.tsx: "không có
    // cách phân biệt cũ do auto vs cũ do user sửa" -> ghi đè bằng key={date} ép
    // remount mỗi khi ngày đổi). Chọn ngày thứ 3 vẫn SAU RATE_CHANGE_DATE (cùng
    // suất 0,2%/0,5% với newSellDate) để số tính lại khác hẳn "11111" — assertion
    // dưới chỉ pass nếu component thật sự reset, không phải tình cờ trùng số.
    const thirdSellDate = daysAgo(3);
    await selectDateOnCalendar(page, thirdSellDate);
    await expect(taxRecompute.getByLabel("Thuế bán · tính lại")).toHaveValue(
      "10400",
    );
    await expect(
      feeRecompute.getByLabel("Phí giao dịch · tính lại"),
    ).toHaveValue("26000");

    // Quay lại newSellDate (cùng suất, cùng số tính lại) để phần còn lại của
    // test (submit, Dashboard) khớp đúng phép tính tay đã ghi ở đầu file.
    await selectDateOnCalendar(page, newSellDate);

    await page.getByRole("button", { name: "Cập nhật giao dịch" }).click();
    await page.waitForURL(afterTransactionUrl(holdingUrl));
    // Đổi ngày SELL không đổi số lượng -> NAV vẫn 9.000.000 (60 CP × 150.000).
    await expect(navBox).toContainText("9.000.000");

    // --- Dashboard: lãi/lỗ thực nhận + chi phí ăn mòn ---
    // NAV = 60 CP còn lại × 150.000 = 9.000.000.
    // Lãi/lỗ thực nhận = Σ Cashflow.amount + NAV
    //   = (-10.000.000 [BUY] + (5.200.000 - 26.000 - 10.400) [SELL sau sửa]) + 9.000.000
    //   = -4.836.400 + 9.000.000 = 4.163.600.
    // Chi phí ăn mòn = taxAmount(10.400) + feeAmount(26.000) + 0 (không cổ tức) = 36.400,
    //   trên grossInvested = |BUY.amount| = 10.000.000 -> 0,364% (làm tròn "0,36%",
    //   formatCostDragPercent giữ 2 chữ số thập phân — xem src/lib/format.ts).
    await page.goto("/");

    await expect(
      page.getByText("Giá trị thị trường (NAV)").locator("..").locator(".."),
    ).toContainText("9.000.000");

    const pnlCard = page
      .getByText("Lãi/lỗ (thực nhận)", { exact: true })
      .locator("../..");
    await expect(pnlCard).toContainText("4.163.600");
    await expect(pnlCard).toContainText(
      "Đã trừ cả thuế lẫn phí — số thực nhận, không phải trên giấy.",
    );
    await expect(pnlCard).toContainText("0,36%"); // costDragPercent trên dòng "Chi phí ăn mòn"
    await expect(pnlCard).toContainText("36,4k"); // costDragAmount rút gọn

    // --- Tách realized/unrealized PnL (issue #67) trên CHÍNH scenario BUY/SELL
    // đã kiểm chứng tax/fee ở trên — không dựng lại setup riêng, tận dụng số
    // liệu đã audit kỹ để đối chiếu công thức domain (docs/domain/05, mục
    // "Cách tính"):
    // realizedPnl = SELL.amount (net, sau thuế/phí) − quantity_bán × avgCost
    //   = 5.163.600 (= 5.200.000 − 26.000 − 10.400, đã tính ở SELL.amount trên)
    //     − 40 × 100.000 [avgCost = |BUY.amount|/quantity = 10.000.000/100]
    //   = 5.163.600 − 4.000.000 = 1.163.600.
    // unrealizedPnl = NAV hiện tại − vốn còn lại trong vị thế
    //   = 9.000.000 − 60 × 100.000 = 9.000.000 − 6.000.000 = 3.000.000.
    // Bất biến: realizedPnl + unrealizedPnl = 1.163.600 + 3.000.000 = 4.163.600
    //   = đúng absolutePnl đã assert ở trên ("Lãi/lỗ (thực nhận)") — nếu logic
    //   tách bị revert/sai (vd quên trừ thuế/phí khỏi SELL.amount, hoặc dùng
    //   nhầm avgCost hiện tại thay vì tại-thời-điểm-bán), một trong hai số
    //   dưới đây sẽ lệch khỏi giá trị tay này.
    await expect(pnlCard).toContainText("Đã thực hiện:");
    await expect(pnlCard).toContainText("1.163.600");
    await expect(pnlCard).toContainText("Chưa thực hiện:");
    await expect(pnlCard).toContainText("3.000.000");
    // Mốc chốt đang xem = "hôm nay" (không đổi cutoff trong test này) ->
    // pnlSplitIsApproximate phải là false -> KHÔNG hiện ghi chú "*Ước tính".
    await expect(pnlCard).not.toContainText("Ước tính");

    await expect(
      page.getByText("Vốn đã bỏ ra mua", { exact: true }).locator(".."),
    ).toContainText("10tr");

    // Mở sheet chi tiết chi phí ăn mòn — breakdown đúng 3 nguồn + % đóng góp.
    await page.getByText("Chi phí ăn mòn", { exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("36.400")).toBeVisible(); // tổng đầy đủ, không rút gọn
    await expect(sheet).toContainText("0,36%");
    await expect(sheet).toContainText("10tr"); // grossInvested nhắc lại trong ghi chú số

    // "../.." (không phải ".."): amount ("26k") là SIBLING của div bọc
    // label+note (SOURCE_LABEL/SOURCE_NOTE), không phải con của nó — xem
    // CostDragSheet.tsx (span amount nằm cùng cấp với div "min-w-0 flex-1").
    const feeRow = sheet
      .getByText("Phí giao dịch", { exact: true })
      .locator("../..");
    await expect(feeRow).toContainText("26k");
    await expect(feeRow).toContainText("71,4%"); // 26.000 / 36.400

    const saleTaxRow = sheet
      .getByText("Thuế bán", { exact: true })
      .locator("../..");
    await expect(saleTaxRow).toContainText("10,4k");
    await expect(saleTaxRow).toContainText("28,6%"); // 10.400 / 36.400

    const dividendTaxRow = sheet
      .getByText("Thuế cổ tức", { exact: true })
      .locator("../..");
    await expect(dividendTaxRow).toContainText("0,0%"); // không có cổ tức trong luồng này
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
    await db.priceQuote.deleteMany({ where: { symbol, date: quoteDate } });
  }
});
