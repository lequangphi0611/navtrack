# E2E — Page Object Model (Playwright)

Quy ước viết end-to-end cho Navtrack theo **Page Object Model (POM)**. Đọc file này
**trước khi viết/sửa bất kỳ spec nào** trong `e2e/`. Ranh giới với các loại test khác
(unit, integration Python) ở [`testing.md`](./testing.md); cách chạy + bẫy đã gặp ở
[`../../e2e/CLAUDE.md`](../../e2e/CLAUDE.md) và [`../../e2e/GOTCHAS.md`](../../e2e/GOTCHAS.md).

> **Trạng thái áp dụng:** bộ spec hiện tại (`e2e/*.spec.ts`) viết theo lối **thủ tục**
> (gọi `page.getByRole/locator` trực tiếp trong spec) — có trước quy ước này. Refactor
> dần sang POM được theo dõi ở issue riêng; **spec MỚI viết theo file này**, spec cũ đụng
> tới đâu POM hoá tới đó (không refactor ồ ạt làm vỡ test đang xanh).

---

## 1. Vì sao POM (vấn đề đang có)

Đọc `e2e/holdings.spec.ts` hiện tại thấy rõ 3 chi phí của lối thủ tục:

1. **Trùng lặp selector.** `getByPlaceholder("VD: FPT")`, `input[name="quantity"]`, nút
   `"Xong"`, pattern redirect `?cashflowId=` xuất hiện lại ở nhiều spec. UI đổi 1 nhãn →
   phải sửa hàng chục chỗ.
2. **Selector giòn.** Có chỗ bám class Tailwind để tìm dòng giao dịch:
   `page.locator("div.rounded-2xl.border-border").filter({ hasText: "80.000" })`. Đổi style
   → vỡ test dù hành vi không đổi.
3. **Ý định người dùng bị chôn dưới cơ khí Playwright.** Spec lẫn "test kỳ vọng điều gì"
   (mua thêm → giá vốn bình quân = 110k) với "bấm cái gì ở đâu" (fill input, click button,
   waitForURL regex).

POM tách 2 tầng đó: **page object** giữ *cách thao tác một màn hình* (selector + action);
**spec** chỉ mô tả *người dùng làm gì, kỳ vọng gì*. Đổi UI → sửa 1 page object. Đọc spec →
hiểu nghiệp vụ mà không cần biết DOM.

**Lợi ích token/ngữ cảnh (mục tiêu riêng của repo):** người viết spec chỉ cần đọc API của
page object, **không phải mở internals component trong `src/`** để đoán selector. Tri thức
selector nằm gọn một nơi.

---

## 2. Ba tầng — page object vs fixture vs spec

Phân loại đúng tầng là quyết định quan trọng nhất. Nhầm tầng → POM phình thành "god object".

| Tầng | Là gì | Ở đâu | Ví dụ |
|---|---|---|---|
| **Page object** | Một **màn hình / route**: URL của nó + locator + action trên màn đó | `e2e/pages/*.ts` | `HoldingsPage`, `HoldingDetailPage`, `NewHoldingPage`, `DashboardPage` |
| **Component object** | Một cụm UI **dùng lại xuyên nhiều màn** | `e2e/pages/` hoặc `e2e/support/` | date-picker, dòng giao dịch, toggle ẩn số tiền |
| **Fixture / support** | Cross-cutting **không gắn màn nào**: dựng session, seed DB, ngày tương đối | `e2e/support/*.ts` | `createTestSession`, `seedPriceQuote`, `daysAgo` |

Quy tắc phân loại nhanh:

- Nó **có URL riêng / là một trang** không? → page object.
- Nó **xuất hiện ở nhiều trang** (widget) không? → component object.
- Nó **không phải UI** (DB, cookie, thời gian) không? → fixture ở `support/`.

`e2e/support/` **đã có sẵn** đúng tầng fixture: `test-session.ts` (session + cleanup),
`dates.ts` (ngày tương đối), `date-picker.ts` (component object cho DatePicker), `urls.ts`
(helper redirect). **Không** trộn những thứ này vào page object.

---

## 3. Cấu trúc thư mục mục tiêu

```
e2e/
  CLAUDE.md              # instruction bắt buộc đọc khi làm e2e (trỏ về file này + GOTCHAS)
  GOTCHAS.md             # nhật ký bẫy đã gặp: triệu chứng → nguyên nhân → cách fix
  *.spec.ts              # spec: chỉ ý định + kỳ vọng, gọi page object
  pages/                 # 1 file / màn hình (hoặc component object dùng lại)
    holdings-page.ts     #   class HoldingsPage
    holding-detail-page.ts
    new-holding-page.ts
    transaction-form.ts  #   form mua/bán (component object dùng ở nhiều route)
    dashboard-page.ts
  support/               # fixture cross-cutting (ĐÃ CÓ — không đổi tầng)
    test-session.ts
    dates.ts
    date-picker.ts
    urls.ts
  fixtures.ts            # (tuỳ chọn) test.extend gộp page object + session cho spec ngắn
```

