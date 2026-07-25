import type { Locator, Page } from "@playwright/test";

import { SnapshotDetailPage } from "./snapshot-detail-page";

// "/snapshots" — Lịch sử NAV + SnapshotFreezeSheet ("Chốt số liệu hôm nay",
// mockup 3a/3b) + "Các mốc đã chốt" (SnapshotHistoryList, mockup 3a, issue
// #83 load-more). Component freeze tự chứa trigger + Sheet (không tách route
// riêng), nên gói chung vào 1 page object thay vì tách component object —
// chỉ 1 màn dùng, không tái sử dụng nơi khác (khác TransactionHoldingPicker,
// mở từ FAB Dashboard). Chi tiết 1 mốc (/snapshots/[id]) là route RIÊNG ->
// SnapshotDetailPage (issue #96).
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

  // Dòng "live" (mốc hôm nay, tính động không lưu) luôn đứng đầu danh sách.
  get liveRowNote(): Locator {
    return this.page.getByText(/tính động, chưa lưu/);
  }

  periodBadge(label: "ĐỊNH KỲ" | "CUỐI NĂM" | "THỦ CÔNG"): Locator {
    return this.page.getByText(label, { exact: true });
  }

  get loadMoreButton(): Locator {
    return this.page.getByRole("button", { name: "Xem thêm" });
  }

  async loadMore() {
    await this.loadMoreButton.click();
  }

  // Nội dung dòng lịch sử (số tiền compact, "N snapshot"...) khác nhau tuỳ
  // test — expose chung thay vì hard-code từng nhãn.
  entry(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }

  // Bấm vào 1 dòng "frozen" (Link thật, href ROUTES.snapshotDetail(id)) ->
  // suy id từ URL vừa điều hướng tới, trả SnapshotDetailPage để spec nối
  // chuỗi (rule mục 4).
  async openEntry(label: string | RegExp): Promise<SnapshotDetailPage> {
    await this.page.getByRole("link", { name: label }).click();
    await this.page.waitForURL(/\/snapshots\/[^/]+$/);
    const id = new URL(this.page.url()).pathname.split("/").pop();
    if (!id)
      throw new Error(`Không lấy được snapshot id từ URL: ${this.page.url()}`);
    return new SnapshotDetailPage(this.page, id);
  }
}
