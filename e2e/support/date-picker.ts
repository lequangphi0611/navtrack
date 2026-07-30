import type { Page } from "@playwright/test";

import { localIsoDate } from "./dates";

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

// Chọn ngày qua chính UI thật (mở popover, chọn tháng/năm qua dropdown, bấm
// đúng ô ngày) — KHÁC fillDatePicker ở trên (ghi thẳng DOM, bỏ qua
// onChange/React state). BẮT BUỘC dùng hàm này (không phải fillDatePicker) ở
// bất kỳ đâu UI form cha phản ứng THEO state `date` (vd TransactionForm tính
// lại thuế/phí theo ngày mỗi render, hoặc chỉ hiện SellRecomputeCompareCard
// khi state date thực sự đổi) — fillDatePicker chỉ ghi đúng giá trị DOM tại
// thời điểm submit, không kích hoạt bất kỳ re-render nào trước đó nên các
// nhánh UI phụ thuộc `date` state sẽ không thấy giá trị mới.
//
// components/ui/date-picker.tsx dùng `captionLayout="dropdown"` + `hideNavigation`
// (bỏ nút next/prev — nhảy nhiều năm phải bấm hàng chục lần rất mệt) thay vì
// điều hướng tháng-kế-tiếp như trước — chọn thẳng THÁNG và NĂM qua 2 `<select>`
// (`aria-label="Choose the Month"`/`"Choose the Year"`, mặc định của
// react-day-picker vì component chưa set `locale`), không cần tính số lần bấm
// nữa nên cũng không cần đọc giá trị đang hiển thị trên trigger trước đó.
//
// Ngày cụ thể được chọn qua locator `[data-day]` (gắn theo field LOCAL của
// Date, xem CalendarDay.js::isoDate + localIsoDate() ở ./dates.ts) — không
// phụ thuộc ngày-trong-tháng nào bị coi là "outside" vì mỗi ô mang đúng 1
// ngày lịch duy nhất trong toàn bộ DOM (chỉ 1 tháng hiển thị tại một thời điểm).
export async function selectDateOnCalendar(page: Page, targetValue: Date) {
  const trigger = page.getByRole("button", { name: /^\d{2}\/\d{2}\/\d{4}$/ });
  await trigger.click();

  await page
    .getByRole("combobox", { name: "Choose the Month" })
    .selectOption(String(targetValue.getMonth()));
  await page
    .getByRole("combobox", { name: "Choose the Year" })
    .selectOption(String(targetValue.getFullYear()));

  const iso = localIsoDate(targetValue);
  await page.locator(`[data-day="${iso}"] button`).click();
}
