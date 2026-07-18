import type { Page } from "@playwright/test";

// components/ui/date-picker.tsx render `<input type="hidden">` giữ giá trị
// thật (không có onChange) + trigger button hiển thị chữ — thay `<input
// type="date">` native (bug Safari iOS, PR #74/#75). Playwright CẤM `.fill()`
// trên input type="hidden" ("Input of type \"hidden\" cannot be filled"), nên
// phải set thẳng qua DOM. An toàn vì form submit đọc value trực tiếp từ DOM
// tại thời điểm submit (không qua React state) — miễn gọi hàm này làm bước
// CUỐI trước khi bấm nút submit (field khác đổi sau đó có thể trigger
// re-render, khiến React ghi đè DOM value về lại state cũ).
export async function fillDatePicker(
  page: Page,
  name: string,
  isoDate: string,
) {
  await page.locator(`input[name="${name}"]`).evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, isoDate);
}
