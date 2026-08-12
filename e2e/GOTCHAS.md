# GOTCHAS — bẫy e2e đã gặp

Nhật ký các bẫy **thật** khi viết/chạy e2e Navtrack, để không dẫm lại. Mỗi mục:
**triệu chứng → nguyên nhân → cách né**. Cách viết e2e chung ở
[`../docs/rules/e2e-page-object.md`](../docs/rules/e2e-page-object.md).

**Cách dùng:** tra bảng triệu chứng bên dưới → nhảy thẳng tới mục cần, **không đọc cả file**.
**Số mục là định danh** — 9 chỗ ngoài file trích dẫn kiểu `GOTCHAS #14`, nên **không đánh số
lại, không đổi thứ tự**; mục hết hiệu lực thì đánh dấu `⛔`, giữ nguyên số.

**Gặp bẫy mới:** thêm mục ở cuối (số kế tiếp) + 1 dòng vào bảng tra, **trong cùng lần commit**,
kèm trỏ file/spec gốc. Nếu bẫy mới làm một mục cũ hết đúng → đánh dấu `⛔` mục cũ, đừng xoá
(người khác có thể đang đọc theo số cũ).

## Tra theo triệu chứng

| Bạn đang gặp | Mục |
|---|---|
| `waitForURL()` không bao giờ khớp sau khi tạo vị thế / ghi giao dịch | [#1](#1-redirect-sau-giao-dịch-gắn-cashflowid--so-url-tuyệt-đối-bị-treo) |
| `Input of type "hidden" cannot be filled` | [#2](#2-datepicker-là-input-typehidden--fill-bị-playwright-cấm) |
| Set ngày xong nhưng form **không tính lại** thuế/phí, hoặc card so sánh không hiện | [#2](#2-datepicker-là-input-typehidden--fill-bị-playwright-cấm) |
| Ngày lưu xuống DB **rỗng** dù đã set qua helper (form trái phiếu) | [#17](#17-bondtermsform-đọc-thẳng-react-state-khi-submit-không-qua-formdata) |
| Ô lịch `[data-day="<iso>"]` không tìm thấy / bấm nhầm ngày | [#3](#3-isodate-utc-lệch-1-ngày-so-với-ô-lịch-ở-timezone-dương) |
| Không chuyển được tháng/năm trên lịch | [#18](#18-datepicker-đổi-sang-captionlayoutdropdown--hidenavigation) |
| Data test (User, PriceQuote) **leak** sang lần chạy sau | [#5](#5-contextclose-trong-finally-nuốt-luôn-bước-cleanup-sau-nó), [#6](#6-pricequote-không-scoped-theo-user--không-cascade-khi-xoá-user) |
| Dashboard hiện "thiếu giá" dù đã seed `PriceQuote` | [#7](#7-seed-pricequote-phải-trước-khi-tạo-holding) |
| `P2002` unique constraint đỏ ngẫu nhiên | [#8](#8-nhiều-worker-seed-cùng-setting--p2002-unique-thoáng-qua), [#14](#14-workers--1--lỗi-serializable--p2002-khi-nhiều-test-cùng-cập-nhật-1-bản-ghi-dùng-chung) |
| `could not serialize access` / write conflict | [#14](#14-workers--1--lỗi-serializable--p2002-khi-nhiều-test-cùng-cập-nhật-1-bản-ghi-dùng-chung) |
| `SETTING_NOT_FOUND: "<KEY>"`, fail ở spec không liên quan feature đang làm | [#15](#15-thiếu-setting-toàn-cục-mới-thêm--lỗi-render-thoáng-qua-ở-nhiều-spec-không-liên-quan) |
| Segmented nav kẹt tab cũ sau khi đổi cutoff | [#9](#9-đổi-cookie-cutoff-cần-hard-navigation--đừng-reload-thủ-công-che-bug) |
| Test vỡ khi đổi style dù hành vi không đổi | [#10](#10-chọn-1-dòng-trong-danh-sách-bằng-class-tailwind--giòn) |
| `.check()` không tick được checkbox | [#11](#11-checkbox-peer-sr-only--check-thường-thất-bại) |
| Bấm nút "Xóa" bị treo, không có gì xảy ra | [#12](#12-dialog-confirm-windowconfirm-chặn-action--phải-bắt-trước-khi-bấm) |
| 404 / timeout thoáng qua ở lần chạy đầu, retry thì qua | [#13](#13-lần-chạy-đầu-flaky-do-turbopack-cold-compile--không-phải-regression) |
| `getByRole("link")` không thấy dòng danh sách đang hiện rõ trên UI | [#16](#16-ui-redesign-đổi-dòng-danh-sách-từ-link-sang-button-mở-sheet) |
| `.e2e-logs/server.log` trống / chỉ còn vài dòng cuối | [#19](#19-log-ra-file-bằng-flags-w-trong-app--nhiều-process-ghi-đè-nhau) |

**Bài học lặp lại nhiều lần** (đọc khi sắp đổi component dùng chung hoặc UI của màn đã có
spec): [#16](#16-ui-redesign-đổi-dòng-danh-sách-từ-link-sang-button-mở-sheet) và
[#18](#18-datepicker-đổi-sang-captionlayoutdropdown--hidenavigation) — đổi cơ chế tương tác
của một component `ui/` dùng chung phải rà **mọi** helper/spec chạm nó, không chỉ spec của
tính năng đang sửa.

---

<a id="redirect-cashflowid"></a>

## 1. Redirect sau giao dịch gắn `?cashflowId=` → so URL tuyệt đối bị treo

- **Triệu chứng:** `waitForURL("/holdings/<id>")` sau khi tạo vị thế / ghi giao dịch không
  bao giờ khớp, test timeout.
- **Nguyên nhân:** `createHolding` / `addTransaction` / `updateTransaction` redirect về
  `/holdings/<id>?cashflowId=<id>` (cờ "vừa giao dịch" cho `TransactionSnapshotBanner` —
  issue #37, `lib/routes.ts::holdingDetailAfterTransaction`). Query string làm URL không
  khớp chuỗi tuyệt đối.
- **Cách né:** dùng `afterTransactionUrl(baseUrl)` (RegExp) để chờ, rồi `stripQuery(url)`
  lấy base URL sạch cho bước sau (cả hai ở `support/urls.ts`). **Ngoại lệ:**
  `saveNavOverride` redirect **không** gắn `cashflowId` (dùng `waitForURL(exact)`),
  `deleteTransaction` **không** điều hướng.

## 2. DatePicker là `<input type="hidden">` → `.fill()` bị Playwright cấm

- **Triệu chứng:** `Input of type "hidden" cannot be filled`.
- **Nguyên nhân:** `components/ui/date-picker.tsx` render input hidden giữ giá trị + trigger
  button hiển thị chữ (thay `<input type="date">` native — bug Safari iOS, PR #74/#75).
- **Cách né:** dùng helper ở `support/date-picker.ts`, **không** `.fill()`:
  - `fillDatePicker(page, name, iso)` — ghi thẳng DOM value; chỉ đúng nếu gọi **cuối cùng**
    ngay trước submit (field khác đổi sau đó → React re-render ghi đè value về state cũ).
  - `selectDateOnCalendar(page, targetDate)` — chọn qua **UI thật**. **Bắt buộc** dùng bản
    này khi form cha phản ứng theo state `date` (vd `TransactionForm` tính lại thuế/phí, hoặc
    chỉ hiện `SellRecomputeCompareCard` khi state date đổi) — `fillDatePicker` không trigger
    re-render nên nhánh phụ thuộc `date` không thấy giá trị mới.
- ⚠️ **`fillDatePicker` vô tác dụng hoàn toàn ở `BondTermsForm`** (form đó đọc React state,
  không đọc DOM) — xem [#17](#17-bondtermsform-đọc-thẳng-react-state-khi-submit-không-qua-formdata).

## 3. `isoDate` (UTC) lệch 1 ngày so với ô lịch ở timezone dương

- **Triệu chứng:** `[data-day="<iso>"]` không tìm thấy / bấm nhầm ngày, chỉ xảy ra khi chạy
  gần đầu ngày local (UTC+7).
- **Nguyên nhân:** `isoDate()` qua `toISOString()` (UTC); "nửa đêm local" convert sang UTC
  lùi về hôm trước. Còn `react-day-picker` gắn `data-day` theo field **local** của `Date`.
- **Cách né:** khớp ô lịch trên UI phải dùng `localIsoDate()` (`support/dates.ts`) — tính
  theo `getFullYear/getMonth/getDate`. `isoDate()` chỉ dùng cho string gửi server (buffer
  nhiều ngày giữa các mốc đủ hấp thụ lệch giờ). Ngày tương đối luôn qua `daysAgo()`, **không
  hardcode năm**.

## 4. ⛔ Nút chuyển tháng DayPicker bị caption đè → `.click()` trúng nhầm

> **HẾT HIỆU LỰC** từ [#18](#18-datepicker-đổi-sang-captionlayoutdropdown--hidenavigation):
> `hideNavigation` đã bỏ hẳn nút "Next/Previous Month", `support/date-picker.ts` không còn
> `dispatchEvent("click")` nào. Giữ mục để số #4 không bị tái dùng — **đừng làm theo**.
>
> Nội dung cũ: `month_caption` (relative) đè lên vùng `nav` (absolute) của DayPicker nên click
> theo toạ độ (kể cả `force: true`) trúng nhầm caption; né bằng `dispatchEvent("click")` thẳng
> vào element handle. Nếu sau này DayPicker có lại nút điều hướng, đây là bẫy sẽ quay lại.

## 5. `context.close()` trong `finally` nuốt luôn bước cleanup sau nó

- **Triệu chứng:** sau một test timeout, dữ liệu test (User, PriceQuote seed) bị leak sang
  lần chạy sau.
- **Nguyên nhân:** khi Playwright timeout, browser/context bị kill **trước** khi lỗi ném ra;
  `context.close()` gọi sau đó tự throw "Target page/context/browser has been closed", chặn
  các bước dọn dẹp phía sau trong cùng `finally`.
- **Cách né:** gọi `closeContext(context)` (`support/test-session.ts` — đã nuốt lỗi bằng
  `.catch(() => {})`) **đầu tiên** trong `finally`, rồi mới `cleanupTestUser`/dọn seed.
  **Không** nuốt lỗi ở các bước dọn khác — để lỗi thật của chúng lộ ra.

## 6. `PriceQuote` không scoped theo user + không cascade khi xoá User

- **Triệu chứng:** test đọc nhầm giá của lần chạy khác; hoặc data seed còn lại sau khi
  `cleanupTestUser`.
- **Nguyên nhân:** bảng `PriceQuote` dùng chung (không có `userId`), không nằm trong cascade
  `onDelete` của `User`.
- **Cách né:** mỗi lần chạy dùng **mã ngẫu nhiên** (không hardcode "FPT"/"SJC" — tránh đụng
  data verify thủ công); **tự xoá `PriceQuote` đã seed** ở `finally` (cleanup User không tự
  dọn nó). Xem `dashboard.spec.ts`, `nav-override.spec.ts`.

## 7. Seed `PriceQuote` phải TRƯỚC khi tạo Holding

- **Triệu chứng:** dashboard/định giá hiện "thiếu giá" dù đã seed giá.
- **Nguyên nhân:** `unstable_cache` ghim kết quả "thiếu giá" ở lần đọc đầu; seed sau không
  làm cache mất hiệu lực.
- **Cách né:** seed `PriceQuote` **trước** khi tạo Holding (xem `manual-snapshot.spec.ts`,
  `dividends.spec.ts`). Khi cần cache key mới, đổi mốc thời gian/cutoff để query chạy lại.

## 8. Nhiều worker seed cùng Setting → `P2002` (unique) thoáng qua

- **Triệu chứng:** test đỏ ngẫu nhiên ở bước seed Setting dùng chung, lỗi unique constraint.
- **Nguyên nhân:** nhiều worker chạy song song cùng upsert một Setting → race.
- **Cách né:** upsert nuốt `P2002` coi như "worker khác seed xong rồi" (xem
  `upsertSettingIgnoringRace` trong `dividends.spec.ts`). Xem thêm
  [#14](#14-workers--1--lỗi-serializable--p2002-khi-nhiều-test-cùng-cập-nhật-1-bản-ghi-dùng-chung)
  (vì sao `workers: 1`) và [#15](#15-thiếu-setting-toàn-cục-mới-thêm--lỗi-render-thoáng-qua-ở-nhiều-spec-không-liên-quan)
  (`scripts/e2e.mjs` **nay đã** chạy `prisma db seed`, nên phần lớn Setting không cần seed
  trong spec nữa).

## 9. Đổi cookie cutoff cần hard navigation — đừng reload thủ công che bug

- **Triệu chứng:** segmented nav kẹt ở tab cũ dù cookie cutoff đã đổi.
- **Nguyên nhân:** link soft-nav (client) không cập nhật active state theo cookie mới (bug
  router Next.js — đã fix bằng ép hard navigation cho các link đó).
- **Cách né:** spec **không** `page.reload()` thủ công sau khi đổi cutoff — reload sẽ luôn
  pass và **che mất** regression nếu fix bị revert. Để spec bắt đúng bug (xem
  `cutoff.spec.ts`).

## 10. Chọn 1 dòng trong danh sách bằng class Tailwind → giòn

- **Triệu chứng:** đổi style làm vỡ test dù hành vi không đổi.
- **Nguyên nhân:** `locator("div.rounded-2xl.border-border").filter({ hasText })` bám class
  trình bày (còn sót trong `holdings.spec.ts`).
- **Cách né:** filter theo `getByRole("listitem"/"row")` + nội dung ổn định (số tiền, ngày);
  nếu vẫn mơ hồ → đề xuất `data-testid` vào component nguồn (rule mục 5). **Không** thêm
  selector class mới.

## 11. Checkbox "peer sr-only" → `.check()` thường thất bại

- **Triệu chứng:** không tick được checkbox ("giá đã phản ánh thị trường"...).
- **Nguyên nhân:** input thật ẩn (`peer sr-only`), UI hiển thị qua `<label>` bao ngoài.
- **Cách né:** `.check({ force: true })` trên input, hoặc click `<label>` bao (xem
  `dividends.spec.ts`).

## 12. Dialog confirm (`window.confirm`) chặn action → phải bắt trước khi bấm

- **Triệu chứng:** bấm "Xóa" bị treo, không có gì xảy ra.
- **Nguyên nhân:** action mở `window.confirm` native, Playwright tự dismiss nếu không có
  handler.
- **Cách né:** `page.once("dialog", (d) => d.accept())` **ngay trước** khi bấm nút mở confirm
  (xem `holdings.spec.ts`).

## 13. Lần chạy đầu flaky do Turbopack cold-compile — không phải regression

- **Triệu chứng:** 404 thoáng qua / assertion cuối chạm timeout ở lần chạy đầu, retry là qua.
- **Nguyên nhân:** dev server (Turbopack) biên dịch route lần đầu chậm; nhiều worker cùng
  request route chưa compile → race/404 thoáng qua.
- **Cách né:** đã cấu hình `retries: 1` cả local + `timeout: 60s` (`playwright.config.ts`).
  Lỗi **thật** do code sai sẽ fail lại y hệt ở retry, không bị che. Đừng nới timeout vô tội
  vạ để "chữa" một lỗi domain thật.

## 14. `workers > 1` → lỗi Serializable / P2002 khi nhiều test cùng cập nhật 1 bản ghi dùng chung

- **Triệu chứng:** chạy song song (từng gặp ở `workers: 4`) đỏ ngẫu nhiên với lỗi serialize
  transaction ("could not serialize access" / write conflict) hoặc `P2002`, ở các test cùng
  đụng `Setting` toàn cục / `PriceQuote`.
- **Nguyên nhân:** các bản ghi này **không** scoped theo user (global) → nhiều worker cùng
  ghi vào **cùng một record** trong transaction Serializable → xung đột. Khác với data scoped
  theo user (Holding/Cashflow) vốn tách được bằng user random (mỗi test một user riêng).
- **Cách né:** `playwright.config.ts` đặt **`workers: 1`** → chạy tuần tự, hết xung đột đồng
  thời. `fullyParallel: true` khi đó **vô hại nhưng vô hiệu** (chỉ kích hoạt khi `workers ≥ 2`).
  **Muốn nâng `workers` về sau:** trước hết phải làm mọi ghi vào record dùng chung chịu được
  đồng thời (upsert nuốt `P2002` như #8, hoặc tách khoá theo test) — không nâng workers trước
  khi isolate xong, sẽ tái hiện đúng lỗi này.

## 15. Thiếu `Setting` toàn cục mới thêm → lỗi render "thoáng qua" ở NHIỀU spec không liên quan

- **Triệu chứng:** `SETTING_NOT_FOUND: "<KEY>"` làm fail **cứng** (không flaky) vài test ở
  spec không dính dáng feature vừa thêm; các spec KHÁC cùng gọi component đó cũng log lỗi ở
  webServer nhưng lại **pass** — dễ tưởng nhiễu môi trường thay vì bug thật. Ca gốc: merge
  phase-6 → `CONCENTRATION_WARNING_THRESHOLD` thiếu, 3 test `holdings.spec.ts`/
  `dividends.spec.ts` fail.
- **Nguyên nhân:** một `Setting` toàn cục được đọc ở path chạy qua **gần như mọi** spec (ở
  đây `getConcentrationBadges()` trong `lib/portfolio-valuation.ts`, gọi mỗi lần render danh
  sách vị thế), trong khi `scripts/e2e.mjs` lúc đó chỉ `migrate deploy`, không seed. Lỗi
  throw trong một Suspense boundary con nên **không sập cả trang** — chỉ test có assertion
  chạm đúng khu vực/thời điểm đó mới lộ fail.
- **Cách né:** `scripts/e2e.mjs` nay chạy `pnpm exec prisma db seed` (dùng CHUNG
  `prisma/seed.ts` với DB dev) ngay sau `migrate deploy` — mọi `Setting` toàn cục có sẵn từ
  đầu. `.env.test` cần `SEED_ADMIN_EMAIL` (giả; `seed.ts` throw nếu thiếu). Spec **chỉ seed
  thêm giá trị RIÊNG cho kịch bản đang test** (vd `tax-and-fee.spec.ts` seed mốc
  `effectiveFrom` thứ hai để test "đổi thuế áp đúng theo ngày"), **không** seed lại baseline
  đã có trong `db:seed` — trùng thì dễ lệch âm thầm khi 2 nơi update khác nhau.
- **Quy tắc:** thêm `Setting` mới mà code đọc nó ở path chạy qua nhiều/mọi spec → thêm vào
  `prisma/seed.ts`, **không** seed rải rác trong spec hay `test-session.ts`.

## 16. UI redesign đổi dòng danh sách từ `<Link>` sang `<button>` mở Sheet

- **Triệu chứng:** `getByRole("link", { name: /VNM/ })` không tìm thấy dù dòng vị thế hiện rõ
  trên UI (thấy trong page snapshot lúc fail). Ca gốc: merge phase-6, `holdings.spec.ts` fail
  ở bước "mở lại chi tiết vị thế đã đóng".
- **Nguyên nhân:** phase-6 vẽ lại tab "Đã đóng" (`ClosedHoldingRow`) thành `<button>` mở
  `ClosedPositionSheet` (client state, mockup 6i) thay vì `<Link>` điều hướng thẳng
  `/holdings/[id]` — spec viết TRƯỚC phase-6 giả định sai role.
- **Cách né:** `HoldingsPage.closedHoldingButton(symbol)` (role `"button"`, riêng tab "Đã
  đóng") thay vì `holdingLink()` (chỉ đúng cho tab "Đang mở"). Muốn vào trang chi tiết đầy đủ
  thì dùng `HoldingsPage.openClosedHolding(symbol, holdingUrl)` (bấm dòng → mở sheet → bấm
  link "Sửa / xoá giao dịch đã ghi" → pin đúng URL), **không** `detail.goto()` thẳng.
- **Bài học (2 tầng):**
  - Một fix quay lại UI phải đi kèm spec exercise **LẠI qua UI đó**, không né bằng điều hướng
    thẳng URL. (Bản đầu phase-6 làm mất hẳn đường vào trang chi tiết — người dùng ghi nhầm
    giao dịch khiến vị thế đóng thì không còn cách sửa/xoá qua UI; phát hiện ở code review
    PR #81, đã thêm lại link trong sheet.)
  - UI redesign đổi **loại phần tử tương tác** (Link ↔ button/Sheet) cho màn ĐÃ CÓ SPEC vẫn
    lọt qua review nếu spec cũ không chạy lại → `pnpm e2e` toàn bộ spec chạm route bị đổi UI
    trước khi merge, không chỉ spec của feature mới.

## 17. `BondTermsForm` đọc thẳng React state khi submit, KHÔNG qua `FormData`

- **Triệu chứng:** set `firstCouponDate`/`maturityDate` bằng `fillDatePicker()` rồi submit
  `BondTermsForm` — giá trị lưu xuống DB vẫn **rỗng**, dù `pnpm typecheck` và thao tác tay
  trên UI đều bình thường.
- **Nguyên nhân:** `submitTerms()` (`BondTermsForm.tsx`) gọi `saveBondTerms()` bằng **biến
  state** (`parValue`, `firstCouponDate`...), không `formData.get(...)` — khác MỌI form ghi
  khác của repo (`DividendForm`, `TransactionForm`, `MaturitySettlementForm` đều qua
  `FormData`). Lý do trong code: mọi field ở đây controlled, và `SegmentedControl`/`Select`
  không phải input thật nên `FormData` sẽ thiếu `issuerType`. `fillDatePicker()` chỉ ghi DOM
  value của input ẩn, **không** gọi `onChange` → state không đổi → form đọc state rỗng.
- **Cách né:** field `Input`/`Select` thường (`parValue`, `couponRatePercent`,
  `couponFrequencyMonths`) vẫn `.fill()`/`.selectOption()` bình thường (dispatch event thật).
  Riêng 2 field DatePicker (`firstCouponDate`, `maturityDate`) **bắt buộc**
  `selectDateOnCalendar()`. `e2e/pages/bond-terms-form.ts` hiện chưa có setter cho 2 field
  này (2 kịch bản Phase 7 không cần — trái phiếu chiết khấu, bỏ trống vẫn hợp lệ); thêm
  setter dùng `selectDateOnCalendar` khi có spec thật sự cần.

## 18. `DatePicker` đổi sang `captionLayout="dropdown"` + `hideNavigation`

- **Bối cảnh:** `components/ui/date-picker.tsx` bỏ hẳn nút "Tháng trước/sau" (chọn ngày cách
  nhiều năm — vd đáo hạn trái phiếu — phải bấm hàng chục lần), thay bằng 2 `<select>` chọn
  thẳng tháng/năm (react-day-picker `captionLayout="dropdown"`).
- **Ảnh hưởng e2e:** `selectDateOnCalendar()` (`support/date-picker.ts`) trước đó đếm số lần
  bấm "Go to the Next/Previous Month" rồi `dispatchEvent("click")` — nút đó **không còn tồn
  tại**, spec gọi hàm này sẽ fail vì tìm không thấy nút. Đã sửa: chọn thẳng qua 2 combobox
  `aria-label="Choose the Month"`/`"Choose the Year"` (mặc định react-day-picker, component
  chưa set `locale`) bằng `.selectOption()`. **Làm [#4](#4--nút-chuyển-tháng-daypicker-bị-caption-đè--click-trúng-nhầm) hết hiệu lực.**
- **Bài học chung (lặp lại [#16](#16-ui-redesign-đổi-dòng-danh-sách-từ-link-sang-button-mở-sheet)):**
  đổi CƠ CHẾ điều hướng của một component `ui/` dùng chung xuyên toàn app phải rà **mọi**
  helper e2e đụng tới nó, không chỉ spec của tính năng đang sửa — `DatePicker` xuất hiện ở
  transaction/dividend/bond-terms/nav-override nên bán kính ảnh hưởng rất rộng.

## 19. Log ra file bằng `flags: "w"` trong app → nhiều process ghi đè nhau

- **Triệu chứng:** thêm log server ra file (`.e2e-logs/server.log`, xem `lib/logger.ts`) để
  `e2e-verifier` đọc khi test fail — chạy `pnpm e2e` xong file trống hoặc chỉ còn vài dòng
  cuối, dù chắc chắn đã log suốt lần chạy. Cache qua `globalThis` (pattern `globalForPrisma`
  ở `lib/db.ts`) **không** cứu được.
- **Nguyên nhân:** `globalThis` chỉ sống trong ĐÚNG 1 process. Next dev phục vụ request qua
  nhiều render-worker/process con, mỗi bên có `globalThis` riêng. `logger.ts` mở
  `fs.createWriteStream(path, { flags: "w" })` (ghi đè) ở top-level module: bất kỳ
  worker/process nào (hoặc module bị Turbopack nạp lại) cũng coi mình là "lần đầu" và ghi đè
  sạch log của bên khác — cache `globalThis` chỉ giải quyết "nạp lại module trong CÙNG 1
  process", không giải quyết "nhiều process cùng mở file".
- **Cách né:** đưa việc "xoá sạch từ lần chạy trước" ra NGOÀI app, về tiến trình chắc chắn
  chỉ chạy 1 lần cho cả phiên — `scripts/e2e.mjs` (orchestrator, không bị Next reload) tự
  `writeFileSync(path, "")` trước khi spawn Playwright/webServer. `lib/logger.ts` đổi sang
  `flags: "a"` (append): bao nhiêu process mở file cũng chỉ nối thêm, không ai xoá của ai.
- **Bài học chung:** side-effect "reset một resource dùng chung về rỗng" **không tin cậy được
  nếu đặt trong chính app** (app không biết mình có phải "lần đầu" thật hay không) — phải đặt
  ở tầng orchestrator bên ngoài.
