import type { Page } from "@playwright/test";

import { fillDatePicker } from "../support/date-picker";
import { stripQuery } from "../support/urls";
import { HoldingDetailPage } from "./holding-detail-page";

// Redirect sau tạo vị thế mới gắn `?cashflowId=` vào URL chi tiết, nhưng id vị
// thế chưa biết trước (khác `afterTransactionUrl` ở support/urls.ts, vốn cần
// baseUrl đã biết) — riêng cho luồng "tạo mới".
const NEW_HOLDING_REDIRECT =
  /\/holdings\/(?!new)[a-z0-9]+\?cashflowId=[a-z0-9]+$/;

// Nhãn 4 ô lưới "Loại tài sản" (AssetTypeTiles trong NewHoldingForm.tsx) —
// mặc định "Cổ phiếu" đã chọn sẵn, chỉ cần click khi tạo loại khác.
type AssetTypeLabel = "Cổ phiếu" | "Quỹ mở" | "Trái phiếu" | "Vàng";

type CreateHoldingInput = {
  symbol: string;
  quantity: number;
  pricePerUnit: number;
  assetType?: AssetTypeLabel;
  // yyyy-MM-dd — mặc định hôm nay (giữ nguyên giá trị form) nếu không truyền.
  date?: string;
};

// Màn hình tạo vị thế mới (/holdings/new). Vào màn này qua
// HoldingsPage.goToNewHolding() (click FAB/CTA) — goto() ở đây chỉ dành cho
// ca cần vào thẳng màn (vd test validation form sau này), không dùng trong
// luồng chính. Cũng dùng lại cho ca "mua trùng mã đang giữ" — form tự gộp
// vào Holding cũ thay vì tạo bản ghi mới.
export class NewHoldingPage {
  readonly url = "/holdings/new";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  private get symbolInput() {
    return this.page.getByPlaceholder("VD: FPT", { exact: true });
  }

  private get quantityInput() {
    return this.page.locator('input[name="quantity"]');
  }

  private get priceInput() {
    return this.page.locator('input[name="pricePerUnit"]');
  }

  private get submitButton() {
    return this.page.getByRole("button", { name: "Xong", exact: true });
  }

  private assetTypeTile(label: AssetTypeLabel) {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  // Điều hướng đích chắc chắn (trang chi tiết vị thế vừa tạo) -> trả về
  // HoldingDetailPage để spec nối chuỗi (rule mục 4).
  async create({
    symbol,
    quantity,
    pricePerUnit,
    assetType,
    date,
  }: CreateHoldingInput): Promise<HoldingDetailPage> {
    if (assetType) {
      await this.assetTypeTile(assetType).click();
    }
    await this.symbolInput.fill(symbol);
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    if (date) {
      // Bước CUỐI trước submit (GOTCHAS #2) — form không tính lại gì theo
      // state `date` nên ghi thẳng DOM qua fillDatePicker là an toàn.
      await fillDatePicker(this.page, "date", date);
    }
    await this.submitButton.click();
    await this.page.waitForURL(NEW_HOLDING_REDIRECT);
    return new HoldingDetailPage(this.page, stripQuery(this.page.url()));
  }
}