**Đặt tên:** file **kebab-case** (nhất quán với `support/*.ts` đang có + rule "file
non-component kebab-case" ở [`typescript-style.md`](./typescript-style.md)); **class**
export **PascalCase** khớp màn hình + hậu tố `Page` (`HoldingsPage`) hoặc tên component
(`TransactionForm`). Một file = một page/component object.

---

## 4. Khung một page object

Page object là **class mỏng**, nhận `page` ở constructor. Bốn nhóm thành viên, theo thứ tự:

```ts
// e2e/pages/holdings-page.ts
import { expect, type Locator, type Page } from "@playwright/test";

export class HoldingsPage {
  // (1) URL — page object SỞ HỮU đường dẫn màn hình của mình.
  readonly url = "/holdings";

  constructor(private readonly page: Page) {}

  // (2) Điều hướng.
  async goto() {
    await this.page.goto(this.url);
  }

  // (3) Locator — role/label-first, đặt tên theo NGHĨA (không lộ selector ra spec).
  //     Trả Locator để spec tự expect; đây là API chính của page object.
  get emptyState(): Locator {
    return this.page.getByText("Chưa có vị thế nào");
  }

  holdingLink(symbol: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(symbol) });
  }

  get closedTab(): Locator {
    return this.page.getByRole("link", { name: "Đã đóng" });
  }

  // (4) Action — thao tác cấp cao, tên theo ý định người dùng.
  async openClosed() {
    await this.closedTab.click();
    await this.page.waitForURL("/holdings/closed");
  }
}
```

Nguyên tắc:

- **Constructor chỉ nhận `page`.** Không tự `goto` trong constructor (spec quyết định khi
  nào điều hướng). Tạo object rẻ, `goto()` là bước riêng.
- **Locator đặt tên theo nghĩa**, không theo cơ chế: `holdingLink("FPT")`, không phải
  `getFptRoleLink`. Selector giấu bên trong.
- **Action trả về gì:** nếu action điều hướng sang màn khác, trả về page object đích để
  spec nối chuỗi — *chỉ khi* điều hướng là chắc chắn 1 đích. Nếu không, trả `void`.

### Locator getter vs method

- Không tham số → **getter** (`get emptyState()`).
- Có tham số (mã, số tiền, ngày) → **method** (`holdingLink(symbol)`).

---

## 5. Chiến lược selector (quan trọng — repo có 0 `data-testid`)

Toàn bộ `src/` **không dùng `data-testid`**; test hiện tại dựa vào selector khả truy cập
(role/label/text tiếng Việt) — đúng khuyến nghị Playwright. Giữ hướng đó. Thứ tự ưu tiên:

1. **`getByRole(role, { name })`** — bền nhất, gắn với accessibility. Ưu tiên tuyệt đối cho
   button, link, heading, checkbox.
2. **`getByLabel` / `getByPlaceholder`** — cho input có nhãn/placeholder ổn định.
3. **`input[name="..."]`** — **được phép** cho field form: thuộc tính `name` là *hợp đồng
   ổn định* (Server Action đọc payload theo `name`, đổi nó là breaking change có chủ đích).
   Gói trong page object, không rải ra spec.
4. **`getByText`** — cho nội dung hiển thị / trạng thái (empty state, thông báo lỗi).

**CẤM:**

- ❌ Bám **class CSS/Tailwind** (`div.rounded-2xl.border-border`): giòn, đổi style là vỡ.
- ❌ Selector theo **vị trí cứng** (`.nth(3)`) khi thứ tự có thể đổi.
- ❌ `page.waitForTimeout(ms)` cố định — dùng auto-wait của Playwright (`expect(...).toBeVisible()`,
  `waitForURL`).

**Khi selector khả truy cập KHÔNG đủ** (điển hình: chọn đúng 1 dòng trong danh sách giao
dịch, hiện đang bám class Tailwind):

1. Ưu tiên `getByRole("listitem")` / `getByRole("row")` rồi `.filter({ hasText })` theo
   **nội dung ổn định** (số tiền, ngày) — không theo class.
2. Nếu vẫn mơ hồ, **đề xuất thêm `data-testid` vào component nguồn** (`src/`) — đây là
   **ngoại lệ có kiểm soát**, không phải mặc định:
   - Cần đụng `src/` → nêu trong PR/issue, không lén thêm.
   - Tên kebab-case, ổn định, mô tả nghĩa: `data-testid="transaction-row"`, `data-testid="nav-value"`.
   - Chỉ thêm khi selector khả truy cập thật sự không phân biệt được — testid không thay
     thế role selector cho phần lớn trường hợp.

---

## 6. URL & điều hướng có redirect

Page object **sở hữu URL màn hình của nó** (`readonly url`). Không hardcode chuỗi route
lặp lại trong spec.

Navtrack có một quirk điều hướng phải bọc trong page object (chi tiết & lý do ở
[`GOTCHAS.md`](../../e2e/GOTCHAS.md#redirect-cashflowid)): sau `createHolding` /
`addTransaction` / `updateTransaction`, app redirect về trang chi tiết vị thế **có gắn
`?cashflowId=<id>`** (cờ vừa-giao-dịch cho banner). Đã có helper ở `support/urls.ts`:

- `afterTransactionUrl(baseUrl)` → RegExp chờ redirect có `?cashflowId=`.
- `stripQuery(url)` → base URL "sạch" để so khớp/điều hướng tiếp.

Page object bọc lại thành action rõ nghĩa, spec không thấy regex:

```ts
// trong TransactionForm
async submitBuy(): Promise<string> {
  await this.page.getByRole("button", { name: "Ghi nhận giao dịch mua" }).click();
  await this.page.waitForURL(afterTransactionUrl(this.holdingUrl));
  return stripQuery(this.page.url()); // base URL sạch cho bước sau
}
```

Lưu ý ngoại lệ (đã ghi ở `support/urls.ts`): `saveNavOverride` redirect **không** gắn
`cashflowId`, `deleteTransaction` **không** điều hướng — dùng `waitForURL(exact)` cho 2 ca
này, không nhét vào cùng helper.

---

## 7. Assertion đặt ở đâu

Quy ước Navtrack — **locator là API chính, expect nằm ở spec**:

- Page object **expose locator**; spec gọi `expect(page.emptyState).toBeVisible()`. Giữ
  *ý định kỳ vọng* hiển thị ngay trong spec — đọc spec biết test đòi hỏi gì.
- **Chỉ** thêm assertion helper trong page object khi cùng một kỳ vọng lặp **≥ 3 lần** và
  gói lại làm spec dễ đọc hơn hẳn (vd `expectQuantity(200)` bọc locator "X cổ phần" +
  `toContainText`). Đặt tên `expectXxx`, mỏng, không nhồi nhiều assertion không liên quan.
- **Không** biến page object thành nơi chứa mọi expect (giấu mất ý định test, phình object).

```ts
// ✅ Good — kỳ vọng nằm ở spec, cơ chế nằm ở page object
test("mua thêm → giá vốn bình quân recompute 110k", async ({ page }) => {
  const form = new TransactionForm(page, holdingUrl);
  await form.addBuy({ quantity: 100, pricePerUnit: 120_000 });
  await expect(detail.quantityText).toHaveText("200 cổ phần");
  await expect(detail.avgCost).toContainText("110k");
});
```

---

## 8. Spec sau khi POM hoá trông thế nào

So sánh trực tiếp với `holdings.spec.ts` hiện tại (mục 1):

```ts
// ✅ Mục tiêu — spec chỉ có ý định + kỳ vọng
import { expect, test } from "@playwright/test";
import { withUser } from "./fixtures"; // gộp session + cleanup (tuỳ chọn)
import { NewHoldingPage } from "./pages/new-holding-page";
import { HoldingDetailPage } from "./pages/holding-detail-page";
import { TransactionForm } from "./pages/transaction-form";

test("nhập vị thế, mua thêm, tính giá vốn bình quân", async ({ page }) => {
  await withUser(page, async () => {
    const holdingUrl = await new NewHoldingPage(page).create({
      symbol: "FPT", quantity: 100, pricePerUnit: 100_000,
    });
    const detail = new HoldingDetailPage(page, holdingUrl);
    await expect(detail.heading("FPT")).toBeVisible();
    await expect(detail.quantityText).toHaveText("100 cổ phần");

    await new TransactionForm(page, holdingUrl).addBuy({ quantity: 100, pricePerUnit: 120_000 });
    await expect(detail.quantityText).toHaveText("200 cổ phần");
    await expect(detail.avgCost).toContainText("110k");
  });
});
```

Ý định nghiệp vụ đọc thẳng; DOM/selector/redirect biến mất khỏi spec.

---

## 9. Best practices (gom lại — tra nhanh)

Các nguyên tắc rải trong file trên, cộng vài điều chưa nói ở đâu. Đọc như checklist tư duy
trước khi viết:

**Về page object**
1. **Một page object = một màn hình / một widget dùng lại.** Không "god object" ôm nhiều màn
   (mục 2).
2. **Chỉ expose action cấp cao + locator có nghĩa; giấu DOM/selector.** Spec đọc như kịch bản
   người dùng, không thấy CSS (mục 4).
3. **Không nhồi logic điều khiển của test vào page object.** Page object = *thao tác* +
   *locator*. `if/else`/`for` rẽ nhánh **theo trạng thái nghiệp vụ** (vd "nếu đang lãi thì...")
   là mùi — quyết định đó thuộc **spec**. Page object chỉ được rẽ nhánh cho **cơ chế UI**
   thuần (vd DatePicker bấm next/prev bao nhiêu lần — xem `support/date-picker.ts`).
4. **Constructor nhẹ, không `goto`.** Tạo object không được có side-effect điều hướng (mục 4).
5. **Đừng trừu tượng hoá non.** Chỉ tạo page object / helper khi thao tác **dùng lại** hoặc
   selector **lặp**. Thứ dùng đúng một lần trong một spec cứ để thẳng — POM để bớt trùng lặp,
   không phải để có class cho đẹp.

**Về selector & chờ**
6. **Locator khả truy cập trước** (role → label/placeholder → `name` form → text); **cấm class
   CSS/nth cứng** (mục 5).
7. **Auto-wait, không `waitForTimeout`.** Chờ bằng `expect(...).toBeVisible()` / `waitForURL`
   (mục 5, 10).

**Về assertion**
8. **Kỳ vọng nằm ở spec**, locator là API; helper `expectXxx` chỉ khi lặp ≥3 lần (mục 7).
9. **e2e phủ luồng nối dây, không test lại logic thuần** — XIRR/cost basis/thuế thuộc unit
   (`testing.md`).

**Về tính độc lập của test (BẮT BUỘC — `playwright.config.ts` bật `fullyParallel: true`)**
10. **Mỗi test tự dựng data của nó, tự dọn** — không dựa vào data test khác để lại, không
    dựa vào **thứ tự chạy**. Mẫu chuẩn đã có: `createTestSession()` (user + session random)
    ở đầu, dọn trong `finally` — `closeContext()` **trước** rồi `cleanupTestUser()` (thứ tự
    này quan trọng, xem [`GOTCHAS.md`](../../e2e/GOTCHAS.md) #5).
11. **Không chia sẻ state đổi được giữa các test.** Với data **không** cascade theo User
    (`PriceQuote`, `Setting` toàn cục), dùng **mã/khoá random mỗi lần chạy** và tự xoá — nếu
    không, hai worker song song đạp lên nhau (GOTCHAS #6, #8).
12. **Không hardcode ngày/năm tuyệt đối** — ngày tương đối qua `daysAgo()` (`support/dates.ts`)
    để test không vỡ khi chạy ở thời điểm khác; khớp ô lịch dùng `localIsoDate` (GOTCHAS #3).

---

## 10. Anti-pattern (đừng làm)

- ❌ **Selector inline trùng lặp** giữa các spec — lý do POM tồn tại; đưa vào page object.
- ❌ **Bám class Tailwind / cấu trúc DOM** — dùng role/text/name; cần thì đề xuất testid.
- ❌ **God object** ôm nhiều màn — 1 page object = 1 màn hình.
- ❌ **Assertion nhồi hết vào page object** — kỳ vọng ở spec (mục 7).
- ❌ **`waitForTimeout` cứng** — auto-wait qua `expect`/`waitForURL`.
- ❌ **Đưa logic thuần vào e2e** — XIRR/cost basis/thuế test bằng **unit** (`testing.md`);
  e2e chỉ verify **luồng nối dây** (Server Action → query → render) mà unit không bắt được.
- ❌ **Dùng lại `symbol` cố định** cho dữ liệu dùng chung không cascade (`PriceQuote`) — mã
  random mỗi lần chạy + tự dọn (xem [`GOTCHAS.md`](../../e2e/GOTCHAS.md)).

---

## 11. Checklist trước khi commit một spec/page object

- [ ] Spec **không** chứa selector thô (`locator("div...")`, `getByRole` rải rác) — đã đẩy
      vào page object.
- [ ] Page object mới đặt đúng tầng (mục 2): màn → `pages/`, cross-cutting → `support/`.
- [ ] Selector theo thứ tự ưu tiên mục 5; **không** bám class CSS.
- [ ] Kỳ vọng (`expect`) nằm ở spec, trừ helper lặp ≥3 lần (mục 7).
- [ ] Điều hướng có redirect dùng helper `support/urls.ts`, không so URL tuyệt đối sai chỗ.
- [ ] Bẫy mới phát hiện đã ghi vào [`GOTCHAS.md`](../../e2e/GOTCHAS.md).
- [ ] Chạy được: `pnpm e2e <file>` (Claude Local) — Claude Cloud **skip**, báo rõ chưa
      verify được e2e (Docker), không báo pass giả (xem [`TOOLS.md`](../../TOOLS.md)).
- [ ] `pnpm typecheck` xanh (page object là TS, chịu `noUncheckedIndexedAccess`).
