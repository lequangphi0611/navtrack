import type { Page } from "@playwright/test";

import { stripQuery } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";

// Redirect sau tạo vị thế mới gắn `?cashflowId=` vào URL chi tiết, nhưng id vị
// thế chưa biết trước (khác `afterTransactionUrl` ở support/urls.ts, vốn cần
// baseUrl đã biết) — riêng cho luồng "tạo mới".
const NEW_HOLDING_REDIRECT =
  /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/;

type CreateHoldingInput = {
  symbol: string;
  quantity: number;
  pricePerUnit: number;
};

// Màn hình tạo vị thế mới (/holdings/new). Vào màn này qua
// HoldingsPage.goToNewHolding() (click FAB/CTA) — goto() ở đây chỉ dành cho
// ca cần vào thẳng màn (vd test validation form sau này), không dùng trong
// luồng chính. Cũng dùng lại cho ca "mua trùng mã đang giữ" — form tự gộp
// vào Holding cũ thay vì tạo bản ghi mới.
export class NewHoldingPage {
  readonly url = "/holdings/new";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  private get symbolInput() {
    return this.page.getByPlaceholder("VD: FPT", { exact: true });
  }

  private get quantityInput() {
    return this.page.locator('input[name="quantity"]');
  }

  private get priceInput() {
    return this.page.locator('input[name="pricePerUnit"]');
  }

  private get submitButton() {
    return this.page.getByRole("button", { name: "Xong", exact: true });
  }

  // Điều hướng đích chắc chắn (trang chi tiết vị thế vừa tạo) -> trả về
  // HoldingDetailPage để spec nối chuỗi (rule mục 4).
  async create({
    symbol,
    quantity,
    pricePerUnit,
  }: CreateHoldingInput): Promise<HoldingDetailPage> {
    await this.symbolInput.fill(symbol);
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    await this.submitButton.click();
    await this.page.waitForURL(NEW_HOLDING_REDIRECT);
    return new HoldingDetailPage(this.page, stripQuery(this.page.url()));
  }
}
