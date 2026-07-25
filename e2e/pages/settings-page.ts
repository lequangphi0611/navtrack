import { expect, type Locator, type Page } from "@playwright/test";

// Màn Cài đặt (/settings) — phần "Mốc chốt định giá" (mockup 2e). Chọn mốc
// chốt là hard navigation qua /api/cutoff (xem
// src/app/(dashboard)/settings/CutoffHardNavGuard.tsx) redirect về lại chính
// /settings. Component CutoffPicker chưa có aria-current, chỉ phân biệt mốc
// đang chọn bằng class Tailwind — expectSelected/expectNotSelected gói lại
// đúng 1 chỗ để spec không tự bám class (xem GOTCHAS #9, #10).
export class SettingsPage {
  readonly url = "/settings";

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(this.url);
  }

  get cutoffSectionHeading(): Locator {
    return this.page.getByText("Mốc chốt định giá", { exact: true });
  }

  cutoffOption(label: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(label) });
  }

  async selectCutoff(label: string) {
    await this.cutoffOption(label).click();
    await this.page.waitForURL(this.url);
  }

  async expectSelected(label: string) {
    await expect(this.cutoffOption(label)).toHaveClass(/border-primary\/40/);
  }

  async expectNotSelected(label: string) {
    await expect(this.cutoffOption(label)).not.toHaveClass(
      /border-primary\/40/,
    );
  }
}
