import type { Locator, Page } from "@playwright/test";

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

  async openClosed() {
    await this.closedTab.click();
    await this.page.waitForURL("/holdings/closed");
  }
}
