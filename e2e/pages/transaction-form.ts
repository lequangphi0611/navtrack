import type { Locator, Page } from "@playwright/test";

import { fillDatePicker, selectDateOnCalendar } from "../support/date-picker";
import { afterTransactionUrl } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";

type TransactionInput = {
  quantity: number;
  pricePerUnit: number;
};

// Form ghi nhận giao dịch mua/bán (/holdings/[id]/transactions/new) — component
// object dùng lại ở nhiều spec khác (nav-override, tax-and-fee, dividends...).
// Không tự goto(): luôn mở qua HoldingDetailPage.goToNewTransaction() (click
// "Thêm giao dịch"), nhận sẵn holdingUrl từ đó. Cũng phục vụ luồng SỬA giao
// dịch (/holdings/[id]/transactions/[cashflowId]/edit) qua static
// openForEdit() — cùng component React, chỉ khác action/giá trị khởi tạo.
export class TransactionForm {
  constructor(
    private readonly page: Page,
    private readonly holdingUrl: string,
  ) {}

  // Có link "Sửa" thật trên mỗi dòng Lịch sử giao dịch
  // (TransactionHistoryList.tsx), nhưng spec tax-and-fee cần đúng cashflowId
  // vừa ghi (đọc từ query `?cashflowId=` sau khi submit) — goto thẳng theo id
  // chính xác hơn dò lại đúng dòng theo số tiền hiển thị (rule mục 4, case 2:
  // truy cập thẳng URL có chủ đích).
  static async openForEdit(
    page: Page,
    holdingUrl: string,
    cashflowId: string,
  ): Promise<TransactionForm> {
    await page.goto(`${holdingUrl}/transactions/${cashflowId}/edit`);
    return new TransactionForm(page, holdingUrl);
  }

  private get quantityInput() {
    return this.page.locator('input[name="quantity"]');
  }

  private get priceInput() {
    return this.page.locator('input[name="pricePerUnit"]');
  }

  private get sellToggle() {
    return this.page.getByRole("button", { name: "Bán", exact: true });
  }

  private get submitBuyButton() {
    return this.page.getByRole("button", { name: "Ghi nhận giao dịch mua" });
  }

  private get submitSellButton() {
    return this.page.getByRole("button", { name: "Ghi nhận giao dịch bán" });
  }

  get closeLink() {
    return this.page.getByRole("link", { name: "Đóng" });
  }

  get feeInput(): Locator {
    return this.page.getByLabel("Phí giao dịch");
  }

  // Khối card bao quanh field phí (badge "TỰ ĐIỀN · SỬA ĐƯỢC" + nút "Đặt lại").
  get feeCard(): Locator {
    return this.feeInput.locator("..").locator("..");
  }

  // Chỉ xuất hiện khi đang ở nhánh Bán (toggleSell()) — Mua không có field này.
  get saleTaxInput(): Locator {
    return this.page.getByLabel("Thuế bán");
  }

  get taxCard(): Locator {
    return this.saleTaxInput.locator("..").locator("..");
  }

  // Nút "Đặt lại" của 1 card thuế/phí cụ thể — nhận `card` (feeCard/taxCard)
  // thay vì hard-code 1 trong 2, vì cả 2 card đều có nút này.
  resetButton(card: Locator): Locator {
    return card.getByRole("button", { name: "Đặt lại" });
  }

  // Hiện khi mở form SỬA chưa đổi field nào — giá trị đang hiện là GIÁ TRỊ ĐÃ
  // LƯU, không phải formula tính lại (bugfix "không ghi đè taxAmount/feeAmount
  // ngoài ý muốn").
  get savedValueNote(): Locator {
    return this.page.getByText(
      "Giá trị đã lưu cho giao dịch này — sửa tay nếu cần khớp lại.",
    );
  }

  // SellRecomputeCompareCard (chỉ hiện ở form SỬA khi đổi ngày một SELL đã
  // ghi) — so sánh giá trị cũ (đã lưu, gạch ngang) với giá trị tính lại theo
  // suất hiệu lực tại ngày mới.
  get sellDateChangedNote(): Locator {
    return this.page.getByText("Bạn đổi ngày bán");
  }

  get taxRecomputeCard(): Locator {
    return this.page.getByText("Thuế bán · tính lại").locator("../..");
  }

