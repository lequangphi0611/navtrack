import type { Locator, Page } from "@playwright/test";

import { fillDatePicker } from "../support/date-picker";
import { HoldingDetailPage } from "./holding-detail-page";

type SavePriceInput = {
  price: number;
  // yyyy-MM-dd
  date: string;
};

// Form nhập giá tay (NavOverride, /holdings/[id]/price — component
// src/features/holdings/components/NavOverrideForm). HoldingDetailScreen hiện
// CHƯA wiring link tới màn này (chưa có nút thật để bấm từ trang chi tiết, xem
// process/UI_phase_2.md mục 2c) nên goto() ở đây là bắt buộc (case 2, mục 4
// rule doc), không phải lựa chọn thay flow.
export class NavOverrideForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  async goto() {
    await this.page.goto(`${this.holdingUrl}/price`);
  }

  private get priceInput() {
    return this.page.locator('input[name="price"]');
  }

  // PageHeader variant="close" -> aria-label "Đóng" (backHref = closeHref,
  // tính theo route fan-in — xem lib/routes.ts::resolveBackHref).
  get closeLink(): Locator {
    return this.page.getByRole("link", { name: "Đóng" });
  }

  private get submitButton() {
    return this.page.getByRole("button", { name: "Lưu giá nhập tay" });
  }

  // saveNavOverride (Server Action) redirect về đúng holdingUrl khi thành công
  // — KHÔNG gắn cashflowId (khác 4 action mua/bán trong TransactionForm), nên
  // waitForURL khớp chính xác holdingUrl thay vì afterTransactionUrl (xem
  // GOTCHAS #1, docs/rules/e2e-page-object.md mục 6 ngoại lệ).
  async save({ price, date }: SavePriceInput): Promise<HoldingDetailPage> {
    await this.priceInput.fill(String(price));
    // Bước CUỐI trước submit (GOTCHAS #2).
    await fillDatePicker(this.page, "date", date);
    await this.submitButton.click();
    await this.page.waitForURL(this.holdingUrl);
    return new HoldingDetailPage(this.page, this.holdingUrl);
  }
}
