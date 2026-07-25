import type { Locator, Page } from "@playwright/test";

import { DashboardPage } from "./dashboard-page";
import { HoldingsPage } from "./holdings-page";
import { SettingsPage } from "./settings-page";

// BottomNav — thanh điều hướng cố định dùng chung 3 màn gốc (Tổng quan/Danh
// mục/Cài đặt), KHÔNG có ở màn con/form (component object vì xuất hiện nhiều
// màn, rule mục 2). Quan trọng cho test soft-nav (issue #77): điều hướng qua
// đây dùng <Link> thật, KHÔNG page.goto() — giữ nguyên Router Cache của
// Next.js để bài test bắt đúng bug/regression re-hydrate dữ liệu cũ.
export class BottomNav {
  constructor(private readonly page: Page) {}

  // Scope qua getByRole("navigation") — DashboardScreen có 1 link header
  // KHÁC (chip mốc chốt, aria-label="Cài đặt", cùng trỏ /settings) trùng tên
  // accessible với tab này; không scope sẽ khớp cả 2, Playwright strict mode
  // ném lỗi (phát hiện lúc verify PR #81, e2e/tests/privacy-mode.spec.ts).
  private get nav(): Locator {
    return this.page.getByRole("navigation");
  }

  get dashboardTab(): Locator {
    return this.nav.getByRole("link", { name: "Tổng quan" });
  }

  get holdingsTab(): Locator {
    return this.nav.getByRole("link", { name: "Danh mục" });
  }

  get settingsTab(): Locator {
    return this.nav.getByRole("link", { name: "Cài đặt" });
  }

  async goToDashboard(): Promise<DashboardPage> {
    const dashboardPage = new DashboardPage(this.page);
    await this.dashboardTab.click();
    await this.page.waitForURL(dashboardPage.url);
    return dashboardPage;
  }

  async goToHoldings(): Promise<HoldingsPage> {
    const holdingsPage = new HoldingsPage(this.page);
    await this.holdingsTab.click();
    await this.page.waitForURL(holdingsPage.url);
    return holdingsPage;
  }

  async goToSettings(): Promise<SettingsPage> {
    const settingsPage = new SettingsPage(this.page);
    await this.settingsTab.click();
    await this.page.waitForURL(settingsPage.url);
    return settingsPage;
  }
}
