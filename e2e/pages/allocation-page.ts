import type { Locator, Page } from "@playwright/test";

import { AllocationStockPage } from "./allocation-stock-page";
import { HoldingsPage } from "./holdings-page";

// "/allocation" — màn chi tiết phân bổ tài sản, route riêng full-screen (mục
// 10 phase-6.md, mockup 6d). Chỉ tới được qua DashboardPage.goToAllocation()
// (bấm AllocationBar) trong luồng bình thường — goto() ở đây giữ cho ca cần
// vào thẳng (rule mục 4, case 3).
export class AllocationPage {
  readonly url = "/allocation";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get emptyState(): Locator {
    return this.page.getByText("Chưa có vị thế nào có giá để tính phân bổ.");
  }

  // Dòng chú giải theo nhóm AssetType ("Cổ phiếu", "Quỹ"...) — filter theo nhãn
  // nhóm (substring, khớp cả khi có note "· gồm CCQ"), nội dung ổn định (không
  // bám vị trí/class). CHỈ bao dòng nhãn+percent (div "flex items-center
  // gap-2" đầu tiên) — dùng cho assertion % phân bổ như trước.
  legendRow(assetTypeLabel: string): Locator {
    return this.page.getByText(assetTypeLabel).locator("..");
  }

  // Toàn bộ 1 dòng/thẻ nhóm — bao rộng hơn legendRow (thêm dòng NAV ròng +
  // lãi/lỗ theo vốn + ghi chú amber nếu có, issue #130) để scope assertion
  // đúng nhóm khi nhiều nhóm cùng hiện trên màn. Từ span nhãn đi lên 2 cấp:
  // span -> div "flex items-center gap-2" (dòng nhãn/percent) -> container
  // dòng nhóm (Link cho STOCK, div cho nhóm khác) — cùng pattern
  // HoldingDetailPage.navBox (`.locator("../..")`).
  //
  // RegExp (KHÔNG dùng string) — `getByText(string)` không phân biệt
  // hoa/thường: khi nhóm `navIsPartial`, ghi chú amber lặp lại tên nhóm ở
  // dạng THƯỜNG ("... NAV nhóm cổ phiếu chưa đầy đủ...", `.toLowerCase()` ở
  // AllocationScreen.tsx), khớp case-insensitive luôn cả div ghi chú đó ->
  // `.locator("../..")` từ 2 điểm xuất phát khác nhau ra 2 phần tử khác nhau
  // (amber wrapper + Link nhóm) -> strict mode violation (xem GOTCHAS.md #22).
  // RegExp không có flag "i" giữ case-sensitive, chỉ khớp đúng span nhãn viết
  // hoa đầu câu.
  groupCard(assetTypeLabel: string): Locator {
    return this.page.getByText(new RegExp(assetTypeLabel)).locator("../..");
  }

  // Thẻ tổng NAV ròng/tổng lãi-lỗ đầu trang (issue #130) — từ span "Tổng NAV
  // ròng" đi lên 2 cấp (span -> div header "flex items-center justify-between"
  // -> card rounded-2xl chứa cả NAV/pnl amount).
  get totalCard(): Locator {
    return this.page.getByText("Tổng NAV ròng").locator("../..");
  }

  // MoneyValueToggleButton ở header — cùng pattern DashboardPage
  // (hideAmountsToggle), aria-label đổi theo trạng thái hiện tại.
  get hideAmountsToggle(): Locator {
    return this.page.getByRole("button", { name: /^(Ẩn|Hiện) số tiền$/ });
  }

  async toggleHideAmounts() {
    await this.hideAmountsToggle.click();
  }

  // "••••••" thay VND khi chế độ ẩn bật (formatMoney({hidden: true})) — có thể
  // khớp nhiều phần tử cùng lúc (NAV/pnl từng nhóm + thẻ tổng), spec tự scope
  // theo groupCard/totalCard khi cần phân biệt.
  get maskedAmounts(): Locator {
    return this.page.getByText("••••••");
  }

  // Chú thích liên kết khi có Holding đang cảnh báo tập trung (mục 6
  // phase-6.md) — 1 <Link> bọc 2 dòng text riêng biệt trong JSX
  // ("{N} mã đang vượt ngưỡng tập trung" + "Xem bảng vị thế bên dưới."),
  // accessible name của link nối cả hai — match theo dòng đầu là đủ phân biệt.
  get concentrationWarningLink(): Locator {
    return this.page.getByRole("link", {
      name: /mã đang vượt ngưỡng tập trung/,
    });
  }

  async goToHoldingsFromWarning(): Promise<HoldingsPage> {
    const holdingsPage = new HoldingsPage(this.page);
    await this.concentrationWarningLink.click();
    await this.page.waitForURL(holdingsPage.url);
    return holdingsPage;
  }

  // Drill-down "% theo mã trong nhóm cổ phiếu" (issue #131/#132,
  // process/DECISION.md 2026-08-16: route riêng, không accordion) — CHỈ dòng
  // legend "Cổ phiếu" là <Link> thật, các nhóm khác vẫn <div> tĩnh (chưa có
  // view chi tiết theo mã tương ứng).
  get stockGroupLink(): Locator {
    return this.page.getByRole("link", { name: /Cổ phiếu/ });
  }

  async goToStockDetail(): Promise<AllocationStockPage> {
    const stockPage = new AllocationStockPage(this.page);
    await this.stockGroupLink.click();
    await this.page.waitForURL(stockPage.url);
    return stockPage;
  }
}
