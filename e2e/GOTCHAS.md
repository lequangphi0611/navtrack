# GOTCHAS — bẫy e2e đã gặp

Nhật ký các bẫy **thật** khi viết/chạy e2e Navtrack, để không dẫm lại. Mỗi mục:
**triệu chứng → nguyên nhân → cách né**. Gặp bẫy mới → **thêm một mục ở đây trong cùng lần
commit** (kèm trỏ file/spec gốc). Cách viết e2e chung ở
[`../docs/rules/e2e-page-object.md`](../docs/rules/e2e-page-object.md).

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
  - `selectDateOnCalendar(page, targetDate)` — chọn qua **UI thật** (mở popover, chuyển
    tháng, bấm ô ngày). **Bắt buộc** dùng bản này khi form cha phản ứng theo state `date`
    (vd `TransactionForm` tính lại thuế/phí, hoặc chỉ hiện `SellRecomputeCompareCard` khi
    state date đổi) — `fillDatePicker` không trigger re-render nên nhánh phụ thuộc `date`
    không thấy giá trị mới.

## 3. `isoDate` (UTC) lệch 1 ngày so với ô lịch ở timezone dương

- **Triệu chứng:** `[data-day="<iso>"]` không tìm thấy / bấm nhầm ngày, chỉ xảy ra khi chạy
  gần đầu ngày local (UTC+7).
- **Nguyên nhân:** `isoDate()` qua `toISOString()` (UTC); "nửa đêm local" convert sang UTC
  lùi về hôm trước. Còn `react-day-picker` gắn `data-day` theo field **local** của `Date`.
- **Cách né:** khớp ô lịch trên UI phải dùng `localIsoDate()` (`support/dates.ts`) — tính
  theo `getFullYear/getMonth/getDate`. `isoDate()` chỉ dùng cho string gửi server (buffer
  nhiều ngày giữa các mốc đủ hấp thụ lệch giờ). Ngày tương đối luôn qua `daysAgo()`, **không
  hardcode năm**.

## 4. Nút chuyển tháng DayPicker bị caption đè → `.click()` trúng nhầm

- **Triệu chứng:** bấm "Next/Previous Month" không đổi tháng, hoặc flaky ngay sau khi mở
  popover.
- **Nguyên nhân:** `month_caption` (relative) đè lên vùng `nav` (absolute) của DayPicker;
  click theo toạ độ (kể cả `force: true`) có thể trúng caption, nhất là lúc animation
  zoom-in chưa ổn định toạ độ.
- **Cách né:** `navButton.dispatchEvent("click")` — bắn event thẳng vào element handle,
  không phụ thuộc toạ độ/animation (đã làm trong `support/date-picker.ts`).

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
- **Nguyên nhân:** `scripts/e2e.mjs` chỉ `migrate deploy`, **không** seed; nhiều worker chạy
  song song cùng upsert một Setting → race.
- **Cách né:** upsert nuốt `P2002` coi như "worker khác seed xong rồi" (xem
  `upsertSettingIgnoringRace` trong `dividends.spec.ts`).

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

## 15. Thiếu `Setting` toàn cục mới thêm → lỗi render "thoáng qua" ở NHIỀU spec không liên quan, dễ tưởng nhầm là flake

- **Triệu chứng:** merge phase-6 (Concentration warning) vào — 3 test ở `holdings.spec.ts`/
  `dividends.spec.ts` fail cứng (không phải flaky, fail y hệt mọi lần) với
  `SETTING_NOT_FOUND: "CONCENTRATION_WARNING_THRESHOLD"`; nhiều spec KHÁC cũng gọi cùng
  component (`HoldingsPositionsSection`) và cũng log lỗi này ở webServer nhưng lại **pass** —
  dễ tưởng đây là nhiễu môi trường thay vì bug thật.
- **Nguyên nhân:** `getConcentrationBadges()` (`lib/portfolio-valuation.ts`) đọc `Setting`
  toàn cục `CONCENTRATION_WARNING_THRESHOLD` mỗi lần render section danh sách vị thế — tức
  GẦN NHƯ MỌI spec chạm `/holdings`, không riêng feature vừa thêm. `scripts/e2e.mjs` khi đó
  chỉ `prisma migrate deploy`, không chạy seed nào nên `Setting` này (và các key tương tự như
  `DIVIDEND_TAX_RATE`, trước đó phải tự seed rải rác ở `dividends.spec.ts`/
  `tax-and-fee.spec.ts`) không tự có trên DB e2e. Lỗi throw ở một Suspense boundary con nên
  KHÔNG sập cả trang — chỉ test nào có assertion chạm đúng khu vực/thời điểm đó mới lộ fail,
  phần lớn test khác "tình cờ" qua dù webServer vẫn log lỗi.
