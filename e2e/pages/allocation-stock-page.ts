import type { Locator, Page } from "@playwright/test";

import { NavOverrideForm } from "./nav-override-form";

// "/allocation/stock" — drill-down "% theo mã trong nhóm cổ phiếu" (issue
// #131/#132, mockup 131a-d, process/DECISION.md 2026-08-16: route riêng
// full-screen, không phải accordion). Chỉ tới được qua
// AllocationPage.goToStockDetail() (bấm dòng legend "Cổ phiếu") trong luồng
// bình thường — goto() ở đây giữ cho ca cần vào thẳng (rule mục 4, case 3).
export class AllocationStockPage {
  readonly url = "/allocation/stock";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get emptyState(): Locator {
    return this.page.getByText("Chưa tính được tỉ trọng");
  }

  // Mã ĐÃ có giá — Holding.name mặc định null (form tạo vị thế không bắt buộc
  // nhập) nên `name` fallback về `symbol` (getStockAllocationDetail()), khiến
  // symbol xuất hiện 2 lần liền nhau trong DOM của một dòng (span symbol + span
  // name) — `.first()` luôn trúng span symbol (đứng trước trong DOM).
  symbolInList(symbol: string): Locator {
    return this.page.getByText(symbol, { exact: true }).first();
  }

  get sortToggle(): Locator {
    return this.page.getByRole("button", {
      name: /% giảm dần|Theo mã A→Z/,
    });
  }

  // CTA "Cập nhật giá" trong khu vực "Không tính vào tỉ trọng" (mã thiếu giá,
  // mockup 131b) — chỉ dùng khi test chỉ có ĐÚNG 1 mã thiếu giá (không phân
  // biệt theo symbol, giữ page object mỏng đúng nhu cầu hiện có).
  get missingPriceUpdateLink(): Locator {
    return this.page.getByRole("link", { name: "Cập nhật giá" });
  }

  // Footer "Tổng nhóm cổ phiếu" (card tint indigo cuối danh sách) — gộp %
  // tổng + mẫu số NAV nhóm trên cùng 1 dòng.
  get groupTotalFooter(): Locator {
    return this.page.getByText("Tổng nhóm cổ phiếu").locator("..");
  }

  // holdingUrl ĐÃ biết trước (test tự tạo Holding đó) — CTA trỏ đúng
  // ROUTES.navOverrideNew(holdingId) = `${holdingUrl}/price`.
  async goToUpdatePrice(holdingUrl: string): Promise<NavOverrideForm> {
    await this.missingPriceUpdateLink.click();
    await this.page.waitForURL(`${holdingUrl}/price`);
    return new NavOverrideForm(this.page, holdingUrl);
  }
}
