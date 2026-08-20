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

| Bạn đang gặp                                                                                                                                                                                                                                                                                                                 | Mục                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `waitForURL()` không bao giờ khớp sau khi tạo vị thế / ghi giao dịch                                                                                                                                                                                                                                                         | [#1](#1-redirect-sau-giao-dịch-gắn-cashflowid--so-url-tuyệt-đối-bị-treo)                                                                                           |
| `Input of type "hidden" cannot be filled`                                                                                                                                                                                                                                                                                    | [#2](#2-datepicker-là-input-typehidden--fill-bị-playwright-cấm)                                                                                                    |
| Set ngày xong nhưng form **không tính lại** thuế/phí, hoặc card so sánh không hiện                                                                                                                                                                                                                                           | [#2](#2-datepicker-là-input-typehidden--fill-bị-playwright-cấm)                                                                                                    |
| Ngày lưu xuống DB **rỗng** dù đã set qua helper (form trái phiếu)                                                                                                                                                                                                                                                            | [#17](#17-bondtermsform-đọc-thẳng-react-state-khi-submit-không-qua-formdata)                                                                                       |
| Ô lịch `[data-day="<iso>"]` không tìm thấy / bấm nhầm ngày                                                                                                                                                                                                                                                                   | [#3](#3-isodate-utc-lệch-1-ngày-so-với-ô-lịch-ở-timezone-dương)                                                                                                    |
| Không chuyển được tháng/năm trên lịch                                                                                                                                                                                                                                                                                        | [#18](#18-datepicker-đổi-sang-captionlayoutdropdown--hidenavigation)                                                                                               |
| Data test (User, PriceQuote) **leak** sang lần chạy sau                                                                                                                                                                                                                                                                      | [#5](#5-contextclose-trong-finally-nuốt-luôn-bước-cleanup-sau-nó), [#6](#6-pricequote-không-scoped-theo-user--không-cascade-khi-xoá-user)                          |
| Dashboard hiện "thiếu giá" dù đã seed `PriceQuote`                                                                                                                                                                                                                                                                           | [#7](#7-seed-pricequote-phải-trước-khi-tạo-holding)                                                                                                                |
| `P2002` unique constraint đỏ ngẫu nhiên                                                                                                                                                                                                                                                                                      | [#8](#8-nhiều-worker-seed-cùng-setting--p2002-unique-thoáng-qua), [#14](#14-workers--1--lỗi-serializable--p2002-khi-nhiều-test-cùng-cập-nhật-1-bản-ghi-dùng-chung) |
| `could not serialize access` / write conflict                                                                                                                                                                                                                                                                                | [#14](#14-workers--1--lỗi-serializable--p2002-khi-nhiều-test-cùng-cập-nhật-1-bản-ghi-dùng-chung)                                                                   |
| `SETTING_NOT_FOUND: "<KEY>"`, fail ở spec không liên quan feature đang làm                                                                                                                                                                                                                                                   | [#15](#15-thiếu-setting-toàn-cục-mới-thêm--lỗi-render-thoáng-qua-ở-nhiều-spec-không-liên-quan)                                                                     |
| Segmented nav kẹt tab cũ sau khi đổi cutoff                                                                                                                                                                                                                                                                                  | [#9](#9-đổi-cookie-cutoff-cần-hard-navigation--đừng-reload-thủ-công-che-bug)                                                                                       |
| Test vỡ khi đổi style dù hành vi không đổi                                                                                                                                                                                                                                                                                   | [#10](#10-chọn-1-dòng-trong-danh-sách-bằng-class-tailwind--giòn)                                                                                                   |
| `.check()` không tick được checkbox                                                                                                                                                                                                                                                                                          | [#11](#11-checkbox-peer-sr-only--check-thường-thất-bại)                                                                                                            |
| Bấm nút "Xóa" bị treo, không có gì xảy ra                                                                                                                                                                                                                                                                                    | [#12](#12-dialog-confirm-windowconfirm-chặn-action--phải-bắt-trước-khi-bấm)                                                                                        |
| 404 / timeout thoáng qua ở lần chạy đầu, retry thì qua                                                                                                                                                                                                                                                                       | [#13](#13-lần-chạy-đầu-flaky-do-turbopack-cold-compile--không-phải-regression)                                                                                     |
| `getByRole("link")` không thấy dòng danh sách đang hiện rõ trên UI                                                                                                                                                                                                                                                           | [#16](#16-ui-redesign-đổi-dòng-danh-sách-từ-link-sang-button-mở-sheet)                                                                                             |
| `.e2e-logs/server.log` trống / chỉ còn vài dòng cuối                                                                                                                                                                                                                                                                         | [#19](#19-log-ra-file-bằng-flags-w-trong-app--nhiều-process-ghi-đè-nhau)                                                                                           |
| Mọi test cần đăng nhập timeout, page snapshot cho thấy màn "Đăng nhập với Google" thay vì app; webServer log lặp `[auth][error] MissingSecret`                                                                                                                                                                               | [#20](#20-git-worktree-mới-không-có-envlocal--authjs-missingsecret--mọi-test-cần-login-fail)                                                                       |
| `strict mode violation: getByText(...) resolved to 2 elements` khi tìm một số `%` cụ thể trên màn có cả `ConcentrationBadge` (mẫu số toàn danh mục) lẫn số `%` khác mẫu số                                                                                                                                                   | [#21](#21-2-số--khác-mẫu-số-trùng-giá-trị-khi-danh-mục-test-chỉ-có-1-loại-tài-sản)                                                                                 |
| `strict mode violation: getByText(...) resolved to 2 elements` khi lọc dòng/card theo tên nhóm tài sản ("Cổ phiếu"...) trên màn có ghi chú/mô tả nhắc lại tên nhóm ở chữ thường                                                                                                                                              | [#22](#22-getbytextstring-không-phân-biệt-hoachữ-thường--khớp-nhầm-tên-nhóm-lặp-lại-trong-ghi-chú-amber)                                                           |
| `page.waitForURL(...)` sau `submitBuy()`/`submitSell()` (chờ mãi không resolve) dù page snapshot lúc timeout cho thấy app ĐÃ điều hướng và render đúng kết quả cuối                                                                                                                                                          | [#23](#23-waitforurl-không-resolve-sau-chuỗi-3-soft-nav-router-push-liên-tiếp-trong-cùng-test)                                                                     |
| Chạy `pnpm e2e` FULL SUITE (hoặc nhiều spec liền một lượt) trên Claude Cloud: nhiều spec KHÔNG liên quan nhau đồng loạt `Test timeout of 60000ms exceeded`, retry ra `page.goto: net::ERR_ABORTED; maybe frame was detached?`, luôn đúng tại `DashboardPage.goto()` (điều hướng "/") — chạy riêng lẻ từng file thì pass sạch | [#24](#24-full-suite-nhiều-spec-liền-lượt-trên-claude-cloud-điều-hướng--dashboard-timeout-hàng-loạt-không-liên-quan-thay-đổi-đang-verify)                          |
| Vừa tạo Holding BOND/GOLD qua UI, NAV/điểm "hôm nay" của nó vẫn `0 ₫`/`−100,0%`, hoặc field phụ thuộc "low != 0" (vd `periodSpreadPercent`) không hiện dù card cha vẫn render                                                                                                                                                | [#25](#25-tạo-holding-bondgold-qua-ui-không-tự-có-nav-hôm-nay--0--freezemanualsnapshot-âm-thầm-bỏ-qua-khi-chưa-có-navoverride)                                     |
| `strict mode violation: getByText(/dùng giá nhập tay/) resolved to 2 elements` trên Dashboard sau khi thêm component mới có heading trùng cụm từ với ghi chú tóm tắt đã có                                                                                                                                                   | [#26](#26-thêm-component-mới-cùng-cụm-từ-với-locator-gettext-regex-đã-có--ambiguous)                                                                               |

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

## 20. Git worktree mới không có `.env.local` → Auth.js `MissingSecret` → mọi test cần login fail

- **Triệu chứng:** trên một **git worktree mới** (`.claude/worktrees/<tên>`), `pnpm e2e` chạy
  hết migrate/seed bình thường, webServer boot được, nhưng NGAY test đầu tiên cần đăng nhập đã
  timeout 60s ở bước chờ điều hướng sau khi tương tác UI; `page snapshot` trong
  `error-context.md` cho thấy màn hình "Đăng nhập với Google" thay vì app đã login, dù
  `createTestSession()`/`signInAs()` (`support/test-session.ts`) đã set cookie
  `authjs.session-token` hợp lệ trỏ đúng `Session` row trong DB. webServer log
  (`.e2e-logs/server.log` hoặc `[WebServer]` trong output Playwright) lặp lại
  `[auth][error] MissingSecret: Please define a secret` liên tục. Xảy ra với **toàn bộ** test
  cần session (gần hết suite), không phải 1-2 case lẻ tẻ.
- **Nguyên nhân:** `.env`/`.env.local` (chứa `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`,
  `SEED_ADMIN_EMAIL`) bị `.gitignore` (`*.env`) nên **không tự có** khi tạo worktree mới bằng
  `git worktree add` — worktree chỉ có working tree từ git, không copy file gitignored của
  worktree gốc. `.env.test` (được git track) chỉ chứa `DATABASE_URL`/`SEED_ADMIN_EMAIL` cho
  riêng DB test, không có `AUTH_SECRET`. Thiếu `AUTH_SECRET` → Auth.js `assertConfig()` throw
  `MissingSecret` ở MỌI lời gọi `auth()`, kể cả khi cookie session hợp lệ đã có sẵn trong
  request → server luôn coi request là chưa đăng nhập → middleware redirect về màn login.
- **Cách né:** trước khi chạy `pnpm e2e` lần đầu trên một worktree mới, kiểm tra
  `Test-Path .env.local` (hoặc `.env`) ở root worktree; nếu thiếu, copy từ worktree gốc/repo
  chính (`.env.local` là file dev cục bộ, cùng giá trị dùng chung cho mọi worktree trên cùng
  máy, KHÔNG phải secret theo-worktree) — xem README.md mục "Chạy app local" bước 2. File này
  gitignored nên copy không tạo ra thay đổi git nào (`git status`/`git check-ignore -v
.env.local` xác nhận).
- **Bài học chung:** một lượt e2e đỏ hàng loạt ngay từ test đầu tiên, cùng một kiểu lỗi
  (timeout chờ điều hướng sau tương tác, không phải lỗi assertion domain cụ thể) trên một
  worktree **mới tạo** nên nghi ngờ thiếu file env cục bộ trước khi nghi ngờ code — kiểm tra
  `.env.local` tồn tại là bước rẻ, làm trước khi đọc sâu `.e2e-logs/server.log`.

## 21. 2 số % khác mẫu số trùng giá trị khi danh mục test chỉ có 1 loại tài sản

- **Triệu chứng:** viết e2e cho `StockAllocationDetail`
  (`e2e/tests/concentration-and-allocation.spec.ts`, issue #131/#132) —
  `expect(page.getByText("60,0%")).toBeVisible()` báo `strict mode violation:
resolved to 2 elements`: một là số `%` lớn cột phải (mẫu số NAV nhóm cổ
  phiếu, `StockAllocationRow`), một là `ConcentrationBadge` cũ cạnh tên mã
  (`"~60,0% danh mục"`, mẫu số NAV toàn danh mục) — `getByText` mặc định match
  theo substring nên khớp cả hai.
- **Nguyên nhân:** KHÔNG phải bug UI — danh mục test dựng chỉ toàn mã STOCK
  (không có FUND/BOND/GOLD nào khác), nên NAV nhóm cổ phiếu **trùng đúng bằng**
  NAV toàn danh mục với mã đó → 2 con số khác mẫu số (cố ý khác nhau về nghĩa,
  xem `process/UI_stock-allocation-detail.md` mục "Hai con số % khác mẫu số
  cùng tồn tại trên một dòng") tình cờ **trùng giá trị số**, cả 2 cùng chứa
  chuỗi `"60,0%"`.
- **Cách né:** thêm `{ exact: true }` vào `getByText()` khi tìm số `%` lớn cột
  phải — text node đó CHỈ chứa đúng `"60,0%"` (không có `"danh mục"` theo sau)
  nên exact match tự loại badge ra, không cần đổi cấu trúc DOM hay đổi dữ liệu
  test (thêm mã loại tài sản khác chỉ để né trùng số là phức tạp hoá test không
  cần thiết).
- **Bài học chung:** khi 2 con số nghiệp vụ cố ý khác mẫu số (percentInGroup
  vs concentrationPercent) cùng hiện trên một màn, đừng giả định giá trị của
  chúng luôn khác nhau trong data test — dựng data tối giản (ít loại tài sản)
  dễ vô tình làm 2 mẫu số trùng nhau, lộ ra bằng `strict mode violation` thay
  vì assertion sai — đọc kỹ error Playwright liệt kê đủ cả 2 phần tử khớp
  trước khi nghi ngờ sai selector.

## 22. `getByText(string)` không phân biệt hoa/chữ thường → khớp nhầm tên nhóm lặp lại trong ghi chú amber

- **Triệu chứng:** viết e2e cho NAV ròng/lãi-lỗ theo nhóm trên `/allocation`
  (`e2e/tests/allocation-group-pnl.spec.ts`, issue #130) — locator gom "cả
  dòng nhóm" kiểu `page.getByText("Cổ phiếu").locator("../..")` báo
  `strict mode violation: ... resolved to 2 elements`: một là thẻ nhóm bọc
  amber (`div.rounded-xl.border-warning/28`, đúng ý muốn), một là `<a
href="/allocation/stock">` (Link bọc NGOÀI của chính dòng đó, sai — 2 phần
  tử lồng nhau trong CÙNG một dòng nhóm, không phải 2 nhóm khác nhau).
- **Nguyên nhân:** `getByText(string)` mặc định match **không phân biệt
  hoa/thường** + theo substring. Khi nhóm `navIsPartial === true`,
  `AllocationScreen.tsx` render thêm ghi chú amber lặp lại tên nhóm ở dạng
  **chữ thường** qua `ASSET_TYPE_LABEL[slice.type].toLowerCase()` (vd "...NAV
  nhóm **cổ phiếu** chưa đầy đủ..."). `getByText("Cổ phiếu")` khớp case-
  insensitive nên khớp CẢ span nhãn ("Cổ phiếu", hoa đầu câu) LẪN div ghi chú
  amber (chứa "cổ phiếu" thường) — 2 điểm xuất phát khác nhau, `.locator("../..")`
  (đi lên 2 cấp) từ mỗi điểm ra 2 phần tử DOM khác nhau (từ span: lên tới thẻ
  amber bọc trực tiếp; từ div ghi chú: lên tới `<Link>` bọc ngoài, vì div ghi
  chú nằm nông hơn span 1 cấp trong cây DOM). Chỉ lộ ra khi nhóm có ghi chú
  amber (`navIsPartial`) — nhóm bình thường không có text lặp lại nên không
  bị.
- **Cách né:** dùng **RegExp không có flag `i`** thay vì string:
  `page.getByText(new RegExp(assetTypeLabel))` — case-sensitive, chỉ khớp
  đúng span nhãn viết hoa đầu câu, không khớp chữ thường trong ghi chú (xem
  `AllocationPage.groupCard()`, `e2e/pages/allocation-page.ts`). Nhãn asset
  type tiếng Việt hiện tại ("Cổ phiếu", "Quỹ mở", "Trái phiếu", "Vàng") không
  có ký tự đặc biệt regex nên dùng thẳng, không cần escape.
- **Bài học chung:** bất kỳ locator gom "cả 1 dòng/card" bằng
  `getByText(nhãn).locator("..")`/`"../.."` đều rủi ro khi UI có **bất kỳ chỗ
  nào khác** lặp lại đúng nhãn đó (kể cả khác hoa/thường) trong cùng subtree —
  không chỉ do 2 nhóm nghiệp vụ khác nhau trùng số (như #21) mà còn do
  **case-insensitive matching** trùng ngay trong nội bộ 1 dòng. Khi thêm
  copy/ghi chú tự do (đặc biệt câu văn có nhắc lại tên field/nhãn ở dạng
  thường), rà lại các locator gom-theo-nhãn đã có trước khi tin chúng vẫn
  unique.

## 23. `waitForURL` không resolve sau chuỗi ≥3 soft-nav (`router.push`) liên tiếp trong cùng test

- **Triệu chứng:** viết e2e cho HoldingSwitcher trong `TransactionForm` (issue
  #138, `holdings.spec.ts` — đổi mã giữa 2 vị thế rồi submit BUY) —
  `formB.submitBuy()` (dùng `page.waitForURL(afterTransactionUrl(...))` mặc
  định, `waitUntil: "load"`) treo tới hết `Test timeout` (60s, rồi 180s với
  `test.slow()` — nới timeout KHÔNG sửa được gì). `error-context.md`/page
  snapshot lúc timeout cho thấy trang ĐÃ ở đúng URL/nội dung cuối cùng (đúng
  SL, đúng 2 giao dịch, không ghi nhầm) — app hoạt động đúng, chỉ riêng lời
  gọi `waitForURL` không bao giờ resolve. Lặp lại y hệt ở 2 lần chạy độc lập,
  luôn dừng ở đúng soft-nav thứ 3 trong test (create B → đổi mã qua switcher →
  submit) dù 2 `waitForURL` trước đó trong CÙNG test (tạo vị thế, chọn mã
  trong switcher) đều resolve bình thường.
- **Nguyên nhân (chưa xác định chắc chắn, chỉ quan sát được điều kiện lặp
  lại):** cả `submitBuy`/`submitSell`/switcher đều điều hướng qua
  `router.push()` (Next.js App Router, soft-nav — không phải reload trang
  thật). Nghi vấn: `page.waitForURL` mặc định chờ thêm lifecycle `"load"` SAU
  khi URL khớp; với soft-nav dồn dập (≥3 lần liên tiếp không xen hard
  navigation nào) trong 1 trang, CDP có thể không phát lại sự kiện `"load"`
  cho lần thứ 3 trở đi ở môi trường/phiên bản Playwright-Chromium đang chạy —
  khác hẳn behavior "slow nhưng cuối cùng cũng xong" (không phải do máy chậm,
  vì tăng timeout lên 180s vẫn treo y hệt).
- **Cách né:** ở bước soft-nav **thứ 3 trở lên** trong cùng 1 test, KHÔNG
  dùng action đã có sẵn `waitForURL` bên trong (`submitBuy()`/`submitSell()`)
  — tự fill field + `.click()` nút submit tay, rồi verify bằng **assertion
  nội dung tự auto-retry** (`expect(locator).toHaveText(...)`, có thể nới
  `timeout` riêng cho assertion đó) thay vì đợi URL đổi. Assertion nội dung
  không phụ thuộc lifecycle `"load"` nên né được hẳn lớp bug này, đồng thời
  vẫn verify đúng thứ cần verify (dữ liệu hiển thị đúng). Xem
  `e2e/tests/holdings.spec.ts` (test "đổi mã qua HoldingSwitcher...").
- **Bài học chung:** một test đi qua **nhiều vòng soft-nav liên tiếp** (tạo
  data + đổi mã + submit, tất cả cùng dùng `router.push`) rủi ro cao hơn hẳn
  so với test chỉ có 1-2 soft-nav — gặp `waitForURL` treo bất thường (page đã
  đúng nhưng promise không resolve) ở bước thứ 3+ thì nghi ngay lớp bug này
  trước khi nghi máy chậm/logic sai; **tăng timeout không sửa được** (đã thử
  60s → 180s, treo y hệt) — chỉ đổi cơ chế wait mới né được.

## 24. Full suite (nhiều spec liền lượt) trên Claude Cloud: điều hướng "/" (Dashboard) timeout hàng loạt, không liên quan thay đổi đang verify

- **Triệu chứng:** chạy `pnpm e2e` FULL SUITE (hoặc rerun một lô lớn nhiều spec
  liền nhau) trên Claude Cloud — hàng loạt test ở NHIỀU spec khác nhau
  (`allocation-group-pnl`, `concentration-and-allocation`, `cutoff`,
  `dashboard`, `dividends`, `manual-snapshot`, `nav-chart`, `nav-override`,
  `nav-trend-chart`, `privacy-mode`, `tax-and-fee` — không có mẫu số chung nào
  về feature/route đang sửa) đồng loạt báo `Test timeout of 60000ms exceeded`,
  retry lần 1 báo tiếp `page.goto: net::ERR_ABORTED; maybe frame was detached?`
  navigating to `http://localhost:3000/`. Stack trace của MỌI ca fail đều dừng
  đúng tại `DashboardPage.goto()` (`await this.page.goto(this.url)`,
  `e2e/pages/dashboard-page.ts:14`) — dù các test đó gọi `dashboardPage.goto()`
  ở những thời điểm/nhánh hoàn toàn khác nhau trong flow của chúng. Tái hiện y
  hệt ở **2 lần chạy độc lập** (1 lần full suite 52 test/47.3 phút, 1 lần rerun
  có chủ đích 11 file/41 test) — không phải nhiễu ngẫu nhiên 1 lần. Ngược lại,
  chạy **CHỈ RIÊNG 1 file** (`pnpm e2e e2e/tests/nav-chart.spec.ts`, 3 test, kể
  cả test gọi `dashboardPage.goto()`) thì **pass sạch 100% trong ~37s**, không
  timeout/retry gì.
- **Nguyên nhân (chưa xác định chắc chắn, chỉ quan sát được điều kiện lặp
  lại):** route "/" (Dashboard) là route NẶNG NHẤT app (NAV + XIRR + PnL + cost
  drag + allocation + snapshot + price-status, nhiều query song song +
  Turbopack cold-compile lần đầu mỗi route) — khi chạy NHIỀU spec liên tiếp
  trong CÙNG một tiến trình `pnpm dev` (webServer Playwright chỉ spawn 1 lần
  cho cả lượt `pnpm e2e`, không restart giữa các spec/test), tài nguyên
  CPU/RAM của sandbox Cloud (vốn là container tạm, giới hạn cứng — xem
  TOOLS.md) tích tụ áp lực dần theo thời gian (nhiều tiến trình Chromium nối
  tiếp nhau, dev server phục vụ hàng chục request liên tục) tới ngưỡng khiến
  chính route "/" — route tốn tài nguyên nhất để compile/render — bắt đầu
  không phản hồi kịp trong 60s, rồi ở lần retry cả `page.goto` cũng bị hạ tầng
  abort giữa chừng (`ERR_ABORTED`/frame detached, không phải lỗi domain).
  KHÔNG phải lỗi từ thay đổi đang verify: 2 file page object bị đụng trong lượt
  verify tạo ra entry này (`dashboard-page.ts`, `holding-detail-page.ts`) chỉ
  **THÊM** getter/method mới, không sửa `goto()`/hành vi bất kỳ method cũ nào;
  phần lớn spec fail hoàn toàn không import/dùng gì từ những thay đổi đó.
- **Cách né (cho e2e-verifier lần sau gặp lại):** nếu `pnpm e2e` FULL SUITE
  trên Cloud báo fail hàng loạt, KHÔNG lập tức kết luận code vừa sửa có bug —
  đối chiếu theo 2 bước: (1) toàn bộ stack trace fail có cùng dừng lại ở
  `DashboardPage.goto()`/route "/" không, bất kể spec nào? (2) chạy lại RIÊNG
  các file/spec đang nghi ngờ thật sự liên quan tới thay đổi (`pnpm e2e
e2e/tests/<file>.spec.ts`) — nếu pass sạch khi chạy riêng lẻ mà chỉ fail khi
  chạy chung với nhiều spec khác, đó là tín hiệu tài nguyên sandbox Cloud
  (không phải regression) — báo rõ cả 2 kết quả (full suite vs. file riêng)
  trong báo cáo thay vì chỉ báo 1 trong 2. KHÔNG tự "sửa" bằng cách nới
  `timeout`/`retries` trong `playwright.config.ts` (đó là thay đổi cấu hình
  toàn cục ảnh hưởng mọi spec, ngoài phạm vi 1 lượt verify, và không giải quyết
  gốc rễ tài nguyên).
- **Bài học chung:** full-suite `pnpm e2e` trên Claude Cloud KHÔNG cùng mức độ
  ổn định như chạy 1 file riêng lẻ — chi phí thời gian/tài nguyên của lượt xác
  nhận "không phá luồng khác" cần cân nhắc thực tế này (full suite ở đây mất
  tới ~47 phút cho 52 test, workers:1), và fail hàng loạt không có mẫu số
  chung về feature/domain là dấu hiệu mạnh của giới hạn hạ tầng, không phải
  bug thật — vẫn phải báo cáo trung thực (không tự ý coi là "pass" khi output
  thật sự báo fail), nhưng phân biệt rõ với fail có domain logic cụ thể.

## 25. Tạo Holding BOND/GOLD qua UI KHÔNG tự có NAV "hôm nay" > 0 — `freezeManualSnapshot()` âm thầm bỏ qua khi chưa có `NavOverride`

- **Triệu chứng:** vừa `NewHoldingPage.create({ assetType: "Trái phiếu" | "Vàng", ... })`
  xong, kỳ vọng NAV/điểm "hôm nay" của holding đó > 0 (vd để `periodHigh`/
  `periodLow` cả hai đều khác `"0"`) nhưng UI hiện `0 ₫`, `−100,0%`, hoặc field
  phụ thuộc "low != 0" (như `periodSpreadPercent` → dòng "Biên độ kỳ",
  `HighLowCard`) không render dù card cha vẫn hiện bình thường.
- **Nguyên nhân:** BOND/GOLD định giá **thủ công** qua `NavOverride`
  (docs/domain/04-pricing-and-valuation.md — khác STOCK/FUND tự động qua
  `PriceQuote`/vnstock). Một holding BOND/GOLD **vừa tạo** chưa có dòng
  `NavOverride` nào → `valuateHoldings()` trả `MISSING_PRICE` →
  `freezeManualSnapshot()` (tự trigger sau `createHolding`/`addTransaction`,
  `features/snapshots/actions.ts`) thấy **không holding nào định giá được**
  (`plan.aggregate` rỗng) → log `warn` rồi **bỏ qua ghi Snapshot hoàn toàn**
  cho ngày hôm nay (cả per-holding lẫn tổng danh mục `holdingId: null`) — im
  lặng, không có lỗi nào nổi lên UI. Snapshot lịch sử **seed thẳng qua
  Prisma** (`db.snapshot.create`) vẫn đọc/hiện đúng bình thường (không đi qua
  `freezeManualSnapshot`) — đây là lý do 1 số spec cũ (vd
  `nav-chart.spec.ts` test "2 mốc Snapshot per-holding (BOND)") **pass được**
  dù bond chưa từng có `NavOverride`: test đó chỉ seed 1 mốc quá khứ + assert
  "có ≥2 điểm/không rơi vào nhánh rỗng", không assert giá trị "hôm nay" cụ thể
  nên điểm "hôm nay" ngầm = 0 không bị bắt.
- **Cách né:** nếu test cần điểm "hôm nay" của BOND/GOLD > 0 (không chỉ cần
  "có đường vẽ được"), phải tự nhập giá qua `NavOverrideForm` (`e2e/pages/
nav-override-form.ts`) NGAY SAU khi tạo holding, **trước** khi điều hướng
  tới màn cần assert:
  ```ts
  const priceForm = new NavOverrideForm(page, detail.url);
  await priceForm.goto();
  await priceForm.save({ price: 950_000, date: isoDate(new Date()) });
  ```
  Lưu ý `saveNavOverride` (Server Action) **không** tự trigger
  `freezeManualSnapshot()` lại — không có Snapshot mới nào được ghi cho hôm
  nay sau bước này. Nhưng giá trị "hôm nay" vẫn đúng vì các nơi cần nó (vd
  `computeTodayNavByType()`, `getNavTrendByAssetType()`) tính **SỐNG** mỗi
  lần render (đọc `NavOverride` mới nhất qua `getLatestNavOverrides()`), chỉ
  Snapshot **lịch sử đã đóng băng** mới cần ghi trước. Case cụ thể đã gặp:
  `nav-chart.spec.ts` test "2 mốc Snapshot tổng danh mục (holdingId: null) ...
  ở chip 'Tất cả' mặc định".
- **Cập nhật (lần chạy độc lập thứ 3, cùng phiên):** rerun toàn bộ full suite
  lần nữa, có theo dõi tài nguyên real-time (`free -m`/`/proc/loadavg` lấy mẫu
  mỗi 30s suốt 48.6 phút) — kết quả **giống hệt lần 1/2**: đúng 19 test đó fail
  lại (18/19 trùng khớp hoàn toàn danh sách 2 lần trước, thêm đúng 1 test mới
  `nav-chart.spec.ts` case entry-point — 2/3 test mới của issue #141 vẫn pass
  ngay cả trong full suite lần này). **Loại trừ được RAM là nguyên nhân:** mức
  dùng chỉ dao động 3.6–4.3GB/15GB tổng suốt cả lượt chạy, không có xu hướng
  tăng dần kiểu rò rỉ bộ nhớ, không gần ngưỡng cạn kiệt — nghi ngờ RAM ở giả
  thuyết "nguyên nhân" phía trên **có thể sai**. Đầu mỗi lần `pnpm e2e` khởi
  động, Next.js tự cảnh báo `⚠ Slow filesystem detected` cho thư mục
  `.next/dev` — nghi vấn mới đáng điều tra tiếp (nếu có lần sau rảnh tay): I/O
  đĩa chậm dần theo cache dev-mode phình to qua hàng chục route compile khác
  nhau trong 1 tiến trình `pnpm dev` sống suốt ~48 phút, hợp lý hơn giả thuyết
  CPU/RAM tích tụ. Không đổi kết luận tổng: vẫn là giới hạn hạ tầng Cloud khi
  chạy dài, không phải regression từ code đang verify.

## 26. Thêm component mới cùng cụm từ với locator `getByText(regex)` đã có → ambiguous

- **Triệu chứng:** thêm `ManualPriceList` (heading "Đang dùng giá nhập tay") lên
  Dashboard — 2 test có sẵn ở `nav-override.spec.ts` (dòng ~96, ~164) đỏ với
  `strict mode violation: getByText(/dùng giá nhập tay/) resolved to 2
elements`. Locator `DashboardPage.manualPriceNote`
  (`e2e/pages/dashboard-page.ts`) vốn chỉ nhắm `priceFreshnessNote` — dòng tóm
  tắt "N mã dùng giá nhập tay · ..." cạnh header NAV (`getPriceFreshnessNote()`,
  `lib/portfolio-valuation.ts`) — viết ra trước khi `ManualPriceList` tồn tại.
- **Nguyên nhân:** `ManualPriceList` (component MỚI, khối liệt kê từng holding
  đang dùng giá tay + CTA "Cập nhật giá") và `priceFreshnessNote` (ghi chú tóm
  tắt CŨ, đã có locator từ trước) là **2 khối UI độc lập, cùng nguồn dữ liệu**
  (`manualPriceHoldings`/`manualCount` cùng đến từ việc đếm `NavOverride`
  thắng) nên **cố ý** dùng chung cụm từ tiếng Việt "dùng giá nhập tay" — không
  phải trùng lặp tình cờ như #21/#22 (2 số/nhãn khác mẫu số vô tình trùng giá
  trị), mà là 2 tính năng khác nhau **thiết kế hợp lý** để cùng nói một khái
  niệm nghiệp vụ. `getByText(/dùng giá nhập tay/)` (regex không có gì phân
  biệt) khớp cả heading (`"Đang dùng giá nhập tay"`, không có số) lẫn ghi chú
  tóm tắt (`"<N> mã dùng giá nhập tay ..."`, luôn có số ngay trước).
- **Cách né:** siết regex bám vào phần **khác biệt ổn định** giữa 2 khối thay
  vì cụm từ chung — ở đây `getPriceFreshnessNote()` LUÔN sinh format
  `${manualCount} mã dùng giá nhập tay` (có số ngay trước "mã"), còn heading
  `ManualPriceList` thì không có số. Sửa thành
  `getByText(/\d+\s*mã dùng giá nhập tay/)` — chỉ khớp ghi chú tóm tắt, hết
  ambiguous. Không đổi hẳn sang 2 locator tách biệt vì 2 test đang có chỉ cần
  đúng ghi chú tóm tắt (không cần assert riêng heading `ManualPriceList`) —
  chỉ thêm locator mới cho heading đó khi có spec thật sự cần verify riêng
  khối này.
- **Bài học chung:** khi thêm 1 component MỚI vào một màn ĐÃ CÓ SPEC, không
  chỉ rà xem UI cũ có bị đổi cơ chế (bài học #16/#18) — còn phải rà xem
  **text/copy** của component mới có trùng cụm từ với locator `getByText`
  hiện có trên CÙNG màn đó không, đặc biệt khi 2 tính năng cố ý dùng chung
  thuật ngữ nghiệp vụ (ở đây: "dùng giá nhập tay" là khái niệm domain, không
  phải tình cờ). `pnpm e2e` full suite là cách phát hiện đáng tin cậy nhất
  (strict mode tự báo lỗi rõ ràng, không flaky) — chạy lại toàn bộ spec chạm
  route bị thêm UI mới trước khi coi feature là xong.
