import type { Locator, Page } from "@playwright/test";

import { fillDatePicker } from "../support/date-picker";
import { afterTransactionUrl } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";

// Form tất toán đáo hạn trái phiếu (/holdings/[id]/maturity, mockup Phase 7
// Screens 7e đúng mệnh giá / 7f mua chiết khấu). Vào qua
// HoldingDetailPage.goToMaturitySettlement() (click "Tất toán đáo hạn") — chỉ
// hiện khi holding đã có BondTerms (BondActionsRow). Ghi Cashflow{type:
// MATURITY}, KHÔNG phải SELL (docs/domain/07-tax.md "Bán trước hạn vs đáo
// hạn") — redirect sau khi ghi gắn `?cashflowId=` giống mọi giao dịch khác
// (GOTCHAS #1, afterTransactionUrl).
//
// Ngày/SL/giá đều PREFILL sẵn (ngày đáo hạn, toàn bộ SL đang giữ, mệnh giá) —
// setter dưới đây chỉ cần khi spec muốn GHI ĐÈ giá trị mặc định (vd tất toán
// MỘT PHẦN để giữ vị thế còn mở, xem bond-coupon-and-maturity.spec.ts).
export class MaturitySettlementForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  private get quantityInput(): Locator {
    return this.page.locator('input[name="quantity"]');
  }

  private get priceInput(): Locator {
    return this.page.locator('input[name="pricePerUnit"]');
  }

  private get settleButton(): Locator {
    return this.page.getByRole("button", { name: "Ghi tất toán" });
  }

  async setQuantity(quantity: string) {
    await this.quantityInput.fill(quantity);
  }

  async setPricePerUnit(pricePerUnit: string) {
    await this.priceInput.fill(pricePerUnit);
  }

  // Khác BondTermsForm (đọc thẳng React state): submitSettlement()
  // (MaturitySettlementForm.tsx) đọc qua `formData.get(...)` nên
  // fillDatePicker() hoạt động đúng ở ĐÂY — vẫn phải là bước CUỐI trước submit
  // (GOTCHAS #2).
  async setDate(isoDate: string) {
    await fillDatePicker(this.page, "date", isoDate);
  }

  async settle(): Promise<HoldingDetailPage> {
    const detail = new HoldingDetailPage(this.page, this.holdingUrl);
    await this.settleButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
    return detail;
  }
}
