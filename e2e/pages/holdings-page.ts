import type { Locator, Page } from "@playwright/test";

import { HoldingDetailPage } from "./holding-detail-page";
import { NewHoldingPage } from "./new-holding-page";

// Màn hình danh sách vị thế (/holdings, /holdings/closed) — hai tab cùng route
// gốc, xem HoldingsSegmentedNav.
export class HoldingsPage {
  readonly url = "/holdings";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get emptyState(): Locator {
    return this.page.getByText("Chưa có vị thế nào");
  }

  get closedTab(): Locator {
    return this.page.getByRole("link", { name: "Đã đóng" });
  }

  holdingLink(symbol: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(symbol) });
  }

  // ConcentrationBadge (mục 6/13 phase-6.md) — pill "X% danh mục" / "Tạm ẩn"
  // nằm bên trong CHÍNH dòng <Link> của holding (HoldingsGroupCard.tsx), không
  // phải phần tử tách rời — scope qua holdingLink() để phân biệt đúng mã khi
  // có nhiều holding cùng hiện badge.
  concentrationBadge(symbol: string): Locator {
    return this.holdingLink(symbol).getByText(/danh mục|Tạm ẩn/);
  }

  // Dòng vị thế ĐÃ ĐÓNG (ClosedHoldingRow, tab "Đã đóng") — KHÁC holdingLink()
  // ở trên: đây là <button> mở ClosedPositionSheet (client state), không phải
  // <Link> điều hướng thẳng.
  closedHoldingButton(symbol: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(symbol) });
  }

  // Link "Sửa / xoá giao dịch đã ghi" trong ClosedPositionSheet (mở sau khi
  // bấm closedHoldingButton) — quay lại /holdings/[id] đầy đủ (lịch sử giao
  // dịch, nút xoá) cho vị thế đã đóng (code review #1, PR #81).
  get closedPositionSheetDetailLink(): Locator {
    return this.page.getByRole("link", { name: /Sửa \/ xoá giao dịch/ });
  }

  // Bấm dòng vị thế đã đóng để mở ClosedPositionSheet, rồi bấm link trong
  // sheet để tới trang chi tiết đầy đủ — cùng tinh thần openHolding() (pin
  // đúng URL đã biết trước, tránh router-cache issue #77).
  async openClosedHolding(
    symbol: string,
    holdingUrl: string,
  ): Promise<HoldingDetailPage> {
    await this.closedHoldingButton(symbol).click();
    await this.closedPositionSheetDetailLink.click();
    await this.page.waitForURL(holdingUrl);
    return new HoldingDetailPage(this.page, holdingUrl);
  }

  // HoldingsGroupCard ghép SL + giá chung 1 dòng ("100 cổ phần · giá 150k")
  // — không exact:true (khác HoldingDetailPage.quantityText, nơi SL đứng
  // riêng 1 dòng).
  quantityNote(text: string): Locator {
    return this.page.getByText(text);
  }

  // CTA "Khai báo vị thế đầu tiên" (rỗng) hoặc FAB "Khai báo vị thế mới" (đã
  // có holding) — cùng đích /holdings/new, gộp 1 locator theo nghĩa chung
  // thay vì rẽ nhánh theo trạng thái rỗng/không rỗng trong page object.
  get newHoldingLink(): Locator {
    return this.page.getByRole("link", { name: /Khai báo vị thế/ });
  }

  async goToNewHolding(): Promise<NewHoldingPage> {
    const newHoldingPage = new NewHoldingPage(this.page);
    await this.newHoldingLink.click();
    await this.page.waitForURL(newHoldingPage.url);
    return newHoldingPage;
  }

  // Nhận `holdingUrl` đã biết trước (từ NewHoldingPage.create() hoặc
  // HoldingDetailPage.url của cùng vị thế) để `waitForURL` pin ĐÚNG URL đó —
  // không dùng regex khớp bất kỳ holding nào. Bug router-cache (issue #77)
  // khiến điều hướng dừng ở URL cũ vẫn khớp regex lỏng, chỉ pin đúng URL mới
  // bắt được sai lệch ngay tại điểm điều hướng (thay vì trôi xuống assertion
  // nghiệp vụ phía sau mới lộ ra, nếu lộ ra).
  async openHolding(
    symbol: string,
    holdingUrl: string,
  ): Promise<HoldingDetailPage> {
    await this.holdingLink(symbol).click();
    await this.page.waitForURL(holdingUrl);
    return new HoldingDetailPage(this.page, holdingUrl);
  }

  async openClosed() {
    await this.closedTab.click();
    await this.page.waitForURL("/holdings/closed");
  }
}
