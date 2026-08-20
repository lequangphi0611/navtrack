import type { Locator, Page } from "@playwright/test";

import { stripQuery } from "../support/urls";
import { TransactionForm } from "./transaction-form";

// Chọn holding xong điều hướng thẳng ROUTES.newTransaction(holdingId) (issue
// #54) — id chưa biết trước, khác afterTransactionUrl (cần baseUrl đã biết).
// `(\?.*)?$` — Link gắn thêm `?from=dashboard` (route fan-in,
// lib/routes.ts::withEntrySource, process/decisions/architecture-and-code-quality.md
// 2026-08-20), khác holding-switcher.ts (không gắn `from`, mở từ TRONG form).
const NEW_TRANSACTION_URL =
  /\/holdings\/(?!new)[a-z0-9]+\/transactions\/new(\?.*)?$/;

// Sheet chọn mã để giao dịch (component TransactionHoldingPicker, mở từ FAB
// "Mua / Bán" trên Dashboard — issue #54). Scope theo role="dialog"
// (@base-ui/react/dialog) để tránh strict-mode violation với MissingPriceList
// phía sau Sheet (cùng hiện text mã). Không có goto()/url riêng — luôn mở qua
// DashboardPage.openTradePicker().
export class TransactionHoldingPicker {
  private readonly sheet: Locator;

  constructor(private readonly page: Page) {
    this.sheet = page.getByRole("dialog");
  }

  get title(): Locator {
    return this.sheet.getByText("Chọn mã giao dịch");
  }

  holdingEntry(symbol: string): Locator {
    return this.sheet.getByText(symbol, { exact: true });
  }

  get searchInput(): Locator {
    return this.sheet.getByPlaceholder("Tìm mã…");
  }

  get noMatchState(): Locator {
    return this.sheet.getByText("Không tìm thấy mã phù hợp.");
  }

  get emptyState(): Locator {
    return this.sheet.getByText("Chưa có vị thế nào đang mở.");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  // Trả TransactionForm để spec nối chuỗi (rule mục 4) — suy ra holdingUrl từ
  // URL vừa điều hướng tới (bỏ hậu tố /transactions/new).
  async selectHolding(symbol: string): Promise<TransactionForm> {
    await this.holdingEntry(symbol).click();
    await this.page.waitForURL(NEW_TRANSACTION_URL);
    const holdingUrl = stripQuery(this.page.url()).replace(
      /\/transactions\/new$/,
      "",
    );
    return new TransactionForm(this.page, holdingUrl);
  }
}
