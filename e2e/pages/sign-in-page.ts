import type { Locator, Page } from "@playwright/test";

// Chưa đăng nhập gõ "/" bị DashboardLayout redirect sang /sign-in (xem
// src/app/(dashboard)/layout.tsx). Giữ url = "/" vì đó đúng là điểm vào của
// smoke test (xác nhận app boot + redirect hoạt động), không phải tự thân
// truy cập route /sign-in.
export class SignInPage {
  readonly url = "/";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Navtrack" });
  }
}
