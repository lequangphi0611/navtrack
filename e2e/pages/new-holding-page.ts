import type { Locator, Page } from "@playwright/test";

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

// Nhãn 2 nhánh NewHoldingSourceToggle (issue #140/#142) — "EXISTING" (mặc
// định form) khai báo tự do, "NEW_PURCHASE" là một giao dịch mua thật (chặn
// trùng mã, tự tính phí). Đặt tên khớp `PositionSource` phía component nguồn
// (NewHoldingSourceToggle.tsx) nhưng khai riêng ở đây — page object không
// import type từ `src/` (giữ e2e độc lập khỏi nội bộ app).
type PositionSource = "EXISTING" | "NEW_PURCHASE";

const SOURCE_LABEL: Record<PositionSource, string> = {
  EXISTING: "Đã có từ trước",
  NEW_PURCHASE: "Vừa mua hôm nay",
};

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

  // PageHeader variant mặc định "back" -> aria-label "Quay lại". `backHref`
  // đổi theo lối vào (route fan-in, `?from=` — lib/routes.ts::resolveBackHref,
  // process/decisions/architecture-and-code-quality.md 2026-08-20).
  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Quay lại" });
  }

  private assetTypeTile(label: AssetTypeLabel) {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  // NewHoldingSourceToggle (SegmentedControl) — 2 nút ngay đầu form, phía
  // trên field "Loại tài sản".
  private sourceOption(source: PositionSource): Locator {
    return this.page.getByRole("button", {
      name: SOURCE_LABEL[source],
      exact: true,
    });
  }

  async selectSource(source: PositionSource) {
    await this.sourceOption(source).click();
  }

  // Card "Phí giao dịch" (AutoFilledAmountCard) — CHỈ hiện ở nhánh
  // NEW_PURCHASE (issue #142, tự tính TRANSACTION_FEE_BUY_<LOẠI> theo ngày
  // mua). Nhánh EXISTING không có field này.
  get feeInput(): Locator {
    return this.page.getByLabel("Phí giao dịch");
  }

  // DuplicateHoldingAlert (issue #142) — thay Alert lỗi thường khi
  // createHolding() từ chối vì trùng mã ở nhánh NEW_PURCHASE.
  duplicateAlertHeading(symbol: string): Locator {
    return this.page.getByText(`Bạn đã có vị thế ${symbol} trong danh mục`, {
      exact: true,
    });
  }

  // Dòng "Đang giữ {SL} {đơn vị} · giá vốn {avgCost} ₫" — 1 text node, spec tự
  // `toContainText` số cần khớp thay vì tách locator riêng cho từng số.
  get duplicateAlertDetail(): Locator {
    return this.page.getByText(/^Đang giữ /);
  }

  // Link "Ghi giao dịch mua thêm {symbol} →" trong DuplicateHoldingAlert, trỏ
  // ROUTES.newTransaction(holdingId CŨ) — bấm để xác nhận route wiring thật,
  // không tự suy ra URL rồi goto() thẳng (rule mục 4).
  async goToExistingTransactionFromDuplicate(symbol: string) {
    await this.page
      .getByRole("link", {
        name: new RegExp(`^Ghi giao dịch mua thêm ${symbol}`),
      })
      .click();
    await this.page.waitForURL(/\/holdings\/[a-z0-9]+\/transactions\/new$/);
  }

  // Alert lỗi chung (state.error, vd validate Zod thất bại) — KHÁC
  // DuplicateHoldingAlert (chỉ render khi result.holdingId có giá trị).
  // "Dữ liệu không hợp lệ" là message cố định của parseAuthenticated()
  // (lib/server-action.ts) khi schema.safeParse() thất bại — dùng cho ca
  // "ngày tương lai ở nhánh NEW_PURCHASE" (newHoldingSchema.refine).
  get validationErrorAlert(): Locator {
    return this.page.getByText("Dữ liệu không hợp lệ", { exact: true });
  }

  private async fillFields({
    symbol,
    quantity,
    pricePerUnit,
    assetType,
    date,
  }: CreateHoldingInput) {
    if (assetType) {
      await this.assetTypeTile(assetType).click();
    }
    await this.symbolInput.fill(symbol);
    await this.quantityInput.fill(String(quantity));
    await this.priceInput.fill(String(pricePerUnit));
    if (date) {
      // Bước CUỐI trước submit (GOTCHAS #2) — ca dùng fillDatePicker ở đây
      // (validate ngày tương lai / dựng data) không cần preview thuế/phí phản
      // ứng theo ngày, nên ghi thẳng DOM là an toàn.
      await fillDatePicker(this.page, "date", date);
    }
  }

  // Điều hướng đích chắc chắn (trang chi tiết vị thế vừa tạo) -> trả về
  // HoldingDetailPage để spec nối chuỗi (rule mục 4).
  async create(input: CreateHoldingInput): Promise<HoldingDetailPage> {
    await this.fillFields(input);
    await this.submitButton.click();
    await this.page.waitForURL(NEW_HOLDING_REDIRECT);
    return new HoldingDetailPage(this.page, stripQuery(this.page.url()));
  }

  // Cùng cơ chế fill như create(), nhưng KHÔNG chờ redirect — dùng khi spec
  // kỳ vọng submit THẤT BẠI (trùng mã ở nhánh NEW_PURCHASE, ngày tương lai).
  // Form xử lý lỗi bằng useActionState tại chỗ (không router.push), nên
  // KHÔNG có điều hướng nào để chờ; spec tự expect UI lỗi bằng
  // duplicateAlertHeading()/validationErrorAlert() sau khi gọi hàm này.
  async submitExpectingFailure(input: CreateHoldingInput) {
    await this.fillFields(input);
    await this.submitButton.click();
  }
}
