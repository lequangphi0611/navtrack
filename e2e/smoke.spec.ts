import { expect, test } from "@playwright/test";

test("trang chủ tải được và hiển thị tên app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Navtrack" })).toBeVisible();
});
