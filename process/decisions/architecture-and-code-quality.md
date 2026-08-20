# Quyết định — Kiến trúc & chất lượng code

Phạm vi: quy tắc clean code, cấu trúc feature/repository, ranh giới Server/Client Component, enum, cache, PWA, cutoff.
Rules tương ứng: [`docs/coding-rules.md`](../../docs/coding-rules.md) → `docs/rules/*`.

---

## 2026-07-11 — PWA gộp vào Phase 1, phạm vi cố ý tối giản

**Status:** Accepted

**PWA gộp vào Phase 1 — phạm vi cố ý tối giản.**
- Ràng buộc bền: (1) **không cache số liệu tài chính offline** (app tài chính — tránh hiện số sai/cũ khi mất mạng); chỉ installable + cache asset tĩnh. (2) **Chưa làm Web Push/VAPID** — cảnh báo giá vẫn ở Backlog. (3) Service worker **viết tay** (`public/sw.js`), không dùng `next-pwa`/Serwist — tránh rủi ro tương thích Next 16 + Turbopack.
- Docs đã sync: `docs/04-tech-stack.md` (mục "PWA"), `docs/03-roadmap.md` (Phase 1), `process/phase-1.md`.

---

## 2026-07-11 — Đổi rule cache tầng server: "cấm cache cả nắm" → "cache có chọn lọc"

**Status:** Accepted

**Đổi rule cache tầng server: "cấm cache cả nắm" → "cache có chọn lọc".**
- Bối cảnh: rule cũ cấm mọi cache vì số liệu tài chính phải tươi + quy mô nhỏ; bây giờ Phase 2–3 thêm `PriceQuote` + snapshot → đáng cache chọn lọc.
- **Bất biến bảo mật (mọi phase):**
  - Session/quyền **không bao giờ** cache xuyên request (thu hồi tức thời).
  - **Footgun:** cache key cho dữ liệu scoped-user **phải gồm `userId` làm tham số hàm** (không đọc từ `auth()` bên trong cache) — nếu không → mọi user chung 1 entry = rò dữ liệu. Dữ liệu dùng chung (`PriceQuote`) cache key theo `symbol`.
- Phase 2 ứng viên cache: `PriceQuote` (revalidate khớp EOD job). Phase 1 vẫn không cache (quy mô cá nhân nhỏ, không có chậm); điều kiện quay lại Phase 3 (snapshot dày).
- Docs: `docs/rules/performance.md`.

---

## 2026-07-11 — Issue #12: chỉ tách Suspense khi Suspense vật lý tách được từ query

**Status:** Accepted

**Issue #12: Suspense routes — áp rule #2 vs #3: chỉ tách Suspense khi Suspense vật lý tách được từ query.**
- Ví dụ: `holdings/[id]/transactions/{new,edit}` tách (form không cần query). `settings/members/*` giữ async page (query quyết định render).
- Docs: `docs/rules/component-architecture.md`.

---

## 2026-07-11 — Phase 2: BottomNav dùng chung màn gốc

**Status:** Accepted

**Phase 2: BottomNav dùng chung màn gốc (không form/route con) — quyết định cũ "không header chrome riêng" vẫn giữ cho form.**
- **Còn treo:** `NavOverrideForm` chưa có route thật; "Tuỳ chỉnh" (CUSTOM) cutoff chưa mockup.

---

## 2026-07-12 — Cutoff selection: cookie + Route Handler + hard nav

**Status:** Accepted

**Cutoff selection: cookie + Route Handler `/api/cutoff` + `CutoffHardNavGuard` hard nav để kích active state.**
- Lý do: Server Component không `cookies().set()` lúc render.
- **Cảnh báo:** Next.js soft-nav bỏ qua re-render → phải hard nav riêng cho link cutoff, tôn trọng modifier keys (open tab).
- `Setting` không lưu (read-only); "Tuỳ chỉnh" (CUSTOM) chưa mockup.

---

## 2026-07-26 — Bộ quy tắc clean code cho toàn app (10 điểm)

**Status:** Accepted — nền tảng của [`docs/rules/clean-code.md`](../../docs/rules/clean-code.md)

**Chốt bộ quy tắc clean code cho toàn app trước khi refactor ~3.000 dòng tầng action/queries. Phạm vi đợt này: CHỈ tài liệu, không đụng code.**

Bối cảnh: user nêu "actions code dài và khó đọc, các sql không reuse được". Rà bằng số đo thay vì cảm nhận: 9 hàm dài trên 100 dòng, 8 bản sao khối `select` cashflow/cổ tức, 3 cài đặt song song của cùng quy tắc delta, 8 comment kiểu "xem ghi chú tương tự ở X", `features/*/actions.ts` + `queries.ts` có **0 unit test**.

