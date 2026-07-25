import type { Locator, Page } from "@playwright/test";

import { HoldingsPage } from "./holdings-page";
import { TransactionForm } from "./transaction-form";

// Màn hình chi tiết một vị thế (/holdings/[id]). Nhận holdingUrl (base URL
// sạch) từ nơi tạo/điều hướng tới nó — không tự đoán id.
export class HoldingDetailPage {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  // Base URL sạch (không cashflowId) — cho ca cần điều hướng trực tiếp không
  // qua UI (vd test cách ly tài khoản: account khác cố truy cập thẳng URL).
  get url(): string {
    return this.holdingUrl;
  }

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

  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Quay lại" });
  }

  // TransactionSnapshotBanner (issue #37) — hiện ngay dưới PageHeader khi vừa
  // ghi giao dịch (redirect gắn `?cashflowId=`, xem afterTransactionUrl).
  get transactionSnapshotBannerHeading(): Locator {
    return this.page.getByText("Đã ghi giao dịch & chốt snapshot");
  }

  // Nhãn giao dịch trong banner (vd "Mua 10 cổ phần") cũng lặp lại ở Lịch sử
  // giao dịch bên dưới — banner render trước trong DOM (ngay dưới
  // PageHeader), `.first()` lấy đúng bản trong banner.
  bannerTransactionLabel(label: string): Locator {
    return this.page.getByText(label).first();
  }

  get snapshotAutoNote(): Locator {
    return this.page.getByText("Snapshot MANUAL tạo tự động sau khi mua");
  }

  get navAfterTransactionNote(): Locator {
    return this.page.getByText("NAV danh mục sau giao dịch");
  }

  // Nhánh "valued" của HoldingDetailScreen (đã có PriceQuote/valuation) —
  // KHÔNG hiện dòng "Số lượng: N cổ phần" riêng như nhánh Phase-1-chưa-định-giá
  // (chỉ quantityText ở trên), nên verify NAV gián tiếp qua khối "Giá trị hiện
  // tại" thay vì số lượng.
  get navBox(): Locator {
    return this.page
      .getByText("Giá trị hiện tại", { exact: true })
      .locator("../..");
  }

  async goBack(): Promise<HoldingsPage> {
    const holdingsPage = new HoldingsPage(this.page);
    await this.backLink.click();
    await this.page.waitForURL(holdingsPage.url);
    return holdingsPage;
  }

  get addTransactionLink(): Locator {
    return this.page.getByRole("link", { name: "Thêm giao dịch" });
  }

  async goToNewTransaction(): Promise<TransactionForm> {
    await this.addTransactionLink.click();
    await this.page.waitForURL(`${this.holdingUrl}/transactions/new`);
    return new TransactionForm(this.page, this.holdingUrl);
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
