import type { Page } from "@playwright/test";

import { afterTransactionUrl } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";

type TransactionInput = {
  quantity: number;
  pricePerUnit: number;
};

// Form ghi nhận giao dịch mua/bán (/holdings/[id]/transactions/new) — component
// object dùng lại ở nhiều spec khác (nav-override, tax-and-fee, dividends...).
// Không tự goto(): luôn mở qua HoldingDetailPage.goToNewTransaction() (click
// "Thêm giao dịch"), nhận sẵn holdingUrl từ đó.
export class TransactionForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  private get quantityInput() {
    return this.page.locator('input[name="quantity"]');
  }

  private get priceInput() {
    return this.page.locator('input[name="pricePerUnit"]');
  }

  private get sellToggle() {
    return this.page.getByRole("button", { name: "Bán", exact: true });
  }

  private get submitBuyButton() {
    return this.page.getByRole("button", { name: "Ghi nhận giao dịch mua" });
  }

  private get submitSellButton() {
    return this.page.getByRole("button", { name: "Ghi nhận giao dịch bán" });
  }

  get closeLink() {
    return this.page.getByRole("link", { name: "Đóng" });
  }

  // Huỷ form, quay lại trang chi tiết vị thế (backHref của PageHeader variant
  // "close" — src/app/(dashboard)/holdings/[id]/transactions/new/page.tsx).
  async close(): Promise<HoldingDetailPage> {
    const detail = new HoldingDetailPage(this.page, this.holdingUrl);
    await this.closeLink.click();
    await this.page.waitForURL(this.holdingUrl);
    return detail;
  }

  async submitBuy({ quantity, pricePerUnit }: TransactionInput) {
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitBuyButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  async submitSell({ quantity, pricePerUnit }: TransactionInput) {
    await this.sellToggle.click();
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitSellButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  // Bán vượt số lượng đang giữ bị chặn -> không redirect, spec tự expect lỗi
  // qua HoldingDetailPage.sellExceedsQuantityError. Không dùng chung
  // submitSell() (vốn chờ waitForURL) vì ca này cố ý không điều hướng.
  async submitSellExceedingQuantity({
    quantity,
    pricePerUnit,
  }: TransactionInput) {
    await this.sellToggle.click();
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitSellButton.click();
  }
}
