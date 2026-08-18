import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

import { HoldingDetailPage } from "../pages/holding-detail-page";
import { NewHoldingPage } from "../pages/new-holding-page";
import { daysAgo, isoDate } from "../support/dates";
import {
  cleanupTestUser,
  closeContext,
  createTestSession,
  disconnectTestDb,
  signInAs,
} from "../support/test-session";

// PrismaClient riêng (không export từ test-session.ts, cùng tiền lệ
// dividends.spec.ts) — tra thẳng Dividend đã ghi, không tin số hiển thị trên
// UI là đủ (UI có thể format sai mà số DB vẫn đúng, hoặc ngược lại).
const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
  await disconnectTestDb();
});

// holdingId thật (uuid) nằm ở segment cuối của URL chi tiết vị thế sạch (không
// query) — cùng helper dividends.spec.ts.
function holdingIdFromUrl(holdingUrl: string): string {
  const id = new URL(holdingUrl).pathname.split("/").pop();
  if (!id) throw new Error(`Không lấy được holdingId từ URL: ${holdingUrl}`);
  return id;
}

// Điều khoản dùng chung cho cả 2 kịch bản bắt buộc (process/phase-7.md "Trạng
// thái verify"): mệnh giá 10.000.000đ, coupon 12%/năm trả 6 tháng/lần ->
// couponPerPeriod = 10.000.000 × 12% × 6/12 = 600.000/trái phiếu/kỳ.
// issuerType giữ mặc định "Doanh nghiệp" (CORPORATE, getBondTermsFormData) ->
// thuế 5% (BOND_INTEREST_TAX_RATE_CORPORATE = "5" từ 2020-01-01,
// prisma/seed.ts) — không cần bấm SegmentedControl. Bỏ trống firstCouponDate/
// maturityDate (không cần cho 2 kịch bản này — xem docstring BondTermsForm về
// bẫy state/FormData của form đó).
async function setBondTerms(
  detail: HoldingDetailPage,
): Promise<HoldingDetailPage> {
  const bondTermsForm = await detail.goToBondTerms();
  await bondTermsForm.setParValue("10000000");
  await bondTermsForm.setCouponRatePercent("12");
  await bondTermsForm.setCouponFrequencyMonths("6");
  return bondTermsForm.save();
}