- **Cách né (giải pháp cuối, sau khi cân nhắc cả seed riêng theo spec):** `scripts/e2e.mjs`
  giờ chạy `pnpm exec prisma db seed` (dùng CHUNG `prisma/seed.ts` với DB dev) ngay sau
  `migrate deploy` — mọi `Setting` toàn cục có sẵn từ đầu, không cần đoán key nào "đủ rộng"
  để đáng seed tập trung. `.env.test` cần thêm `SEED_ADMIN_EMAIL` (giả, `seed.ts` throw nếu
  thiếu). Spec **chỉ còn seed thêm giá trị RIÊNG cho kịch bản đang test** mà `db:seed` không
  biết — vd `tax-and-fee.spec.ts` seed thêm 1 mốc `effectiveFrom` thứ hai (thuế suất mới) để
  test "đổi thuế áp đúng theo ngày", KHÔNG seed lại giá trị baseline nữa (đã trùng `db:seed`,
  dễ lệch âm thầm nếu sau này 2 nơi update khác nhau — xoá hẳn phần trùng thay vì giữ "cho
  chắc"). **Thêm `Setting` mới mà code đọc nó ở path chạy qua nhiều/mọi spec** → thêm vào
  `prisma/seed.ts`, không tự seed rải rác trong spec hay `test-session.ts`.

## 16. UI redesign đổi dòng danh sách từ `<Link>` sang `<button>` mở Sheet → spec cũ dùng `getByRole("link")` fail

- **Triệu chứng:** merge phase-6 vào — `holdings.spec.ts` fail ở bước "mở lại chi tiết vị thế
  đã đóng": `getByRole('link', { name: /VNM/ })` không tìm thấy dù dòng vị thế hiện rõ trên
  UI (thấy trong page snapshot lúc fail).
- **Nguyên nhân:** phase-6 vẽ lại tab "Đã đóng" (`ClosedHoldingRow`) thành `<button>` mở
  `ClosedPositionSheet` (client state, mockup 6i) thay vì `<Link>` điều hướng thẳng
  `/holdings/[id]` như trước — spec viết TRƯỚC phase-6 giả định sai role.
- **Cách né:** `HoldingsPage.closedHoldingButton(symbol)` (role `"button"`, riêng cho tab "Đã
  đóng") thay vì `holdingLink()` (chỉ đúng cho tab "Đang mở").
- **Cập nhật (code review PR #81):** bản đầu của phase-6 khiến `ClosedPositionSheet` chỉ có
  action "Mở lại vị thế" (tạo giao dịch mua mới), **mất hẳn** đường quay lại trang chi tiết
  đầy đủ (lịch sử giao dịch, nút xóa) — người dùng ghi nhầm giao dịch khiến vị thế đóng thì
  không còn cách sửa/xóa qua UI. Đã thêm lại link "Sửa / xoá giao dịch đã ghi"
  (`ROUTES.holdingDetail`) trong sheet. Dùng `HoldingsPage.openClosedHolding(symbol,
holdingUrl)` (bấm dòng vị thế mở sheet → bấm link → pin đúng URL, cùng tinh thần
  `openHolding()`) thay vì `detail.goto()` trực tiếp — bài học: một fix quay lại UI phải đi
  kèm spec exercise LẠI qua UI đó, không chỉ né bằng điều hướng thẳng URL.
- **Bài học chung:** một UI redesign đổi loại phần tử tương tác (Link ↔ button/Sheet) cho MÀN
  ĐÃ CÓ SPEC TỪ TRƯỚC vẫn có thể lọt qua review nếu spec cũ không được chạy lại — luôn `pnpm
e2e` toàn bộ spec chạm route bị đổi UI trước khi merge, không chỉ spec của feature mới.

## 17. `BondTermsForm` đọc thẳng React state khi submit, KHÔNG qua `FormData` — `fillDatePicker()` vô tác dụng ở form này

- **Triệu chứng:** set `firstCouponDate`/`maturityDate` qua `fillDatePicker()` (ghi thẳng DOM
  của `<input type="hidden">`) rồi submit `BondTermsForm` — giá trị lưu xuống DB vẫn rỗng, dù
  `pnpm typecheck`/UI lúc thao tác tay trông bình thường.
- **Nguyên nhân:** `submitTerms()` (`BondTermsForm.tsx`, comment ngay trong code: "Đọc thẳng
  từ state (không qua FormData): mọi field ở đây đều controlled, và SegmentedControl/Select
  không phải input thật nên FormData sẽ thiếu `issuerType`") gọi `saveBondTerms()` bằng các
  biến state (`parValue`, `firstCouponDate`...), không đọc `formData.get(...)` — khác MỌI form
  ghi khác của repo (`DividendForm`, `TransactionForm`, `MaturitySettlementForm` đều đọc qua
  `FormData`). `fillDatePicker()` chỉ ghi DOM value của input ẩn, KHÔNG gọi `onChange` nên
  không cập nhật state — form đọc state cũ (rỗng) khi submit.
- **Cách né:** field `Input`/`Select` thường của `BondTermsForm` (`parValue`,
  `couponRatePercent`, `couponFrequencyMonths`) vẫn dùng `.fill()`/`.selectOption()` bình
  thường (dispatch event thật → cập nhật state đúng). Riêng 2 field DatePicker
  (`firstCouponDate`, `maturityDate`) BẮT BUỘC dùng `selectDateOnCalendar()` (kích hoạt
  `onChange` thật qua UI), không dùng `fillDatePicker()`. `e2e/pages/bond-terms-form.ts` hiện
  chưa có setter cho 2 field ngày này (2 kịch bản Phase 7 không cần, bỏ trống vẫn hợp lệ —
  trái phiếu chiết khấu) — thêm setter dùng `selectDateOnCalendar` khi có spec thật sự cần.
