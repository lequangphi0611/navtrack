import type { Locator, Page } from "@playwright/test";

import { stripQuery } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";
import { NewHoldingPage } from "./new-holding-page";

// Khớp cả khi bấm vào 1 vị thế từ tab "Mở" lẫn "Đã đóng" — không kèm cashflowId
// (khác redirect sau tạo/ghi giao dịch), chỉ điều hướng thường qua link.
const HOLDING_DETAIL_URL = /\/holdings\/(?!new$|closed$)[a-z0-9]+$/;

// Màn hình danh sách vị thế (/holdings, /holdings/closed) — hai tab cùng route
// gốc, xem HoldingsSegmentedNav.
export class HoldingsPage {
  readonly url = "/holdings";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get emptyState(): Locator {
    return this.page.getByText("Chưa có vị thế nào");
  }

  get closedTab(): Locator {
    return this.page.getByRole("link", { name: "Đã đóng" });
  }

  holdingLink(symbol: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(symbol) });
  }

  // CTA "Khai báo vị thế đầu tiên" (rỗng) hoặc FAB "Khai báo vị thế mới" (đã
  // có holding) — cùng đích /holdings/new, gộp 1 locator theo nghĩa chung
  // thay vì rẽ nhánh theo trạng thái rỗng/không rỗng trong page object.
  get newHoldingLink(): Locator {
    return this.page.getByRole("link", { name: /Khai báo vị thế/ });
  }

  async goToNewHolding(): Promise<NewHoldingPage> {
    const newHoldingPage = new NewHoldingPage(this.page);
    await this.newHoldingLink.click();
    await this.page.waitForURL(newHoldingPage.url);
    return newHoldingPage;
  }

  async openHolding(symbol: string): Promise<HoldingDetailPage> {
    await this.holdingLink(symbol).click();
    await this.page.waitForURL(HOLDING_DETAIL_URL);
    return new HoldingDetailPage(this.page, stripQuery(this.page.url()));
  }

  async openClosed() {
    await this.closedTab.click();
    await this.page.waitForURL("/holdings/closed");
  }
}
