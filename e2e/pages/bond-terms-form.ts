import type { Locator, Page } from "@playwright/test";

import { HoldingDetailPage } from "./holding-detail-page";

// Form nhập/sửa điều khoản trái phiếu (/holdings/[id]/bond-terms, mockup Phase
// 7 Screens 7a). Vào qua HoldingDetailPage.goToBondTerms() (click "Nhập điều
// khoản"/"Điều khoản") — không tự goto(), luôn có link thật từ chi tiết vị thế
// dẫn tới đây (rule mục 4).
//
// BẪY (xem GOTCHAS.md "BondTermsForm đọc thẳng React state, không qua
// FormData"): `submitTerms()` (BondTermsForm.tsx) gọi Server Action bằng các
// biến state, KHÔNG đọc `FormData` khi submit — khác MỌI form khác của repo.
// `fillDatePicker()` (ghi thẳng DOM, bỏ qua onChange) do đó VÔ TÁC DỤNG cho
// `firstCouponDate`/`maturityDate` ở đây; cần set 2 field ngày này thì phải
// dùng `selectDateOnCalendar` (kích hoạt onChange thật, cập nhật state). Hai
// kịch bản e2e bắt buộc của Phase 7 không cần set 2 field ngày này (bỏ trống
// vẫn hợp lệ — trái phiếu chiết khấu/zero-coupon, xem BondTermsFields), nên
// page object này chưa có setter cho chúng — thêm khi có spec thật sự cần.
export class BondTermsForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  private get parValueInput(): Locator {
    return this.page.locator('input[name="parValue"]');
  }

  private get couponRatePercentInput(): Locator {
    return this.page.locator('input[name="couponRatePercent"]');
  }

  private get couponFrequencyMonthsSelect(): Locator {
    return this.page.locator('select[name="couponFrequencyMonths"]');
  }

  private get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Lưu điều khoản" });
  }

  async setParValue(value: string) {
    await this.parValueInput.fill(value);
  }

  async setCouponRatePercent(value: string) {
    await this.couponRatePercentInput.fill(value);
  }

  async setCouponFrequencyMonths(months: "3" | "6" | "12") {
    await this.couponFrequencyMonthsSelect.selectOption(months);
  }

  // issuerType mặc định "Doanh nghiệp" (CORPORATE, thuế 5%) khi vị thế chưa
  // từng nhập điều khoản (getBondTermsFormData) — cả hai kịch bản bắt buộc
  // đều dùng CORPORATE nên chưa cần setter riêng cho SegmentedControl.

  // router.push(ROUTES.holdingDetail) — KHÔNG gắn `?cashflowId=` (đây không
  // phải giao dịch ghi cashflow, khác afterTransactionUrl ở GOTCHAS #1).
  async save(): Promise<HoldingDetailPage> {
    const detail = new HoldingDetailPage(this.page, this.holdingUrl);
    await this.saveButton.click();
    await this.page.waitForURL(this.holdingUrl);
    return detail;
  }
}
