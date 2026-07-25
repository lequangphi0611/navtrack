import { expect, test } from "@playwright/test";

import { SignInPage } from "../pages/sign-in-page";

test("trang chủ tải được và hiển thị tên app", async ({ page }) => {
  const signInPage = new SignInPage(page);
  await signInPage.goto();
  await expect(signInPage.heading).toBeVisible();
});
