import type { Locator, Page } from "@playwright/test";

import { stripQuery } from "../support/urls";
import { TransactionForm } from "./transaction-form";

// Chọn holding xong điều hướng thẳng ROUTES.newTransaction(holdingId) (issue
// #138) — id chưa biết trước, khác afterTransactionUrl (cần baseUrl đã biết).
// Cùng giá trị pattern với transaction-holding-picker.ts (2 nơi độc lập, khác
// ngữ cảnh: kia mở từ FAB Dashboard, đây mở từ TRONG chính TransactionForm).
const NEW_TRANSACTION_URL = /\/holdings\/(?!new)[a-z0-9]+\/transactions\/new$/;

// HoldingSwitcher (src/components/HoldingSwitcher, issue #138) — pill "Đổi mã"
// đầu form, mở Sheet chọn mã khác. Dùng chung ở CẢ TransactionForm lẫn
// DividendForm (Props tổng quát hoá cùng component), nhưng component object
// này hiện chỉ có action điều hướng đích cho TransactionForm — DividendForm
// chưa có spec cần đổi mã qua switcher (issue #138 scope UI/data cho
// TransactionForm, xem process/phase-x tương ứng).
//
// Scope theo role="dialog" (@base-ui/react/dialog, cùng pattern
// TransactionHoldingPicker) để tránh strict-mode violation với nội dung khác
// cùng hiện tên mã phía sau Sheet.
export class HoldingSwitcher {
  private readonly sheet: Locator;

  constructor(private readonly page: Page) {
    this.sheet = page.getByRole("dialog");
  }

  // Accessible name của pill gộp cả tên/mã/badge/SL/giá vốn (nội dung động) —
  // chỉ khớp cụm "Đổi mã" cố định luôn nằm cuối (HoldingSwitcher.tsx) để không
  // phải liệt kê hết nội dung động.
  get trigger(): Locator {
    return this.page.getByRole("button", { name: /Đổi mã/ });
  }

  get title(): Locator {
    return this.sheet.getByText("Chọn mã giao dịch");
  }

  optionEntry(symbol: string): Locator {
    return this.sheet.getByRole("link", { name: new RegExp(symbol) });
  }

  get searchInput(): Locator {
    return this.sheet.getByPlaceholder("Tìm mã…");
  }

  get noMatchState(): Locator {
    return this.sheet.getByText("Không tìm thấy mã phù hợp.");
  }

  async open() {
    await this.trigger.click();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  // Trả TransactionForm để spec nối chuỗi (rule mục 4) — suy ra holdingUrl từ
  // URL vừa điều hướng tới (bỏ hậu tố /transactions/new), cùng kỹ thuật
  // TransactionHoldingPicker.selectHolding().
  async selectHoldingForTransaction(symbol: string): Promise<TransactionForm> {
    await this.optionEntry(symbol).click();
    await this.page.waitForURL(NEW_TRANSACTION_URL);
    const holdingUrl = stripQuery(this.page.url()).replace(
      /\/transactions\/new$/,
      "",
    );
    return new TransactionForm(this.page, holdingUrl);
  }
}
