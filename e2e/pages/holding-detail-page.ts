import type { Locator, Page } from "@playwright/test";

import { BondTermsForm } from "./bond-terms-form";
import { DividendForm } from "./dividend-form";
import { HoldingsPage } from "./holdings-page";
import { MaturitySettlementForm } from "./maturity-settlement-form";
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

  get newDividendLink(): Locator {
    return this.page.getByRole("link", { name: "Ghi cổ tức" });
  }

  async goToNewDividend(): Promise<DividendForm> {
    await this.newDividendLink.click();
    await this.page.waitForURL(`${this.holdingUrl}/dividends/new`);
    return new DividendForm(this.page, this.holdingUrl);
  }

  // BondActionsRow (Phase 7, chỉ vị thế BOND) — nhãn đổi "Nhập điều khoản" ->
  // "Điều khoản" một khi BondTerms đã tồn tại, regex khớp cả hai bằng chung
  // cụm từ "điều khoản" thay vì hard-code 1 trong 2 nhãn.
  get bondTermsLink(): Locator {
    return this.page.getByRole("link", { name: /điều khoản/i });
  }

  async goToBondTerms(): Promise<BondTermsForm> {
    await this.bondTermsLink.click();
    await this.page.waitForURL(`${this.holdingUrl}/bond-terms`);
    return new BondTermsForm(this.page, this.holdingUrl);
  }

  // Chỉ hiện khi holding đã có BondTerms (bond.hasTerms — BondActionsRow).
  get maturitySettlementLink(): Locator {
    return this.page.getByRole("link", { name: "Tất toán đáo hạn" });
  }

  async goToMaturitySettlement(): Promise<MaturitySettlementForm> {
    await this.maturitySettlementLink.click();
    await this.page.waitForURL(`${this.holdingUrl}/maturity`);
    return new MaturitySettlementForm(this.page, this.holdingUrl);
  }

  // Badge nguồn giá "Tự động"/"Nhập tay" (PriceSourceBadge) — chỉ check case
  // "Nhập tay" xuất hiện đúng lúc, không cần locator riêng cho "Tự động".
  get manualPriceBadge(): Locator {
    return this.page.getByText("Nhập tay", { exact: true });
  }

  // CashflowTimeline — mỗi dòng gắn data-testid="cashflow-row" (thêm ở
  // CashflowTimeline.tsx, ngoại lệ có kiểm soát theo rule mục 5, thay cho
  // selector cũ bám class Tailwind `.rounded-2xl.border.border-border.bg-card
  // > div`, GOTCHAS #10). Component không có role list/listitem sẵn.
  get cashflowTimelineRows(): Locator {
    return this.page.getByTestId("cashflow-row");
  }

  // Card XIRR (ReturnMetrics.tsx) — dùng ở test đối chiếu XIRR trước/sau đổi
  // paymentDate cổ tức (issue #65). "XIRR" (nhãn) -> cha (row label+badge) ->
  // cha (card) -> giá trị nằm SIBLING của row, cùng trong card.
  get xirrCard(): Locator {
    return this.page
      .getByText("XIRR", { exact: true })
      .locator("..")
      .locator("..");
  }

  get xirrValue(): Locator {
    return this.xirrCard.getByText(/^[+−]\d+,\d%$/);
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
  //
  // Neo biên không-phải-số quanh `amount` (thay vì substring tự do) — tránh
  // khớp nhầm khi 2 giao dịch có số tiền chứa nhau (vd "80.000" là substring
  // của "180.000", review PR #97 finding #4).
  transactionRow(amount: string): Locator {
    const escaped = amount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.page
      .getByTestId("transaction-row")
      .filter({ hasText: new RegExp(`(?<!\\d)${escaped}(?!\\d)`) });
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
