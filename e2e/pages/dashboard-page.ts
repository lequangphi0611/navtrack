import type { Locator, Page } from "@playwright/test";

import { AllocationPage } from "./allocation-page";
import { NavChartPage } from "./nav-chart-page";
import { TransactionHoldingPicker } from "./transaction-holding-picker";

// "/" — Dashboard tổng quan (mockup 2a/2f).
export class DashboardPage {
  readonly url = "/";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get cutoffLink(): Locator {
    return this.page.getByRole("link", { name: /Mốc chốt/ });
  }

  // "Giá trị thị trường (NAV)" chỉ là label — số NAV thật nằm 2 cấp cha lên,
  // sibling của row label + pill "Lịch sử" (xem DashboardScreen.tsx). Trả về
  // khối chứa cả 2 để spec .toContainText số tiền.
  get navValueBlock(): Locator {
    return this.page
      .getByText("Giá trị thị trường (NAV)")
      .locator("..")
      .locator("..");
  }

  get xirrCard(): Locator {
    return this.page
      .getByText("XIRR (sau thuế)", { exact: true })
      .locator("..");
  }

  get pnlCard(): Locator {
    return this.page
      .getByText("Lãi/lỗ (thực nhận)", { exact: true })
      .locator("..")
      .locator("..");
  }

  get noXirrState(): Locator {
    return this.page.getByText("Chưa tính được");
  }

  get autoPriceFreshnessNote(): Locator {
    return this.page.getByText(/Giá tự động cập nhật EOD/);
  }

  get manualPriceNote(): Locator {
    return this.page.getByText(/dùng giá nhập tay/);
  }

  // "<Loại tài sản> · chưa có giá nhập tay" (Container ghép sẵn theo loại tài
  // sản, xem MissingPriceList.tsx) — danh sách thiếu giá không hiện mã, chỉ
  // tên + loại, nên nhận nguyên reasonLabel thay vì tách theo symbol.
  missingPriceNote(reasonLabel: string): Locator {
    return this.page.getByText(reasonLabel);
  }

  // Khối chênh lệch NAV so với vốn (bug #27: màu/mũi tên phải khớp lãi/lỗ).
  private get navDeltaRow(): Locator {
    return this.page
      .getByText("so với vốn đã bỏ vào", { exact: true })
      .locator("..");
  }

  get navDeltaAmount(): Locator {
    return this.navDeltaRow.locator("span").first();
  }

  get navDeltaIcon(): Locator {
    return this.navDeltaRow.locator("svg");
  }

  // SnapshotTodayCard — CTA "Chốt số liệu hôm nay" ngay trên Dashboard (khác
  // SnapshotFreezeSheet ở /snapshots, cùng gọi chung 1 Server Action).
  get snapshotTodayButton(): Locator {
    return this.page.getByRole("button", { name: "Chốt ngay" });
  }

  get snapshotTodayBadge(): Locator {
    return this.page.getByText(/Đã chốt lúc \d{2}:\d{2}/);
  }

  // CostDragSheet — breakdown "Chi phí ăn mòn" (thuế bán/phí/thuế cổ tức +
  // % đóng góp mỗi nguồn), mở từ dòng "Chi phí ăn mòn" trên PnlCostDragCard.
  get costDragTrigger(): Locator {
    return this.page.getByText("Chi phí ăn mòn", { exact: true });
  }

  async openCostDragSheet(): Promise<Locator> {
    await this.costDragTrigger.click();
    return this.page.getByRole("dialog");
  }

  // MoneyValueToggleButton (mục 8/11 phase-6.md) — aria-label đổi theo trạng
  // thái hiện tại: "Ẩn số tiền" khi đang HIỆN (bấm để ẩn), "Hiện số tiền" khi
  // đang ẨN (bấm để hiện lại). Gộp cả 2 vào 1 locator theo NGHĨA "nút mắt",
  // action bên dưới tự bấm bất kể nhãn nào đang hiện.
  get hideAmountsToggle(): Locator {
    return this.page.getByRole("button", { name: /^(Ẩn|Hiện) số tiền$/ });
  }

  async toggleHideAmounts() {
    await this.hideAmountsToggle.click();
  }

  // "•••••• " thay số tiền khi chế độ ẩn bật (formatMoney({hidden: true}),
  // lib/format.ts) — có thể khớp nhiều phần tử cùng lúc trên Dashboard, spec
  // tự scope theo card cha khi cần phân biệt.
  get maskedAmounts(): Locator {
    return this.page.getByText("••••••");
  }

  get navTrendChartHeading(): Locator {
    return this.page.getByText("Giá trị tài sản", { exact: true });
  }

  get navTrendEmptyState(): Locator {
    return this.page.getByText("Chưa vẽ được đường NAV");
  }

  // Chỉ render ở nhánh "đủ điểm" (points.length >= 2) của NavTrendChart —
  // bằng chứng gián tiếp đường NAV đã vẽ khi không thể assert trực tiếp SVG.
  get navTrendPointerHint(): Locator {
    return this.page.getByText("Chạm giữ vào đường để xem NAV tại từng ngày.");
  }

  // Header "Giá trị tài sản" của NavTrendChart — <Link> tới /nav-chart (issue
  // #139/#141) khi navTrendHref có giá trị (LUÔN có trên route "/" thật, xem
  // PortfolioOverviewSection.tsx). ChevronRight cạnh chữ không có text riêng,
  // không ảnh hưởng accessible name.
  private get navTrendLink(): Locator {
    return this.page.getByRole("link", {
      name: "Giá trị tài sản",
      exact: true,
    });
  }

  async goToNavChart(): Promise<NavChartPage> {
    const navChartPage = new NavChartPage(this.page);
    await this.navTrendLink.click();
    await this.page.waitForURL(navChartPage.url);
    return navChartPage;
  }

  // Điểm vào /allocation (mục 10 phase-6.md) — bấm AllocationBar (donut rút
  // gọn) trên Dashboard, không goto() thẳng (rule mục 4).
  private get allocationLink(): Locator {
    return this.page.getByRole("link", {
      name: "Xem phân bổ tài sản chi tiết",
    });
  }

  async goToAllocation(): Promise<AllocationPage> {
    const allocationPage = new AllocationPage(this.page);
    await this.allocationLink.click();
    await this.page.waitForURL(allocationPage.url);
    return allocationPage;
  }

  private get quickMenuToggle(): Locator {
    return this.page.getByRole("button", { name: "Mở menu nhanh" });
  }

  private get tradeMenuItem(): Locator {
    return this.page.getByRole("button", { name: "Mua / Bán", exact: true });
  }

  // Mở FAB rồi bấm "Mua / Bán" -> mở TransactionHoldingPicker (Sheet, issue
  // #54). Gộp 2 bước bấm thành 1 action vì luôn đi cùng nhau trong mọi spec.
  async openTradePicker(): Promise<TransactionHoldingPicker> {
    await this.quickMenuToggle.click();
    await this.tradeMenuItem.click();
    return new TransactionHoldingPicker(this.page);
  }
}
