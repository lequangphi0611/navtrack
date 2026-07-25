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

  get dashboardTab(): Locator {
    return this.page.getByRole("link", { name: "Tổng quan" });
  }

  get holdingsTab(): Locator {
    return this.page.getByRole("link", { name: "Danh mục" });
  }

  get settingsTab(): Locator {
    return this.page.getByRole("link", { name: "Cài đặt" });
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
