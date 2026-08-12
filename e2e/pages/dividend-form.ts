import type { Locator, Page } from "@playwright/test";

import { fillDatePicker } from "../support/date-picker";
import { DividendHistoryPage } from "./dividend-history-page";
import { HoldingDetailPage } from "./holding-detail-page";

// Form ghi nhận cổ tức (/holdings/[id]/dividends/new) — MỘT component cho cả
// Tiền mặt (mặc định) lẫn Cổ phiếu (bấm stockTypeToggle), trạng thái "Đã ghi
// cổ tức" render INLINE (không route riêng, không waitForURL sau submit() —
// xem docstring DividendForm.tsx). Vào form qua HoldingDetailPage.goToNewDividend()
// (click "Ghi cổ tức") khi flow đang test quan tâm tới soft-nav/Router Cache
// (issue #77); dùng goto() trực tiếp cho các test còn lại chỉ cần dựng data.
export class DividendForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  async goto() {
    await this.page.goto(`${this.holdingUrl}/dividends/new`);
  }

  get stockTypeToggle(): Locator {
    return this.page.getByRole("button", { name: "Cổ phiếu", exact: true });
  }

  get percentInput(): Locator {
    return this.page.locator('input[name="percent"]');
  }

  get showOverrideButton(): Locator {
    return this.page.getByRole("button", {
      name: "Sửa số lượng nếu công ty làm tròn khác",
    });
  }

  get overrideInput(): Locator {
    return this.page.locator('input[name="stockQuantityOverride"]');
  }

  get toleranceError(): Locator {
    return this.page.getByText(/Chỉ được lệch tối đa 2 đơn vị/);
  }

  // Card "Lãi gộp" (AutoFilledAmountCard, BondCouponFields — chỉ BOND_COUPON).
  // Input hiển thị KHÔNG có `name` (giá trị thật đi qua input hidden riêng do
  // chính card render, xem docstring AutoFilledAmountCard.tsx) nên phải tra
  // qua aria-label, cùng tiền lệ TransactionForm.saleTaxInput/feeInput.
  get grossAmountInput(): Locator {
    return this.page.getByLabel("Lãi gộp");
  }

  async setGrossAmountOverride(value: string) {
    await this.grossAmountInput.fill(value);
  }

  // Checkbox "Giá hiện tại đã phản ánh đợt chia này" — input thật ẩn (`peer
  // sr-only`, GOTCHAS #11), UI hiển thị qua <label> bao ngoài.
  get reflectsMarketCheckbox(): Locator {
    return this.page.getByRole("checkbox", {
      name: "Giá hiện tại đã phản ánh đợt chia này",
    });
  }

  // BOND_COUPON đổi nhãn nút thành "Ghi trái tức" (SUBMIT_BUTTON_LABEL,
  // DividendForm.tsx) — chỉ một trong hai nhãn hiện diện tại một thời điểm
  // (rẽ theo tab đang chọn) nên regex khớp cả hai vẫn an toàn, không mơ hồ.
  get submitButton(): Locator {
    return this.page.getByRole("button", {
      name: /^(Ghi cổ tức|Ghi trái tức)$/,
    });
  }

  roundedDownNote(rawQuantity: string): Locator {
    return this.page.getByText(
      new RegExp(`Đã làm tròn xuống từ ${rawQuantity}`),
    );
  }

  async selectStockType() {
    await this.stockTypeToggle.click();
  }

  async setPercent(percent: string) {
    await this.percentInput.fill(percent);
  }

  async showOverride() {
    await this.showOverrideButton.click();
  }

  async setOverrideQuantity(quantity: string) {
    await this.overrideInput.fill(quantity);
  }

  // Checkbox ẩn CSS — `.check({ force: true })` vì actionability check của
  // Playwright coi <label> bao ngoài che input tại điểm hit-test, dù người
  // dùng thật click label vẫn toggle checkbox bình thường qua label-for
  // (GOTCHAS #11) — không dùng `.check()` thường.
  async checkPriceReflectsMarket() {
    await this.reflectsMarketCheckbox.check({ force: true });
  }

  // fillDatePicker phải là bước CUỐI trước submit — ghi thẳng DOM, bỏ qua
  // React state (field khác đổi sau đó có thể ghi đè, xem
  // support/date-picker.ts). Form này không tính lại preview theo `date`/
  // `paymentDate` (khác TransactionForm ở tax-and-fee.spec.ts) nên fillDatePicker
  // là lựa chọn đúng, không cần selectDateOnCalendar.
  async setDate(isoDate: string) {
    await fillDatePicker(this.page, "date", isoDate);
  }

  async setPaymentDate(isoDate: string) {
    await fillDatePicker(this.page, "paymentDate", isoDate);
  }

  // Submit — thành công render inline (DividendSuccessContent), không điều
  // hướng nên không waitForURL.
  async submit() {
    await this.submitButton.click();
  }

  // BOND_COUPON đổi tiêu đề màn thành công thành "Đã ghi trái tức"
  // (DividendSuccessContent, DividendForm.tsx) thay vì "Đã ghi cổ tức".
  successHeading(symbol: string): Locator {
    return this.page.getByText(
      new RegExp(`Đã ghi (cổ tức|trái tức) ${symbol}`),
    );
  }

  get historyLink(): Locator {
    return this.page.getByRole("link", { name: "Xem lịch sử cổ tức" });
  }

  async goToHistory(): Promise<DividendHistoryPage> {
    const historyPage = new DividendHistoryPage(this.page, this.holdingUrl);
    await this.historyLink.click();
    await this.page.waitForURL(historyPage.url);
    return historyPage;
  }

  backToHoldingLink(symbol: string): Locator {
    return this.page.getByRole("link", {
      name: new RegExp(`Về chi tiết ${symbol}`),
    });
  }

  async goToHoldingDetail(symbol: string): Promise<HoldingDetailPage> {
    const detail = new HoldingDetailPage(this.page, this.holdingUrl);
    await this.backToHoldingLink(symbol).click();
    await this.page.waitForURL(this.holdingUrl);
    return detail;
  }
}