// Kịch bản BẮT BUỘC (1), process/phase-7.md "Trạng thái verify": ghi bù một kỳ
// trái tức CŨ sau khi đã mua thêm — khoá lại bug đã sửa 2026-07-29 (review PR
// #102): card thuế client (AutoFilledAmountCard trong BondCouponFields) tính
// theo `holding.quantity` (SL HIỆN TẠI), nhưng server tính `grossAmount` theo
// `quantityAtDate` (SL TẠI NGÀY TRẢ LÃI) — hai SL này KHÁC NHAU khi ghi bù một
// kỳ cũ sau khi đã mua thêm. Fix: card thuế đặt `submitWhenAuto={false}`
// (BondCouponFields.tsx) — chưa sửa tay thì KHÔNG gửi `taxAmount` lên, server
// tự tính taxAmount từ CHÍNH grossAmount(quantityAtDate) của nó, không lẫn số
// client tính theo SL khác.
//
// Test này sẽ ĐỎ nếu bug quay lại theo BẤT KỲ hướng nào: card thuế gửi số tự
// tính lên (submitWhenAuto revert về true) SẼ ra netAmount lệch (thuế tính
// nhầm theo SL=2 trong khi gross theo SL=1), hoặc server tự nó quay lại suy
// SL từ nơi khác ngoài quantityAtDate cũng lệch tương tự — cả hai đều không
// còn khớp 570.000 kỳ vọng dưới đây.
test("Ghi bù một kỳ trái tức cũ sau khi đã mua thêm: gross/tax/net dùng SL tại ngày trả lãi, không phải SL hiện tại (process/phase-7.md kịch bản 1)", async ({
  browser,
}) => {
  const session = await createTestSession("bond-coupon-backfill");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const firstBuyDate = isoDate(daysAgo(400));
  const secondBuyDate = isoDate(daysAgo(100)); // mua thêm SAU kỳ trả lãi sẽ ghi bù
  const backfillCouponDate = isoDate(daysAgo(200)); // NẰM GIỮA 2 lần mua

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    let detail = await newHoldingPage.create({
      symbol,
      quantity: 1,
      pricePerUnit: 10_000_000,
      assetType: "Trái phiếu",
      date: firstBuyDate,
    });

    detail = await setBondTerms(detail);

    // Mua thêm 1 trái phiếu, NGÀY SAU kỳ trả lãi sẽ ghi bù -> SL hiện tại (2)
    // sau bước này PHẢI KHÔNG được dùng cho kỳ trả lãi cũ ở dưới.
    const transactionForm = await detail.goToNewTransaction();
    await transactionForm.fillQuantity(1);
    await transactionForm.fillPricePerUnit(10_000_000);
    await transactionForm.fillDate(secondBuyDate); // bước CUỐI trước submit (GOTCHAS #2)
    await transactionForm.confirmBuy();

    // Ghi bù kỳ trái tức cũ (giữa 2 lần mua). Tab "Trái tức" mặc định đã chọn
    // sẵn (holding.type === BOND, DividendForm.tsx). KHÔNG sửa tay card thuế
    // -> field taxAmount vắng mặt trong FormData, server tự tính theo
    // quantityAtDate (docs/domain/03-dividends.md).
    const form = await detail.goToNewDividend();
    await form.setDate(backfillCouponDate);
    await form.submit();

    await expect(form.successHeading(symbol)).toBeVisible();

    // SL tại ngày trả lãi = 1 (chỉ tính lần mua đầu, -400 ngày; lần mua thêm
    // -100 ngày NẰM SAU ngày trả lãi -200 nên không được tính) ->
    // gross = 10.000.000 × 12% × 6/12 × 1 = 600.000, thuế 5% = 30.000,
    // net = 570.000. Nếu bug tái hiện (lẫn SL=2), số quan sát được sẽ khác.
    await expect(page.getByText(/gộp 600\.000/)).toBeVisible();
    await expect(page.getByText(/− thuế 30\.000/)).toBeVisible();
    await expect(page.getByText(/570\.000/)).toBeVisible();

    const holdingId = holdingIdFromUrl(detail.url);
    const dividend = await db.dividend.findFirst({
      where: { holdingId, type: "BOND_COUPON" },
    });
    expect(dividend).not.toBeNull();
    expect(new Decimal(dividend!.grossAmount!.toString()).toString()).toBe(
      "600000",
    );
    expect(new Decimal(dividend!.taxAmount!.toString()).toString()).toBe(
      "30000",
    );
    expect(new Decimal(dividend!.netAmount!.toString()).toString()).toBe(
      "570000",
    );
    // Đóng băng đúng kỳ trả lãi đã dùng (docs/domain/03-dividends.md "Hiển thị
    // lịch sử") — không suy ngược từ SL hiện tại, nên phải khớp NGUYÊN GIÁ TRỊ
    // đã nhập ở BondTerms, không lệch dù SL đã đổi sau đó.
    expect(dividend!.couponFrequencyMonthsApplied).toBe(6);
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Kịch bản BẮT BUỘC (2), process/phase-7.md "Trạng thái verify": trái tức kỳ
// cuối trả ĐÚNG ngày đáo hạn, ghi TẤT TOÁN trước rồi mới ghi TRÁI TỨC (issue
// #101, `SETTLEMENT_RANK` — lib/position-trail.ts). Bất biến bắt buộc: trong
// CÙNG một ngày, Dividend LUÔN xếp TRƯỚC Cashflow{MATURITY} khi tính "SL đang
// giữ tại ngày trả lãi" — bất kể thứ tự người dùng thao tác trên UI. Sai thì
// trái tức tính trên SL ĐÃ BỊ TRỪ bởi tất toán, ra số THẤP HƠN đúng (hoặc 0
// đồng nếu tất toán toàn bộ) — SAI ÂM THẦM, không có tín hiệu lỗi nào.
//
// Tất toán MỘT PHẦN (1/2 trái phiếu, không phải toàn bộ) để vị thế còn MỞ sau
// khi tất toán — settleMaturity không chặn tất toán ít hơn SL đang giữ.
//
// LƯU Ý phát hiện khi viết test này (KHÔNG phải bug Phase 7, có sẵn từ trước —
// xem GOTCHAS.md): tất toán TOÀN BỘ số lượng cùng ngày rồi mới ghi trái tức kỳ
// cuối sẽ đóng vị thế (Holding.quantity = 0), và route ghi trái tức
// (`/holdings/[id]/dividends/new`) chỉ liệt kê Holding đang MỞ
// (getOpenHoldingsForSwitcher -> getOpenHoldings, quantity > 0) nên
// sẽ 404 — không thể verify qua UI thật với tất toán TOÀN BỘ. Bất biến
// SETTLEMENT_RANK áp dụng giống hệt nhau dù tất toán một phần hay toàn bộ
// (chính hàm buildQuantityTimeline không phân biệt), nên tất toán MỘT PHẦN vẫn
// verify đúng cơ chế đang cần khoá lại, chỉ khác ở việc giữ vị thế mở để còn
// vào lại được form trái tức qua UI thật.
test("Tất toán đáo hạn TRƯỚC rồi ghi trái tức kỳ cuối CÙNG NGÀY: trái tức vẫn tính trên SL trước khi tất toán, không bị trừ hụt (process/phase-7.md kịch bản 2)", async ({
  browser,
}) => {
  const session = await createTestSession("bond-maturity-order");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const buyDate = isoDate(daysAgo(400));
  const settlementDate = isoDate(daysAgo(5)); // "ngày đáo hạn" = ngày trả lãi kỳ cuối

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    let detail = await newHoldingPage.create({
      symbol,
      quantity: 2,
      pricePerUnit: 10_000_000,
      assetType: "Trái phiếu",
      date: buyDate,
    });

    detail = await setBondTerms(detail);

    // 1) GHI TẤT TOÁN TRƯỚC — tất toán 1/2 trái phiếu (giữ vị thế mở, còn 1).
    const maturityForm = await detail.goToMaturitySettlement();
    await maturityForm.setQuantity("1");
    await maturityForm.setDate(settlementDate); // bước CUỐI trước submit (GOTCHAS #2)
    detail = await maturityForm.settle();

    // 2) GHI TRÁI TỨC kỳ cuối SAU, CÙNG NGÀY với tất toán.
    const form = await detail.goToNewDividend();
    await form.setDate(settlementDate);
    await form.submit();

    await expect(form.successHeading(symbol)).toBeVisible();

    // Bất biến: SL dùng để tính trái tức PHẢI là SL TRƯỚC khi tất toán (2),
    // KHÔNG PHẢI SL sau khi đã trừ 1 trái phiếu vừa tất toán (1) -> gross =
    // 10.000.000 × 12% × 6/12 × 2 = 1.200.000, thuế 5% = 60.000, net =
    // 1.140.000. Nếu bất biến bị revert (MATURITY tie-break theo createdAt,
    // xếp trước trái tức vì được ghi TRƯỚC), SL chỉ còn 1 -> gross giảm một
    // nửa còn 600.000 — sai lệch rõ ràng, không mập mờ.
    await expect(page.getByText(/gộp 1\.200\.000/)).toBeVisible();
    await expect(page.getByText(/− thuế 60\.000/)).toBeVisible();
    await expect(page.getByText(/1\.140\.000/)).toBeVisible();

    const holdingId = holdingIdFromUrl(detail.url);
    const dividend = await db.dividend.findFirst({
      where: { holdingId, type: "BOND_COUPON" },
    });
    expect(dividend).not.toBeNull();
    expect(new Decimal(dividend!.grossAmount!.toString()).toString()).toBe(
      "1200000",
    );
    expect(new Decimal(dividend!.taxAmount!.toString()).toString()).toBe(
      "60000",
    );
    expect(new Decimal(dividend!.netAmount!.toString()).toString()).toBe(
      "1140000",
    );
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Override thủ công `grossAmount` (process/DECISION.md 2026-08-08): trái
// phiếu lãi suất thả nổi khiến số tự tính từ BondTerms lệch số thực nhận trên
// sao kê — card "Lãi gộp" (AutoFilledAmountCard, submitWhenAuto=false) cho sửa
// tay, y hệt cơ chế card Thuế đã có. Test này khoá lại 2 điểm dễ vỡ nhất khi
// mở rộng override sang gross:
// 1) Thuế KHÔNG tự tính lại theo gross đã sửa — vẫn dùng `computed.taxAmount`
//    (theo BondTerms gốc), vì tổ chức phát hành tính thuế trên MỆNH GIÁ hợp
//    đồng, không phải trên số tiền user gõ tay để khớp sao kê.
// 2) `grossAmountOverridden` được ghi `true` và badge "ĐÃ CHỈNH TAY" hiện ở
//    lịch sử — phân biệt được với kỳ tính hoàn toàn tự động khi audit lại.
test("Chỉnh tay lãi gộp trái tức: thuế vẫn tính theo số tự động, net theo gross đã sửa, đánh dấu ĐÃ CHỈNH TAY ở lịch sử", async ({
  browser,
}) => {
  const session = await createTestSession("bond-coupon-gross-override");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const buyDate = isoDate(daysAgo(200));
  const couponDate = isoDate(daysAgo(10));

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    let detail = await newHoldingPage.create({
      symbol,
      quantity: 1,
      pricePerUnit: 10_000_000,
      assetType: "Trái phiếu",
      date: buyDate,
    });

    detail = await setBondTerms(detail);

    // gross tự tính = 10.000.000 × 12% × 6/12 × 1 = 600.000, thuế 5% = 30.000
    // — sửa tay gross lên 650.000 (mô phỏng lãi suất thả nổi trả cao hơn công
    // thức cố định), KHÔNG động vào card Thuế.
    const form = await detail.goToNewDividend();
    await form.setDate(couponDate);
    await form.setGrossAmountOverride("650000");
    await form.submit();

    await expect(form.successHeading(symbol)).toBeVisible();

    // Thuế giữ nguyên 30.000 (tính từ gross TỰ ĐỘNG, không phải 650.000 vừa
    // sửa) -> net = 650.000 − 30.000 = 620.000.
    await expect(page.getByText(/gộp 650\.000/)).toBeVisible();
    await expect(page.getByText(/− thuế 30\.000/)).toBeVisible();
    await expect(page.getByText(/620\.000/)).toBeVisible();

    const holdingId = holdingIdFromUrl(detail.url);
    const dividend = await db.dividend.findFirst({
      where: { holdingId, type: "BOND_COUPON" },
    });
    expect(dividend).not.toBeNull();
    expect(new Decimal(dividend!.grossAmount!.toString()).toString()).toBe(
      "650000",
    );
    expect(new Decimal(dividend!.taxAmount!.toString()).toString()).toBe(
      "30000",
    );
    expect(new Decimal(dividend!.netAmount!.toString()).toString()).toBe(
      "620000",
    );
    expect(dividend!.grossAmountOverridden).toBe(true);

    // Badge lịch sử (DividendRowsFilter.tsx) — dòng gộp/thuế dùng formatMoney
    // compact (650.000 -> "650k", 30.000 -> "30k").
    const historyPage = await form.goToHistory();
    await expect(historyPage.entry(/gộp 650k − thuế 30k/)).toBeVisible();
    await expect(historyPage.entry("ĐÃ CHỈNH TAY")).toBeVisible();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});

// Guard đổi hành vi có chủ đích cùng PR (actions.ts: so `taxAmount` với
// `grossAmount` CUỐI CÙNG đã qua override, không phải `computed.grossAmount`
// tự tính) — nếu guard bị revert về so với số tự tính, ca này sẽ LỌT qua
// (20.000 < 600.000 tự tính) thay vì bị chặn đúng (20.000 < 30.000 thuế NHƯNG
// user đã hạ gross xuống dưới thuế), ghi sai netAmount ÂM vào XIRR mà không
// có tín hiệu lỗi nào.
test("Chỉnh tay lãi gộp xuống thấp hơn thuế đã tính: bị chặn, không ghi dòng trái tức nào", async ({
  browser,
}) => {
  const session = await createTestSession("bond-coupon-gross-guard");
  const context = await browser.newContext();
  await signInAs(context, session.sessionToken);
  const page = await context.newPage();

  const symbol = `E2E${randomUUID().slice(0, 6).toUpperCase()}`;
  const buyDate = isoDate(daysAgo(200));
  const couponDate = isoDate(daysAgo(10));

  try {
    const newHoldingPage = new NewHoldingPage(page);
    await newHoldingPage.goto();
    let detail = await newHoldingPage.create({
      symbol,
      quantity: 1,
      pricePerUnit: 10_000_000,
      assetType: "Trái phiếu",
      date: buyDate,
    });

    detail = await setBondTerms(detail);

    // Thuế tự tính = 30.000 (5% × 600.000) không đổi; hạ gross tay xuống
    // 20.000 -> 20.000 < 30.000 -> phải bị chặn bởi guard so với gross CUỐI
    // CÙNG (đã override), không phải gross tự tính (600.000, sẽ không chặn
    // nếu guard bị revert).
    const form = await detail.goToNewDividend();
    await form.setDate(couponDate);
    await form.setGrossAmountOverride("20000");
    await form.submit();

    await expect(
      page.getByText("Thuế không thể lớn hơn tiền lãi gộp của kỳ này"),
    ).toBeVisible();
    await expect(form.successHeading(symbol)).toHaveCount(0);

    const holdingId = holdingIdFromUrl(detail.url);
    const dividend = await db.dividend.findFirst({
      where: { holdingId, type: "BOND_COUPON" },
    });
    expect(dividend).toBeNull();
  } finally {
    await closeContext(context);
    await cleanupTestUser(session.userId);
  }
});
