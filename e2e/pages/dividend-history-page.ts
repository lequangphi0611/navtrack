import type { Locator, Page } from "@playwright/test";

// Lịch sử cổ tức của 1 vị thế (/holdings/[id]/dividends) — danh sách các lần
// đã ghi (percentLabel suy ngược từ số đã lưu, KHÔNG phải % gốc đã nhập, xem
// DividendHistoryList.tsx). Nội dung mỗi dòng khác nhau tuỳ test (số tiền/tỷ
// lệ tính từ dữ liệu riêng), nên chỉ expose entry() chung thay vì hard-code
// từng nhãn — spec tự truyền text/regex cần khớp.
export class DividendHistoryPage {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  get url(): string {
    return `${this.holdingUrl}/dividends`;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  entry(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }
}
