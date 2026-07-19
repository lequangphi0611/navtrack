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

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

// Chọn ngày qua chính UI thật (mở popover, bấm chuyển tháng, bấm đúng ô ngày)
// — KHÁC fillDatePicker ở trên (ghi thẳng DOM, bỏ qua onChange/React state).
// BẮT BUỘC dùng hàm này (không phải fillDatePicker) ở bất kỳ đâu UI form cha
// phản ứng THEO state `date` (vd TransactionForm tính lại thuế/phí theo ngày
// mỗi render, hoặc chỉ hiện SellRecomputeCompareCard khi state date thực sự
// đổi) — fillDatePicker chỉ ghi đúng giá trị DOM tại thời điểm submit, không
// kích hoạt bất kỳ re-render nào trước đó nên các nhánh UI phụ thuộc `date`
// state sẽ không thấy giá trị mới.
//
// `targetValue` chỉ cần đúng NĂM+THÁNG để tính số lần bấm next/prev — tự ĐỌC
// tháng đang hiển thị TỪ chính chữ trên trigger button (dd/MM/yyyy) thay vì
// nhận currentValue từ caller: tránh caller phải tự đoán giá trị mặc định
// form cha đang hiển thị (vd TransactionForm tạo mới dùng `new
// Date().toISOString()` — có thể lệch 1 ngày lịch so với "bây giờ" ở
// timezone dương gần nửa đêm UTC, xem localIsoDate() ở ./dates.ts) — đọc
// thẳng UI luôn khớp 100% với những gì DayPicker đang thật sự mở ra.
//
// Ngày cụ thể được chọn qua locator `[data-day]` (gắn theo field LOCAL của
// Date, xem CalendarDay.js::isoDate + localIsoDate() ở ./dates.ts) — không
// phụ thuộc ngày-trong-tháng nào bị coi là "outside" vì mỗi ô mang đúng 1
// ngày lịch duy nhất trong toàn bộ DOM (chỉ 1 tháng hiển thị tại một thời điểm).
export async function selectDateOnCalendar(page: Page, targetValue: Date) {
  const trigger = page.getByRole("button", { name: /^\d{2}\/\d{2}\/\d{4}$/ });
  const displayed = await trigger.innerText();
  // Không dùng array destructuring từ .split("/").map(Number) — dưới
  // noUncheckedIndexedAccess (tsconfig.json), TypeScript suy ra từng phần tử
  // là `number | undefined`, gán vào Date(...) (nhận `number`) sẽ lỗi
  // typecheck. exec() + đọc trực tiếp match[n] tránh được vì Number() nhận
  // `any`, không kén kiểu.
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(displayed);
  if (!match) {
    throw new Error(
      `Không đọc được ngày hiển thị trên DatePicker: "${displayed}"`,
    );
  }
  const currentValue = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
  );

  await trigger.click();

  const diff = monthsBetween(currentValue, targetValue);
  if (diff !== 0) {
    const navButton = page.getByRole("button", {
      name: diff > 0 ? "Go to the Next Month" : "Go to the Previous Month",
    });
    for (let i = 0; i < Math.abs(diff); i++) {
      // dispatchEvent (KHÔNG phải .click()/.click({force:true})) — DayPicker's
      // caption div (classNames.month_caption: "relative ...") đè lên vùng nút
      // next/prev (classNames.nav: "absolute inset-x-0 top-1 ..."), khiến
      // click toạ độ thật (kể cả force: true, vẫn dispatch theo TOẠ ĐỘ màn
      // hình) có thể trúng nhầm caption thay vì nút — đặc biệt ngay sau khi
      // popover vừa mount (animation zoom-in-95 khiến toạ độ cuối cùng của nút
      // chưa ổn định). dispatchEvent bắn thẳng sự kiện "click" vào ĐÚNG element
      // handle, không phụ thuộc toạ độ/animation — né hẳn quirk CSS này (component
      // components/ui/date-picker.tsx không thuộc phạm vi sửa của e2e-verifier).
      await navButton.dispatchEvent("click");
    }
  }

  const iso = localIsoDate(targetValue);
  await page.locator(`[data-day="${iso}"] button`).click();
}
