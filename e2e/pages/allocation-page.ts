import type { Locator, Page } from "@playwright/test";

import { AllocationStockPage } from "./allocation-stock-page";
import { HoldingsPage } from "./holdings-page";

// "/allocation" — màn chi tiết phân bổ tài sản, route riêng full-screen (mục
// 10 phase-6.md, mockup 6d). Chỉ tới được qua DashboardPage.goToAllocation()
// (bấm AllocationBar) trong luồng bình thường — goto() ở đây giữ cho ca cần
// vào thẳng (rule mục 4, case 3).
export class AllocationPage {
  readonly url = "/allocation";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get emptyState(): Locator {
    return this.page.getByText("Chưa có vị thế nào có giá để tính phân bổ.");
  }

  // Dòng chú giải theo nhóm AssetType ("Cổ phiếu", "Quỹ"...) — filter theo nhãn
  // nhóm (substring, khớp cả khi có note "· gồm CCQ"), nội dung ổn định (không
  // bám vị trí/class).
  legendRow(assetTypeLabel: string): Locator {
    return this.page.getByText(assetTypeLabel).locator("..");
  }

  // Chú thích liên kết khi có Holding đang cảnh báo tập trung (mục 6
  // phase-6.md) — 1 <Link> bọc 2 dòng text riêng biệt trong JSX
  // ("{N} mã đang vượt ngưỡng tập trung" + "Xem bảng vị thế bên dưới."),
  // accessible name của link nối cả hai — match theo dòng đầu là đủ phân biệt.
  get concentrationWarningLink(): Locator {
    return this.page.getByRole("link", {
      name: /mã đang vượt ngưỡng tập trung/,
    });
  }

  async goToHoldingsFromWarning(): Promise<HoldingsPage> {
    const holdingsPage = new HoldingsPage(this.page);
    await this.concentrationWarningLink.click();
    await this.page.waitForURL(holdingsPage.url);
    return holdingsPage;
  }

  // Drill-down "% theo mã trong nhóm cổ phiếu" (issue #131/#132,
  // process/DECISION.md 2026-08-16: route riêng, không accordion) — CHỈ dòng
  // legend "Cổ phiếu" là <Link> thật, các nhóm khác vẫn <div> tĩnh (chưa có
  // view chi tiết theo mã tương ứng).
  get stockGroupLink(): Locator {
    return this.page.getByRole("link", { name: /Cổ phiếu/ });
  }

  async goToStockDetail(): Promise<AllocationStockPage> {
    const stockPage = new AllocationStockPage(this.page);
    await this.stockGroupLink.click();
    await this.page.waitForURL(stockPage.url);
    return stockPage;
  }
}