  get feeRecomputeCard(): Locator {
    return this.page.getByText("Phí giao dịch · tính lại").locator("../..");
  }

  get updateButton(): Locator {
    return this.page.getByRole("button", { name: "Cập nhật giao dịch" });
  }

  // Khối "{tên/mã} · {SL} đang giữ" đầu form (TransactionForm.tsx dòng ~389)
  // — không `exact: true` vì text node của symbol không tách riêng khỏi span
  // con liền kề (SL + "đang giữ").
  holdingSummary(symbol: string): Locator {
    return this.page.getByText(new RegExp(symbol));
  }

  // Huỷ form, quay lại trang chi tiết vị thế (backHref của PageHeader variant
  // "close" — src/app/(dashboard)/holdings/[id]/transactions/new/page.tsx).
  async close(): Promise<HoldingDetailPage> {
    const detail = new HoldingDetailPage(this.page, this.holdingUrl);
    await this.closeLink.click();
    await this.page.waitForURL(this.holdingUrl);
    return detail;
  }

  // Fill riêng lẻ — dùng khi spec cần kiểm tra giá trị trung gian (preview
  // thuế/phí) trước khi submit, khác submitBuy()/submitSell() vốn fill+submit
  // 1 lượt.
  async fillQuantity(quantity: number) {
    await this.quantityInput.fill(String(quantity));
  }

  async fillPricePerUnit(pricePerUnit: number) {
    await this.priceInput.fill(String(pricePerUnit));
  }

  async toggleSell() {
    await this.sellToggle.click();
  }

  // Chọn ngày qua UI thật (selectDateOnCalendar, KHÔNG fillDatePicker) — form
  // này tính lại thuế/phí theo state `date` mỗi lần đổi (SellRecomputeCompareCard
  // ở form sửa), fillDatePicker chỉ ghi DOM nên không trigger re-render các
  // nhánh phụ thuộc `date` (GOTCHAS #2).
  async changeDate(date: Date) {
    await selectDateOnCalendar(this.page, date);
  }

  // Ghi thẳng DOM (KHÔNG qua UI thật) — chỉ dùng khi spec KHÔNG cần preview
  // thuế/phí phản ứng theo ngày (vd chỉ dựng data test, không assert số tiền
  // tính lại). Bước CUỐI trước submit (GOTCHAS #2). Cần vậy thì dùng
  // changeDate() (selectDateOnCalendar) thay vì hàm này.
  async fillDate(isoDate: string) {
    await fillDatePicker(this.page, "date", isoDate);
  }

  // Submit khi field đã tự fill riêng qua fillQuantity/fillPricePerUnit/
  // toggleSell/changeDate ở trên — khác submitSell() (tự fill rồi submit 1
  // lượt), dùng cho luồng tax-and-fee cần kiểm tra giá trị trung gian.
  async confirmSell() {
    await this.submitSellButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  // Submit form SỬA (mở qua openForEdit()) — nút "Cập nhật giao dịch", khác
  // "Ghi nhận giao dịch mua/bán" của form tạo mới.
  async confirmUpdate() {
    await this.updateButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  async submitBuy({ quantity, pricePerUnit }: TransactionInput) {
    await this.fillQuantity(quantity);
    await this.fillPricePerUnit(pricePerUnit);
    await this.submitBuyButton.click();
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  // Fill + bấm "Ghi nhận giao dịch bán" — dùng chung cho submitSell() (ca
  // hợp lệ, có redirect) và submitSellExceedingQuantity() (ca bị chặn, không
  // redirect) để không lặp 2 lần cùng chuỗi toggle/fill (review PR #97 finding #6).
  private async fillAndSubmitSell({
    quantity,
    pricePerUnit,
  }: TransactionInput) {
    await this.toggleSell();
    await this.fillQuantity(quantity);
    await this.fillPricePerUnit(pricePerUnit);
    await this.submitSellButton.click();
  }

  async submitSell(input: TransactionInput) {
    await this.fillAndSubmitSell(input);
    await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  }

  // Bán vượt số lượng đang giữ bị chặn -> không redirect, spec tự expect lỗi
  // qua HoldingDetailPage.sellExceedsQuantityError. Không dùng chung
  // submitSell() (vốn chờ waitForURL) vì ca này cố ý không điều hướng.
  async submitSellExceedingQuantity(input: TransactionInput) {
    await this.fillAndSubmitSell(input);
  }
}
