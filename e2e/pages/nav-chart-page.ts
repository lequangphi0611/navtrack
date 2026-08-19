import type { Locator, Page } from "@playwright/test";

import { NewHoldingPage } from "./new-holding-page";

// Nhãn 4 loại tài sản cụ thể (khớp ASSET_TYPE_LABEL,
// src/components/AssetTypeBadge/AssetTypeBadge.tsx) — dùng cho chip filter +
// CTA "+ Thêm vị thế {Loại}" ở trạng thái rỗng (EmptyAssetTypeState).
type AssetTypeLabel = "Cổ phiếu" | "Quỹ mở" | "Trái phiếu" | "Vàng";
// Chip filter còn có thêm "Tất cả" (AssetTypeFilterChips.tsx) — không có CTA
// tương ứng nên tách type riêng cho action chỉ áp dụng cho 4 loại cụ thể.
type AssetTypeFilterLabel = "Tất cả" | AssetTypeLabel;

// Mã AssetType tương ứng mỗi nhãn — dùng để khớp query `?type=<CODE>` trên URL
// redirect của CTA (NEW_HOLDING_HREF_BY_TYPE, src/app/(dashboard)/nav-chart/page.tsx).
const ASSET_TYPE_CODE: Record<AssetTypeLabel, string> = {
  "Cổ phiếu": "STOCK",
  "Quỹ mở": "FUND",
  "Trái phiếu": "BOND",
  Vàng: "GOLD",
};

// "/nav-chart" — biến động NAV theo loại tài sản (issue #139/#141). Vào màn
// này qua DashboardPage.goToNavChart() (bấm header "Giá trị tài sản" của
// NavTrendChart) trong luồng chính — goto() chỉ dành cho điểm vào đầu test
// không cần đi qua Dashboard trước (rule mục 4, "goto() vs điều hướng qua flow").
export class NavChartPage {
  readonly url = "/nav-chart";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Biến động NAV" });
  }

  // Chip filter (AssetTypeFilterChips.tsx) — <button>, nhãn = chính label hiển
  // thị (chấm màu bên cạnh không có text, không ảnh hưởng accessible name).
  chip(label: AssetTypeFilterLabel): Locator {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  async selectAssetType(label: AssetTypeFilterLabel) {
    await this.chip(label).click();
  }

  // Nhánh "chưa vẽ được đường NAV" (NavTrendByAssetTypeChart.tsx, points.length
  // < 2) — KHÁC HẲN nghĩa với EmptyAssetTypeState bên dưới ("chưa TỪNG có vị
  // thế nào" — filters[type].hasData === false). Loại có ít hơn 2 điểm nhưng
  // ĐÃ từng có vị thế vẫn rơi vào nhánh này, không phải emptyStateTitle.
  get chartUnavailableState(): Locator {
    return this.page.getByText("Chưa vẽ được đường NAV");
  }

  // Card "Cao nhất kỳ" / "Thấp nhất kỳ" (HighLowCard) — CHỈ render khi
  // hasLine === true (points.length >= 2) VÀ periodHigh/periodLow đã set. Bằng
  // chứng dương tính đường NAV đã vẽ được (thay vì chỉ suy ra từ việc
  // chartUnavailableState KHÔNG hiện — count(0) không phân biệt được "vẽ được"
  // với "chart crash/không render gì cả").
  get periodHighLabel(): Locator {
    return this.page.getByText("Cao nhất kỳ", { exact: true });
  }

  // EmptyAssetTypeState (139e) — loại chưa từng có vị thế nào.
  emptyStateTitle(label: AssetTypeLabel): Locator {
    return this.page.getByText(`Bạn chưa có vị thế ${label} nào`, {
      exact: true,
    });
  }

  newHoldingCta(label: AssetTypeLabel): Locator {
    return this.page.getByRole("link", {
      name: `+ Thêm vị thế ${label}`,
      exact: true,
    });
  }

  // Bấm CTA -> redirect `/holdings/new?type=<CODE>` (query pre-select loại,
  // KHÔNG gắn cashflowId — đây là điều hướng TỚI form tạo mới, không phải sau
  // khi ghi giao dịch, nên không cần afterTransactionUrl/support/urls.ts).
  async goToNewHolding(label: AssetTypeLabel): Promise<NewHoldingPage> {
    await this.newHoldingCta(label).click();
    await this.page.waitForURL(
      new RegExp(`/holdings/new\\?type=${ASSET_TYPE_CODE[label]}$`),
    );
    return new NewHoldingPage(this.page);
  }
}

export type { AssetTypeFilterLabel, AssetTypeLabel };