- **(1) Quy tắc số 1 — phân biệt "lặp tri thức" và "lặp hình dạng", đo bằng connascence.** Câu hỏi chuẩn không phải "hai đoạn có giống nhau không" mà "đổi cái này có buộc đổi cái kia không". Có → gộp ngay, không chờ Rule of Three. Không → để yên, áp AHA (*"prefer duplication over the wrong abstraction"* — gỡ abstraction sai đắt hơn xoá code lặp). Cần luật này vì hai áp lực ngược nhau đều có thật ở repo: chuỗi bug issue #59 do **lặp**, còn ép DRY mù quáng thì tạo coupling giả. Thang ưu tiên: mọi mức dynamic > mọi mức static; trong static thì Algorithm > Position > Meaning > Type > Name.
- **(2) Ba ca lặp nặng nhất đã định danh (sửa theo thứ tự này, không theo thứ tự dễ).** (a) **Connascence of Value** — hằng `new Date(8640000000000000)` khai 2 lần, 2 tên (`CANDIDATE_CREATED_AT` ở `holdings/actions.ts`, `PROBE_CREATED_AT` ở `dividends/actions.ts`), ràng nhau bằng comment; mức nguy hiểm nhất mà trông vô hại nhất. (b) **Connascence of Algorithm** — quy tắc delta `BUY +/SELL −/STOCK +` cài 3 lần (`lib/cost-basis.ts`, `dividends/actions.ts`, `dividends/queries.ts`), đúng pattern quyết định 2026-07-24 (4) đã chốt phải gộp nhưng đã mọc lại ở nhánh cổ tức. (c) **Connascence of Meaning** — bất biến issue #59 ("vị thế = Cashflow + cổ tức CP") rải trong 8 khối `select`, giữ bằng comment thay vì bằng type.
- **(3) Thêm tầng `features/*/repository.ts` — nơi DUY NHẤT chạm Prisma, kể cả đường ghi.** Theo khuyến nghị Data Access Layer của Next.js: một tầng server-only tự làm authorization, để check `userId` tồn tại **một** chỗ thay vì lặp tay ở 5 action với 5 câu chữ khác nhau. Ba vai tách bạch `Row → Domain → DTO`: `repository.ts` (Prisma, `Decimal`) → `lib/*.ts` (thuần) → `queries.ts` (format, `string`). **Ranh giới transaction: truyền `tx: Prisma.TransactionClient` tường minh qua tham số**, không dùng AsyncLocalStorage/CLS (ẩn control flow) và không bọc Unit of Work (`db.$transaction` đã là). Repository **không tự mở** transaction — caller mở, nếu không hai lời gọi repository không nằm chung transaction được. ⚠️ Chưa verify được `db` có gán được vào chỗ nhận `Prisma.TransactionClient` không (container nghiên cứu không có `node_modules`) — chạy `pnpm typecheck` xác nhận trước khi dựa vào default param.
- **(4) Kích thước hàm: KHÔNG đặt giới hạn số dòng.** Luật "hàm phải ngắn" của *Clean Code* không có cơ sở thực nghiệm; thứ có kiểm chứng là **Cognitive Complexity**, và nó phạt **lồng nhau**, không phạt độ dài. Đo tách hai loại thì thấy rõ: `getHoldingDetail` 198 dòng nhưng **1 cấp rẽ nhánh** (dài-tuyến-tính, để yên); `updateTransaction` lồng 9 cấp nhưng chỉ 2 cấp rẽ nhánh — phần còn lại là cây `select` (tự khỏi khi trích select shape); chỉ `recordDividend` phức tạp thật (415 dòng, 5 cấp rẽ nhánh, 3 trách nhiệm) → ưu tiên tách cao nhất. Tiêu chí tách: **>1 trách nhiệm** hoặc **lồng rẽ nhánh ≥ 4**. Lint dùng `sonarjs/cognitive-complexity` + `max-depth`, **không** dùng `max-lines-per-function` (bắt oan hàm dài-tuyến-tính, bỏ lọt hàm ngắn-rối).
- **(5) Comment: phân 3 loại, chỉ 1 loại là mùi.** Giữ và viết thêm loại "giải thích vì sao" (lịch sử bug, lý do nghiệp vụ — `cost-basis.ts` là mẫu tốt). Loại phải diệt: **comment trỏ sang chỗ khác** (*"xem ghi chú ở X"*, *"khớp với Y"*, *"cùng pattern Z"*) — đó không phải tài liệu mà là cơ chế thực thi thủ công cho một Connascence of Meaning; đếm số comment loại này = đếm số chỗ chờ lệch. Repo hiện có 8.
- **(6) Backfill dữ liệu dẫn xuất viết bằng TypeScript, cấm công thức nghiệp vụ trong SQL migration.** Ca thật: `20260711092933_backfill_holding_position/migration.sql` tự khai là *"a hand-written SQL REPLICA of derivePosition()"* kèm dặn *"if that logic changes, add a NEW migration"*; sau đó `derivePosition()` **đã đổi** (issue #59) và không có migration mới nào. Hậu quả lần này bằng 0 nhờ may mắn về thứ tự thời gian (backfill chạy trước khi tính năng cổ tức tồn tại), nhưng **cơ chế đã thất bại** — quy tắc ép bằng comment trong file bất biến thì không ai theo. Đây là Connascence of Algorithm xuyên ngôn ngữ, compiler không với tới, và công cụ drift detection hiện có chỉ dò lệch **schema** chứ không dò lệch **logic** → cách duy nhất là không tạo ra. Lý do chính đáng duy nhất để viết SQL thuần (hiệu năng bảng cực lớn) không tồn tại ở quy mô Navtrack. Migration cũ giữ nguyên (bất biến); luật áp cho migration mới.
- **(7) Test: rút phần thuần ra khỏi vỏ, KHÔNG mock Prisma.** `features/*/actions.ts` + `queries.ts` hiện 0 test, chỉ được phủ bởi e2e — mà e2e cần Docker nên không chạy được trên Claude Cloud (`TOOLS.md`), tức nửa số phiên làm việc không có lưới an toàn. Mock DB bắt lỗi gõ sai nhưng bỏ lọt vi phạm constraint/quan hệ sai và tạo test xanh giả → không dùng. Thay vào đó rút phần thuần (vd ~80 dòng cuối `recordDividend` dựng `DividendFormState`) ra hàm thuần có `.test.ts`, để vỏ mỏng tới mức không còn gì đáng test. *(Lỗ hổng quy trình của điểm này được đóng ở [`agent-workflow-and-tooling.md`](./agent-workflow-and-tooling.md) mục 2026-08-12.)*
- **(8) Component: ranh giới client đang ĐÚNG, ghi thành luật để không xói mòn.** Đo: 34/128 component có `"use client"`, và các `*Screen` (`DashboardScreen` 291 dòng, `HoldingDetailScreen` 227, `SnapshotDetailScreen` 238) đều là Server Component — chỉ form/chart/sheet là client. Bổ sung luật: **cấm `"use client"` ở `*Screen`/`*Section`/`layout.tsx`** (đánh dấu một component là client thì mọi component nó import cũng thành client).
- **(9) Component: props nổ → dùng children/slot.** `DashboardScreenProps` = **25 props** (5/75 Props type có ≥10). Nguyên nhân: Props phản chiếu shape `PortfolioValuation` và `page.tsx` spread thẳng vào — thêm một chỉ số phải sửa 3 chỗ. Luật: **biến thiên ở dữ liệu → props; biến thiên ở cấu trúc → children/slot**. Container là Server Component nên truyền JSX xuống không tốn gì.
- **(10) Component: thêm tiêu chí tách theo ranh giới stream.** Trong RSC, đơn vị tách không chỉ là "tái dùng được" mà còn là ranh giới `<Suspense>` và ranh giới cache/revalidate — một vùng UI có nguồn dữ liệu riêng và tốc độ riêng **phải** là component riêng, kể cả khi chỉ dùng một lần. Atomic Design không có khái niệm này; khi hai tiêu chí xung đột, ranh giới stream thắng.
- Docs đã sync: `docs/rules/clean-code.md` (**mới**), `docs/rules/data-prisma.md` (tầng `repository.ts` + ranh giới transaction), `docs/rules/schema.md` (backfill), `docs/rules/testing.md` (core/shell), `docs/rules/component-architecture.md` (cấm client ở Screen/Section, slot, ranh giới stream), `docs/rules/project-structure.md` (ba vai trong feature), `docs/coding-rules.md` (index).

---

## 2026-07-28 — Tách variant component thay vì switch lặp lại theo enum

**Status:** Accepted

**Tách variant component thay vì switch lặp lại theo enum — rule mới, phát hiện qua code review PR #102.**

Bối cảnh: review PR #102 (issue #100, dọn nợ enum) phát hiện `DividendForm.tsx` phình tới 884 dòng với **9 chỗ** `switch(type)`/IIFE cho cùng một biến `type: DividendType`, mỗi chỗ đều có nhánh chết `case "BOND_COUPON": return null` (giá trị UI chưa cho chọn — `SegmentedControl` chỉ có CASH/STOCK). Nguyên nhân gốc: rule "switch exhaustive cho mọi điểm rẽ nhánh enum" (`typescript-style.md` mục "Enum", chốt 2026-07-25 (2) điểm (8)) áp đúng ở **từng điểm rẽ nhánh** nhưng không có giới hạn cho việc **cùng một biến bị rẽ nhánh nhiều lần trong cùng một component** — khoảng trống đó là thứ thực sự gây phình file, không phải bản thân việc dùng `switch`.

- **Rule mới:** khi cùng một biến enum bị `switch`/ternary/IIFE để chọn JSX khác nhau ở **≥ 3 chỗ** trong một component, dừng thêm switch tại chỗ — tách theo **variant component** (1 component/giá trị enum, vd `CashDividendFields`/`StockDividendFields`), container rẽ nhánh **đúng một lần** để chọn component nào render. Phần dùng chung giữa các biến thể (không phụ thuộc enum) tách thành atom/molecule nhỏ nhận props thuần, để cả hai variant cùng gọi thay vì nhân đôi JSX.
- **Khác với rule "props nổ → children/slot" (2026-07-26 (9)):** rule đó xử lý nhiều **vùng UI độc lập** trong một layout (Dashboard 8 vùng, mỗi vùng chỉ hiện 1 lần). Rule mới này xử lý một **enum lặp lại xuyên suốt nhiều vùng không liền kề** — khác cơ chế nên không dùng chung giải pháp `children`.
- **Kế hoạch chia cụ thể cho `DividendForm.tsx`** (áp dụng ngay sau khi rule được ghi): atom dùng chung `PreviewBreakdownCard` (card header+2 hàng+footer highlight — CASH và STOCK **cùng shape**, chỉ khác data, không cần switch), `PreviewFormulaRow` (icon Sigma + children là câu chữ, khác cấu trúc câu theo type nên dùng children chứ không phải data), `InfoNote` (icon+tone+children), `PaymentDateField` (DatePicker dùng chung + children là ghi chú khác nhau theo type). Hai variant `CashDividendFields`/`StockDividendFields` tự tính preview (`pricePerShare`/`grossAmount`/`taxAmount`/`netAmount` cho CASH, `stockDividend`/`addedQuantity`/`afterQuantity` cho STOCK) và lắp các atom trên. `DividendForm` chỉ giữ phần thật sự chung (PageHeader, HoldingSwitcher, SegmentedControl, checkbox điều chỉnh giá, nút submit, wiring `useActionState`).
- **Điểm không tách trọn vẹn được, chấp nhận có chủ đích:** nút Submit (dùng chung) cần biết `overrideInvalid` — giá trị chỉ STOCK tính được (so lệch tolerance số làm tròn) — nên `StockDividendFields` phải báo ngược lên `DividendForm` qua callback (`onValidityChange`), không cô lập 100% xuống variant component được. `percentDecimal` (dùng cho điều kiện disable chung) không phụ thuộc `type` nên tính ở `DividendForm`, không cần báo ngược.
- **Không tách `BondCouponDividendFields` ngay bây giờ** — issue #101 chưa triển khai UI trái tức (`SegmentedControl` chưa có option này), tạo component rỗng lúc này chỉ chuyển dead code từ switch sang file riêng, không giải quyết gì. Thêm khi #101 thật sự làm UI.
- Docs đã sync: `docs/rules/typescript-style.md` (mục "Enum" — thêm giới hạn), `docs/rules/component-architecture.md` (mục mới "Biến thiên theo enum nghiệp vụ lặp lại → tách variant component").

---

## 2026-08-20 — Fan-in navigation: `backHref`/`closeHref` theo `?from=<path>` chung, không hardcode tĩnh

**Status:** Accepted

**`backHref`/`closeHref` của `PageHeader` không còn được hardcode tĩnh khi route có ≥2 lối vào — dùng `?from=<path thật đã encode>` + `withFrom()`/`resolveBackHref()` (`src/lib/routes.ts`) để chọn đúng đích theo nơi user vừa tới. MỘT cơ chế duy nhất cho mọi case, không tách "nguồn tĩnh" vs "nguồn động".**
- Bối cảnh: audit toàn bộ `ROUTES.*` phát hiện 7 case sai đích — `/settings`, `/holdings/[id]/transactions/new`, `/holdings/[id]/price` (2 nguồn: Dashboard + `/allocation/stock`), `/allocation`, `/holdings/new`, `/snapshots`.
- Phương án đã cân nhắc: `router.back()` (loại — phụ thuộc lịch sử trình duyệt, sai khi mở thẳng link, buộc `PageHeader` thành Client Component); đổi entry point để hết fan-in (loại — phá tái sử dụng form/route); query param `?from=` + validate whitelist ở page đích (bản đầu — chọn, nhưng union `EntrySource` hữu hạn ép hardcode string literal lặp lại ở nhiều entry point, bị review phản đối); query param `?from=<path thật>` không whitelist (bản cuối — chọn).
- **Vòng đầu** dùng `EntrySource` (union `"dashboard" | "allocation-stock"`) + `withEntrySource()`/`resolveBackHref(from, sourceMap, fallback)` — bị review chỉ ra hardcode string literal (`"dashboard"`) lặp lại ở 5 entry point là code smell (đổi tên route phải sửa nhiều nơi, không có single source of truth). **Đã thay bằng** `withFrom(href, fromPath)`/`resolveBackHref(from, fallback)`: `fromPath` LUÔN là 1 giá trị `ROUTES.*` thật (không phải tên gợi nhớ tự bịa), `resolveBackHref` validate "có phải internal path an toàn" rồi dùng THẲNG làm backHref — không cần liệt kê whitelist tên cố định nữa.
- **Lỗ hổng open-redirect phát hiện lúc verify, đã vá:** bản đầu của `isSafeInternalPath()` so tiền tố chuỗi tay (`startsWith("/") && !startsWith("//") && !includes("://")`) — lọt biến thể `"/\\evil.com"` (1 dấu `/` rồi backslash). Theo WHATWG URL spec, trình duyệt coi backslash tương đương forward-slash ngay sau ký tự đầu với scheme "special" (http/https), nên giá trị này bị chuẩn hoá thành `"//evil.com"` (protocol-relative ra ngoài) dù không khớp bất kỳ điều kiện chặn nào — verify bằng `new URL("/\\evil.com", "https://x") → "https://evil.com/"`. **Sửa bằng cách để `URL` tự chuẩn hoá rồi so `origin`** thay vì tự đoán mọi biến thể chuỗi nguy hiểm: `new URL(value, SAFE_PATH_CHECK_BASE).origin === SAFE_PATH_CHECK_BASE`. Bài học: validate "an toàn nội bộ" cho 1 giá trị sẽ dùng làm URL phải để chính URL parser chuẩn hoá rồi so sánh kết quả (origin/host), không tự liệt kê tiền tố nguy hiểm đã biết — luôn có biến thể chưa nghĩ tới.
- **Phát hiện quan trọng khi gộp lại:** case 6 (`/snapshots`, nguồn `holdingId` ĐỘNG) tưởng là ngoại lệ bắt buộc verify ownership qua DB (`isOwnHolding()`) trước khi tin `holdingId` từ query — nhưng đọc lại `getHoldingDetail()` (`src/features/holdings/queries/holding-detail.ts`) xác nhận trang đích `/holdings/[id]` **đã tự** filter theo `session.user.id` và `notFound()` nếu không thuộc user. `backHref` chỉ là URL để `Link` trỏ tới, không phải cổng cấp quyền — verify DB ở tầng điều hướng là dư thừa, trang đích đã tự chặn. Vì vậy case 6 dùng CHUNG cơ chế `from=<path>` như 5 case còn lại, không cần machinery riêng (`isOwnHolding()`/`findHoldingOwnerId()` cho mục đích này đã xoá — `findHoldingOwnerId()` vẫn giữ, dùng cho `isHoldingOwnedByUser()`/`saveNavOverride`, không liên quan).
- Docs đã sync: `docs/rules/component-architecture.md` (mục "Route đa lối-vào (fan-in)").

---

## Quyết định liên quan ở file khác

- **Rule enum gốc** (nguồn sự thật ở `schema.prisma`, `src/lib/enums.ts`, `switch` exhaustive + `assertNever`) — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-25 (2) điểm (8).
- Enum của *form* vs enum của *DB* phải tách khi có giá trị chỉ-hệ-thống-sinh — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-29 điểm (2).
- "Prefill sửa được" → `.optional()` chứ không `.default()`; bất biến "type X ⇒ field Y" biểu diễn bằng union — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-29 điểm (3) và (5).
- Materialized cache + bài học "rà mọi nơi derive lại" — [`transactions-and-cost-basis.md`](./transactions-and-cost-basis.md).
- Quy ước viết e2e (Page Object Model) — [`agent-workflow-and-tooling.md`](./agent-workflow-and-tooling.md).
