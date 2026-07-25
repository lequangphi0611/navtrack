import type { Locator, Page } from "@playwright/test";

import { TransactionHoldingPicker } from "./transaction-holding-picker";

// "/" — Dashboard tổng quan (mockup 2a/2f).
export class DashboardPage {
  readonly url = "/";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get cutoffLink(): Locator {
    return this.page.getByRole("link", { name: /Mốc chốt/ });
  }

  // "Giá trị thị trường (NAV)" chỉ là label — số NAV thật nằm 2 cấp cha lên,
  // sibling của row label + pill "Lịch sử" (xem DashboardScreen.tsx). Trả về
  // khối chứa cả 2 để spec .toContainText số tiền.
  get navValueBlock(): Locator {
    return this.page
      .getByText("Giá trị thị trường (NAV)")
      .locator("..")
      .locator("..");
  }

  get xirrCard(): Locator {
    return this.page
      .getByText("XIRR (sau thuế)", { exact: true })
      .locator("..");
  }

  get pnlCard(): Locator {
    return this.page
      .getByText("Lãi/lỗ (thực nhận)", { exact: true })
      .locator("..")
      .locator("..");
  }

  get noXirrState(): Locator {
    return this.page.getByText("Chưa tính được");
  }

  get autoPriceFreshnessNote(): Locator {
    return this.page.getByText(/Giá tự động cập nhật EOD/);
  }

  get manualPriceNote(): Locator {
    return this.page.getByText(/dùng giá nhập tay/);
  }

  // "<Loại tài sản> · chưa có giá nhập tay" (Container ghép sẵn theo loại tài
  // sản, xem MissingPriceList.tsx) — danh sách thiếu giá không hiện mã, chỉ
  // tên + loại, nên nhận nguyên reasonLabel thay vì tách theo symbol.
  missingPriceNote(reasonLabel: string): Locator {
    return this.page.getByText(reasonLabel);
  }

  // Khối chênh lệch NAV so với vốn (bug #27: màu/mũi tên phải khớp lãi/lỗ).
  private get navDeltaRow(): Locator {
    return this.page
      .getByText("so với vốn đã bỏ vào", { exact: true })
      .locator("..");
  }

  get navDeltaAmount(): Locator {
    return this.navDeltaRow.locator("span").first();
  }

  get navDeltaIcon(): Locator {
    return this.navDeltaRow.locator("svg");
  }

  private get quickMenuToggle(): Locator {
    return this.page.getByRole("button", { name: "Mở menu nhanh" });
  }

  private get tradeMenuItem(): Locator {
    return this.page.getByRole("button", { name: "Mua / Bán", exact: true });
  }

  // Mở FAB rồi bấm "Mua / Bán" -> mở TransactionHoldingPicker (Sheet, issue
  // #54). Gộp 2 bước bấm thành 1 action vì luôn đi cùng nhau trong mọi spec.
  async openTradePicker(): Promise<TransactionHoldingPicker> {
    await this.quickMenuToggle.click();
    await this.tradeMenuItem.click();
    return new TransactionHoldingPicker(this.page);
  }
}
