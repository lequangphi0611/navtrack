import type { Locator, Page } from "@playwright/test";

// Màn hình chi tiết một vị thế (/holdings/[id]). Nhận holdingUrl (base URL
// sạch) từ nơi tạo/điều hướng tới nó — không tự đoán id.
export class HoldingDetailPage {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  async goto() {
    await this.page.goto(this.holdingUrl);
  }

  heading(symbol: string): Locator {
    return this.page.getByRole("heading", { name: symbol });
  }

  get quantityText(): Locator {
    return this.page.getByText(/^[\d.,]+ cổ phần$/);
  }

  get avgCost(): Locator {
    return this.page.getByText("Giá vốn bình quân").locator("..");
  }

  get sellExceedsQuantityError(): Locator {
    return this.page.getByText(/Bán vượt quá số lượng/);
  }

  get deleteBlockedError(): Locator {
    return this.page.getByText(/Không thể xóa — có giao dịch bán sau đó/);
  }

  // Một dòng trong "Lịch sử giao dịch", chọn theo nội dung ổn định (số tiền)
  // qua data-testid="transaction-row" (TransactionHistoryList.tsx) — trước đây
  // bám class Tailwind (`div.rounded-2xl.border-border`), giòn với đổi style
  // (GOTCHAS #10). Component không có role list/listitem sẵn nên đây là ngoại
  // lệ có kiểm soát theo rule mục 5, không phải mặc định.
  transactionRow(amount: string): Locator {
    return this.page.getByTestId("transaction-row").filter({ hasText: amount });
  }

  // Bấm "Xóa" trên dòng giao dịch khớp `amount`. Gọi listener dialog ngay
  // trước khi click (window.confirm chặn action — GOTCHAS #12). Không
  // waitForURL: deleteTransaction không điều hướng (rule mục 6).
  async deleteTransaction(amount: string) {
    this.page.once("dialog", (dialog) => dialog.accept());
    await this.transactionRow(amount)
      .getByRole("button", { name: "Xóa" })
      .click();
  }
}
