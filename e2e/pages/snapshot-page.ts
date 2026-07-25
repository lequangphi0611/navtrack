import type { Locator, Page } from "@playwright/test";

// "/snapshots" — Lịch sử NAV + SnapshotFreezeSheet ("Chốt số liệu hôm nay",
// mockup 3a/3b). Component tự chứa trigger + Sheet (không tách route riêng),
// nên gói chung vào 1 page object thay vì tách component object — chỉ 1 màn
// dùng, không tái sử dụng nơi khác (khác TransactionHoldingPicker, mở từ FAB
// Dashboard). Mở rộng thêm phần lịch sử/chart khi POM hoá
// snapshot-history.spec.ts (issue #96).
export class SnapshotPage {
  readonly url = "/snapshots";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get openFreezeSheetButton(): Locator {
    return this.page.getByRole("button", { name: "Chốt số liệu hôm nay" });
  }

  get freezeSubmitButton(): Locator {
    return this.page.getByRole("button", { name: "Đóng băng số liệu" });
  }

  get freezeDoneBadge(): Locator {
    return this.page.getByText(/Đã chốt lúc \d{2}:\d{2}/);
  }

  get freezeErrorState(): Locator {
    return this.page.getByText("Không chốt được");
  }

  async openFreezeSheet() {
    await this.openFreezeSheetButton.click();
  }

  async submitFreeze() {
    await this.freezeSubmitButton.click();
  }
}
