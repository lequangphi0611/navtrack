import type { Locator, Page } from "@playwright/test";

// "/" — Dashboard tổng quan (mockup 2a/2f). Page object tối giản, chỉ chứa
// phần cutoff.spec.ts cần (link "Mốc chốt" đầu màn) — mở rộng thêm khi POM
// hoá dashboard.spec.ts/nav-override.spec.ts (issue #92).
export class DashboardPage {
  readonly url = "/";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get cutoffLink(): Locator {
    return this.page.getByRole("link", { name: /Mốc chốt/ });
  }
}
