import type { Page } from "@playwright/test";

import { afterTransactionUrl } from "../support/urls";

type TransactionInput = {
  quantity: number;
  pricePerUnit: number;
};

// Form ghi nhận giao dịch mua/bán (/holdings/[id]/transactions/new) — dùng lại
// ở nhiều spec khác (nav-override, tax-and-fee, dividends...). Nhận sẵn
// holdingUrl (base URL sạch, không cashflowId) từ page object gọi nó.
export class TransactionForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  async goto() {
    await this.page.goto(`${this.holdingUrl}/transactions/new`);
  }

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

  async addBuy({ quantity, pricePerUnit }: TransactionInput) {
    await this.goto();
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitBuyButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  async addSell({ quantity, pricePerUnit }: TransactionInput) {
    await this.goto();
    await this.sellToggle.click();
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitSellButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  // Bán vượt số lượng đang giữ bị chặn -> không redirect, spec tự expect lỗi
  // qua HoldingDetailPage.sellExceedsQuantityError. Không dùng chung addSell()
  // (vốn chờ waitForURL) vì ca này cố ý không điều hướng.
  async submitSellExceedingQuantity({
    quantity,
    pricePerUnit,
  }: TransactionInput) {
    await this.goto();
    await this.sellToggle.click();
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitSellButton.click();
  }
}
