import type { Locator, Page } from "@playwright/test";

// "/snapshots/[id]" — chi tiết 1 mốc đã đóng băng (mockup 3c/3f). Route riêng
// (khác SnapshotPage ở "/snapshots"), nhận `id` từ nơi tạo/điều hướng tới nó
// (SnapshotPage.openEntry() sau khi click, hoặc dựng thẳng khi test cách ly
// quyền/404 cần id đã biết trước — không có flow UI thật để click tới, rule
// mục 4 case 2/3).
export class SnapshotDetailPage {
  constructor(
    private readonly page: Page,
    private readonly id: string,
  ) {}

  get url(): string {
    return `/snapshots/${this.id}`;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  get navBox(): Locator {
    return this.page.getByText("NAV đã đóng băng").locator("..").locator("..");
  }

  metaValue(label: "Nguồn" | "Chu kỳ" | "Ngày mốc" | "Ghi lúc"): Locator {
    return this.page.getByText(label, { exact: true }).locator("..");
  }

  get breakdownValueBlock(): Locator {
    return this.page
      .getByText("Giá trị từng vị thế")
      .locator("..")
      .locator("..");
  }

  holdingEntry(symbol: string): Locator {
    return this.page.getByText(symbol);
  }

  // 3c — không lệch giá so với lúc chốt, KHÔNG có recomputedComparison (3f).
  get unchangedPriceNote(): Locator {
    return this.page.getByText(/Giá trị đóng băng dùng giá EOD tại/);
  }

  // 3f — khối so sánh "nếu tính lại với giá mới" (chỉ hiện khi giá đã đổi).
  get recomputedHeading(): Locator {
    return this.page.getByText("Nếu tính lại với giá mới");
  }

  // Nội dung còn lại khác nhau tuỳ test (subtitle 3c/3f, số tiền tính từ dữ
  // liệu riêng) — expose chung thay vì hard-code từng nhãn.
  entry(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }
}
