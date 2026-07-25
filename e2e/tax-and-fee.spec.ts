import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

import { DashboardPage } from "./pages/dashboard-page";
import { NewHoldingPage } from "./pages/new-holding-page";
import { TransactionForm } from "./pages/transaction-form";
import { daysAgo, isoDate } from "./support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "./support/test-session";

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
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    const detail = await newHoldingPage.create({
      symbol,
      quantity: 100,
      pricePerUnit: 100_000,
      date: isoDate(buyDate),
    });

    // --- Form ghi giao dịch mới: BUY mặc định KHÔNG có field Thuế bán ---
    const form = await detail.goToNewTransaction();
    await expect(form.saleTaxInput).toHaveCount(0);
    await expect(form.feeCard.getByText("TỰ ĐIỀN · SỬA ĐƯỢC")).toBeVisible();

    // Chọn ngày qua UI thật (KHÔNG fillDatePicker — cần kích hoạt re-render
    // để card thuế/phí tính lại preview theo ngày này, xem changeDate()/GOTCHAS #2).
    await form.changeDate(originalSellDate);
    await form.fillQuantity(40);
    await form.fillPricePerUnit(130_000);

    // Phí mua @ originalSellDate (trước RATE_CHANGE_DATE): 40×130.000×0,3% = 15.600.
    await expect(form.feeInput).toHaveValue("15600");

    // --- Chuyển "Bán" -> field Thuế bán xuất hiện, tự điền đúng số ---
    await form.toggleSell();
    await expect(form.taxCard.getByText("TỰ ĐIỀN · SỬA ĐƯỢC")).toBeVisible();
    // Thuế bán @ originalSellDate: 40×130.000×0,1% = 5.200.
    await expect(form.saleTaxInput).toHaveValue("5200");
    // Phí bán @ originalSellDate: cùng 0,3% baseline như phí mua -> vẫn 15.600.
    await expect(form.feeInput).toHaveValue("15600");

    // --- Sửa tay được, "Đặt lại" khôi phục đúng số tự tính ---
    const resetButton = form.resetButton(form.taxCard);
    await expect(resetButton).toBeDisabled();
    await form.saleTaxInput.fill("999999");
    await expect(resetButton).toBeEnabled();
    await resetButton.click();
    await expect(form.saleTaxInput).toHaveValue("5200");
    await expect(resetButton).toBeDisabled();

    await form.confirmSell();
    // Trang chi tiết vị thế ĐÃ có valuation (seed PriceQuote ở trên) -> Component
    // rẽ sang nhánh "valued" (HoldingDetailScreen.tsx), nhánh này KHÔNG hiện dòng
    // "Số lượng: N cổ phần" riêng (chỉ nhánh Phase-1-chưa-định-giá-được mới có) —
    // xác nhận SL còn lại đúng gián tiếp qua NAV: 60 CP còn lại × 150.000 = 9.000.000.
    await expect(detail.navBox).toContainText("9.000.000");

    const cashflowId = new URL(page.url()).searchParams.get("cashflowId");
    if (!cashflowId) {
      throw new Error(
        `Thiếu cashflowId trên URL sau khi ghi SELL: ${page.url()}`,
      );
    }

    // --- Sửa ngày một SELL đã ghi -> tính lại cả thuế lẫn phí theo suất mới ---
    const editForm = await TransactionForm.openForEdit(
      page,
      detail.url,
      cashflowId,
    );
    // editUnchanged: chưa đổi field nào -> hiện GIÁ TRỊ ĐÃ LƯU, không phải
    // formula tính lại (bugfix "không ghi đè taxAmount/feeAmount ngoài ý muốn").
    await expect(editForm.saleTaxInput).toHaveValue("5200");
    await expect(editForm.feeInput).toHaveValue("15600");
    await expect(editForm.savedValueNote).toHaveCount(2);

    await editForm.changeDate(newSellDate);

    await expect(editForm.sellDateChangedNote).toBeVisible();
    await expect(editForm.taxRecomputeCard).toBeVisible();
    await expect(editForm.feeRecomputeCard).toBeVisible();

    const taxRecompute = editForm.taxRecomputeCard;
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

    const feeRecompute = editForm.feeRecomputeCard;
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
    await editForm.changeDate(thirdSellDate);
    await expect(taxRecompute.getByLabel("Thuế bán · tính lại")).toHaveValue(
      "10400",
    );
    await expect(
      feeRecompute.getByLabel("Phí giao dịch · tính lại"),
    ).toHaveValue("26000");

    // Quay lại newSellDate (cùng suất, cùng số tính lại) để phần còn lại của
    // test (submit, Dashboard) khớp đúng phép tính tay đã ghi ở đầu file.
    await editForm.changeDate(newSellDate);

    await editForm.confirmUpdate();
    // Đổi ngày SELL không đổi số lượng -> NAV vẫn 9.000.000 (60 CP × 150.000).
    await expect(detail.navBox).toContainText("9.000.000");

    // --- Dashboard: lãi/lỗ thực nhận + chi phí ăn mòn ---
    // NAV = 60 CP còn lại × 150.000 = 9.000.000.
    // Lãi/lỗ thực nhận = Σ Cashflow.amount + NAV
    //   = (-10.000.000 [BUY] + (5.200.000 - 26.000 - 10.400) [SELL sau sửa]) + 9.000.000
    //   = -4.836.400 + 9.000.000 = 4.163.600.
    // Chi phí ăn mòn = taxAmount(10.400) + feeAmount(26.000) + 0 (không cổ tức) = 36.400,
    //   trên grossInvested = |BUY.amount| = 10.000.000 -> 0,364% (làm tròn "0,36%",
    //   formatCostDragPercent giữ 2 chữ số thập phân — xem src/lib/format.ts).
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(dashboardPage.navValueBlock).toContainText("9.000.000");

    const pnlCard = dashboardPage.pnlCard;
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
    const sheet = await dashboardPage.openCostDragSheet();
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
