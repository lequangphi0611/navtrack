import type { Locator, Page } from "@playwright/test";

import { HoldingDetailPage } from "./holding-detail-page";
import { NewHoldingPage } from "./new-holding-page";

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

  // HoldingsGroupCard ghép SL + giá chung 1 dòng ("100 cổ phần · giá 150k")
  // — không exact:true (khác HoldingDetailPage.quantityText, nơi SL đứng
  // riêng 1 dòng).
  quantityNote(text: string): Locator {
    return this.page.getByText(text);
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

  // Nhận `holdingUrl` đã biết trước (từ NewHoldingPage.create() hoặc
  // HoldingDetailPage.url của cùng vị thế) để `waitForURL` pin ĐÚNG URL đó —
  // không dùng regex khớp bất kỳ holding nào. Bug router-cache (issue #77)
  // khiến điều hướng dừng ở URL cũ vẫn khớp regex lỏng, chỉ pin đúng URL mới
  // bắt được sai lệch ngay tại điểm điều hướng (thay vì trôi xuống assertion
  // nghiệp vụ phía sau mới lộ ra, nếu lộ ra).
  async openHolding(
    symbol: string,
    holdingUrl: string,
  ): Promise<HoldingDetailPage> {
    await this.holdingLink(symbol).click();
    await this.page.waitForURL(holdingUrl);
    return new HoldingDetailPage(this.page, holdingUrl);
  }

  async openClosed() {
    await this.closedTab.click();
    await this.page.waitForURL("/holdings/closed");
  }
}
