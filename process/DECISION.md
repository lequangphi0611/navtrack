# DECISION — quyết định quan trọng ảnh hưởng docs/domain/rules

File này ghi các **quyết định quan trọng** làm thay đổi business/domain/spec/data model/rules, hoặc root-cause một lỗi non-obvious mà bản thân code không giải thích được lý do. **Không ghi tiến độ thường ở đây** — tiến độ (đã làm gì, còn gì) thuộc về [`PROCESS.md`](./PROCESS.md). Mỗi mục gồm: quyết định, lý do, và docs đã đồng bộ theo.

**Đọc file này trước khi bắt đầu một phase mới** (cùng lúc đọc `PROCESS.md` + `phase-x.md`) để nắm bối cảnh các quyết định trước đó — tránh làm trái hoặc lặp lại tranh luận đã chốt.

> Chỉ giữ các quyết định **còn hiệu lực / còn ràng buộc việc sau**. Quyết định đã đóng mà code hoặc `docs/rules/*` đã tự giải thích (vd bug login một lần, quy ước `ROUTES`/`SETTING_KEYS`) được lược bỏ khỏi đây — lịch sử đầy đủ nằm trong git.

## 2026-07-10

**Phân quyền màn Thành viên: user không có quyền mời không được lộ quota/danh sách allowlist.**
- Bất biến (bảo mật): non-inviter chỉ thấy `MembersDeniedScreen` (1 dòng từ chối), **không** lộ tổng số thành viên / danh sách allowlist / section mời; trang `/settings/members/invite` guard `canInvite` **phía server**, không chỉ ẩn UI.
- Cấu trúc: `/settings` (menu) ↔ `/settings/members` (danh sách) ↔ `/settings/members/invite` (form) tách 3 route (layout cũ gộp 1 màn quá dài).
- Docs đã sync: `docs/rules/ui-ux-design.md` (molecule `SettingsMenuItem`).

## 2026-07-11

**Nghi vấn regression session — không phải bug thật, không đi lại hướng Edge runtime.**
- Triệu chứng thoáng qua: redirect `/sign-in` dù session hợp lệ. Kết luận: **không tái hiện**, lỗi môi trường nhất thời; không sửa code. Ghi lại để **tránh tranh luận lại** khi tăng cường bảo mật middleware ở phase sau.

**PWA gộp vào Phase 1 — phạm vi cố ý tối giản.**
- Ràng buộc bền: (1) **không cache số liệu tài chính offline** (app tài chính — tránh hiện số sai/cũ khi mất mạng); chỉ installable + cache asset tĩnh. (2) **Chưa làm Web Push/VAPID** — cảnh báo giá vẫn ở Backlog. (3) Service worker **viết tay** (`public/sw.js`), không dùng `next-pwa`/Serwist — tránh rủi ro tương thích Next 16 + Turbopack.
- Docs đã sync: `docs/04-tech-stack.md` (mục "PWA"), `docs/03-roadmap.md` (Phase 1), `process/phase-1.md`.

**Đổi rule cache tầng server: "cấm cache cả nắm" → "cache có chọn lọc theo loại dữ liệu".**
- Bối cảnh: rule cũ (`performance.md`) cấm mọi cache tầng server vì (a) số liệu tài chính phải luôn tươi (nguyên tắc domain — giữ) + (b) "quy mô nhỏ, complexity chưa đáng" (điều kiện hoá theo quy mô — hết đúng khi Phase 2–3 thêm `PriceQuote` đọc nhiều + snapshot đọc dày).
- Bất biến (mọi phase):
  - Session/quyền **không bao giờ** cache xuyên request — thu hồi tức thời; `getSession=cache(auth)` chỉ dedupe trong 1 render.
  - **Footgun bảo mật:** cache key cho dữ liệu scoped-user **phải gồm `userId`**. `unstable_cache` chỉ đưa **tham số hàm** vào key — đọc `userId` từ `auth()` bên trong hàm cache → mọi user chung 1 entry = **rò dữ liệu**. Dữ liệu dùng chung (`PriceQuote`) key theo `symbol`.
- Ứng viên cache (Phase 2–3): `PriceQuote` (revalidate khớp cadence job EOD); snapshot đã `frozen` (bất biến). Overview **đã materialize** (đọc thẳng `Holding.quantity/avgCost`) → không cần cache lớp holdings/cashflow cho overview.
- Phase 1 vẫn **không cache**. Docs đã sync: `docs/rules/performance.md` (mục "Data fetching"), `process/phase-2.md`, `docs/03-roadmap.md` (Phase 2).

**Materialize `Holding.quantity`/`avgCost` — issue #18 (giảm payload overview từ O(cashflow dồn) xuống O(number)).**
- Quyết định: thêm 2 cột cache `quantity`, `avgCost` lên schema `Holding`. Overview đọc thuần 2 cột, không kéo `Cashflow`. **Bất biến bảo mật:** cache là bản chiếu, **nguồn sự thật `Cashflow`**; ghi bằng `derivePosition()` **cùng transaction** mọi mutation cashflow ⚠️ **Cổ tức Phase 4 cũng đổi `quantity`** → phải cập nhật cache theo bất biến này.
- Backfill: data migration đã áp local; prod tự áp lúc deploy.
- Route (issue #18): tách `/holdings` ↔ `/holdings/closed` qua route group `(overview)`, Suspense per-route; xóa `HoldingsTabs`.
- Docs: `prisma/schema.prisma`, `docs/02-data-model.md`, `docs/rules/data-prisma.md` (mục "Materialized cache"), `docs/rules/component-architecture.md` (route group).

**Issue #12: Suspense routes — chỉ 2/6 route cần tách Suspense (2 route transactions), không phải 4.**
- Quy tắc rule #2 vs #3: chỉ có 2 route `holdings/[id]/transactions/{new,edit}` có header tĩnh + prefetch boundary tổ tiên → tách `TransactionForm` async + Suspense, xoá `loading.tsx` riêng. **Khác hẳn** `settings/members/*` (query quyết định toàn bộ nhánh render → rule #3, giữ async page + `loading.tsx` riêng; tách Suspense sai vì fallback skeleton gợi ý sai).
- Trade-off: status 200 thay 404 cho cashflow invalid (chấp nhận vì app private/auth-gated).
- Docs: `docs/rules/component-architecture.md` (rule #2 vs #3 rõ ràng).

**Phase 2: thêm `BottomNav` dùng chung cho màn gốc/tab — ghi đè phạm vi hẹp quyết định "không có header chrome riêng" (issue #12, mục trên).**
- Bối cảnh: mockup Phase 2 (`Phase 2 Screens.dc.html`, 2a/2b) giới thiệu thanh bottom nav (Tổng quan / Danh mục / Cài đặt) — Phase 1 cố ý không có, điều hướng nằm trong từng màn (xem quyết định issue #12 ở trên). Đây là thay đổi kiến trúc điều hướng, áp dụng **ngược lại** cho cả màn gốc Phase 1 để nhất quán.
- Quyết định: **ghi đè có phạm vi hẹp hơn** — quyết định cũ "không có header chrome riêng" vẫn đúng cho **màn con/form** (nhập vị thế, giao dịch, chi tiết vị thế, nhập giá tay, mời thành viên, đăng nhập): giữ nguyên header back/close, không có BottomNav. **Màn gốc/tab** nay có BottomNav: `/` (Dashboard), `/holdings` + `/holdings/closed` (kể cả nhánh rỗng `HoldingsEmptyState`, vì layout thay thế hoàn toàn `HoldingsOverviewScreen` khi chưa có vị thế nào — vẫn cùng route), `/settings`.
- Wiring đúng 4 chỗ: `HoldingsOverviewScreen`, `HoldingsEmptyState`, `DashboardScreen` (mới), `SettingsScreen` (mới, tách từ `settings/page.tsx` inline JSX cũ).
- Docs đã sync: `process/UI_phase_2.md` (mới — Props-contract chi tiết từng component Phase 2 UI, deliverable của `design-implementer`), `process/phase-2.md` (trỏ tới `UI_phase_2.md`).
- Còn treo (business-implementer xác nhận khi wiring dữ liệu thật, xem `UI_phase_2.md`): nơi lưu lựa chọn mốc chốt định giá (`Setting` không lưu theo `docs/domain/09-settings.md` — query param/cookie/field `User` mới TBD); route thật cho `NavOverrideForm` (hiện chưa có, CTA tạm trỏ `ROUTES.holdingDetail`).

## 2026-07-12

**Đơn vị giá: VCI ×1000 (nghìn VND), fmarket không nhân (VND thô).**
- VCI (`vnstock.Quote`, cổ phiếu/ETF) trả gía nghìn đồng → áp `PRICE_SCALE = 1000`. fmarket (quỹ mở) trả NAV đã là VND thô → không nhân. **Tránh sai 1000 lần** XIRR nếu quên quy đổi.
- Docs: `docs/domain/04-pricing-and-valuation.md` (mục "Quy tắc").

**Cache `PriceQuote` theo TỪNG `symbol` (không theo tập mảng symbol).**
- Quy tắc: cache entry phải dùng chung giữa nhiều user/holding cùng mã → cache lúc lạnh bắn N query parallel. Đổi lại cache-hit chéo đúng.
- Chấp nhận: traffic thấp (app cá nhân).
- Docs: `docs/rules/performance.md` (rule đã mô tả "cache theo symbol").

**FUND fallback fmarket khi VCI fail (quỹ mở không niêm yết).**
- Quyết định: VCI fail + `type=FUND` → fallback fmarket. **STOCK không fallback** (luôn niêm yết, VCI fail = fail hẳn; fallback fmarket tránh nhầm ticker quỹ ≠ cổ phiếu).
- fmarket giới hạn: chỉ quỹ phân phối qua Fmarket, không phủ toàn bộ quỹ mở VN.
- Docs: `docs/domain/04-pricing-and-valuation.md`, `jobs/price-fetcher/README.md`.

**`NavOverride`: `@@unique([holdingId, date])` + `@db.Date` (không @db.DateTime).**
- Upsert theo (holdingId, date) → sửa giá cùng ngày phải ghi đè. Dùng `@db.Date` tránh nhầm lẫn millisecond/giờ khác ngày nhưng cùng ngày hôm đó.
- Docs: `docs/02-data-model.md`.

**Wire mốc chốt thật (đóng tiêu chí phase-2 "Đổi mốc chốt → XIRR tính lại đúng theo NAV mốc đó"): cookie + Route Handler trung gian, không dùng `searchParams`.**
- Lý do kỹ thuật: lựa chọn mốc chốt phải lan từ `/settings` (nơi chọn) sang `/` (Dashboard, route khác hẳn), nhưng Server Component (`page.tsx`) không được phép gọi `cookies().set()` lúc render — nên không thể "đọc `searchParams` rồi tự ghi nhớ" ngay trong `page.tsx`. Giải pháp: `CutoffPicker`'s `href` trỏ `GET /api/cutoff?key=...` (`src/app/api/cutoff/route.ts`) — route handler set cookie `cutoff` (`src/lib/cutoff-cookie.ts`, tách khỏi `lib/cutoff.ts` vì đọc cookie là I/O, `lib/cutoff.ts` tự khai pure) rồi `NextResponse.redirect` cứng về `ROUTES.settings` (không nhận `redirectTo` từ query — tránh open-redirect). Mọi Server Component sau đó đọc cookie qua `getCutoffSelection()`, không phải `searchParams`.
- `Setting` **không** dùng cho việc này (app read-only với bảng đó — `docs/domain/09-settings.md`); không thêm field `User` mới.
- **Cố ý chưa wiring mốc "Tuỳ chỉnh…" (`CUSTOM`)** — chưa có mockup/route cho màn nhập ngày tuỳ ý; `customHref` tạm trỏ `ROUTES.settings`, để task riêng sau.
- **Giới hạn phát hiện qua verify thủ công (Playwright, cả headless lẫn headed) — quan trọng, đọc trước khi đụng lại `/api/cutoff`:** `next/link` (dùng trong `CutoffPicker`) soft-navigate qua fetch RSC; vì Route Handler redirect NGƯỢC LẠI đúng URL đang đứng (`/settings` → `/settings`), Next.js App Router (phiên bản dự án đang dùng) coi đây là "cùng segment, không đổi gì" và **bỏ qua re-render hoàn toàn** — cookie/URL vẫn cập nhật đúng (verify qua network trace + `context.cookies()`), nhưng option vừa chọn không hiện active tới khi F5 thủ công. Đã thử `revalidatePath` (Route Handler chỉ đánh dấu stale cho **lần ghé thăm sau**, không có Full Route Cache nào để xoá vì trang vốn đã dynamic do `cookies()`) và `router.refresh()` gọi trong `useEffect` (effect **không refire** vì cây React không remount khi soft-nav bị bỏ qua) — cả hai đều không sửa được. Fix: `CutoffHardNavGuard` (`src/app/(dashboard)/settings/CutoffHardNavGuard.tsx`, client component rỗng JSX, mount từ `settings/page.tsx`) — capture-phase click listener ép hard navigation (`window.location.href`) riêng cho các link `/api/cutoff`, tôn trọng modifier keys/middle-click (mở tab mới) như thẻ `<a>` mặc định. Không đụng `CutoffPicker`/`SettingsScreen` (Presentational).
- `getPortfolioValuation()` chuyển từ `features/dashboard/queries.ts` xuống `lib/portfolio-valuation.ts` (Dashboard **và** Settings đều cần — Settings dùng để tính `xirrLabel` preview cho từng mốc trong `getCutoffOptions()`; feature không cross-import lẫn nhau theo `docs/rules/project-structure.md`). `PortfolioValuation` type khai độc lập (không còn `Omit<DashboardScreenProps, ...>`) vì `lib/` không phụ thuộc ngược vào `features/`. Xoá `features/dashboard/queries.ts` + `features/dashboard/types.ts` sau khi xác nhận (grep) không còn ai import.
- Thêm `settings/loading.tsx`: `settings/page.tsx` đổi từ sync (Phase 1) sang async (đọc cookie + `getCutoffOptions()`) — không có `loading.tsx` riêng thì route này kế thừa nhầm `(dashboard)/loading.tsx` (`DashboardScreenSkeleton`, sai hình dạng khung Cài đặt) trong lúc chờ.
- Docs đã sync: không cần sửa `docs/domain/09-settings.md`/`docs/02-data-model.md` (không đổi entity/schema, chỉ cookie runtime).

**Không thêm cache Holdings/Cashflow ở Phase 2 — giữ nguyên query thẳng Prisma.**
- Bối cảnh: `process/phase-2.md` (mục "Hiện trạng fetch Phase 1 cần xử lý ở phase này") từng ghi mục treo "chưa đụng cache holdings/cashflow, chưa đo được điểm chậm". Rà lại code xác nhận đây không phải việc bị bỏ sót mà có căn cứ kỹ thuật đóng dứt điểm.
- Lý do: (1) `getHoldingsRaw` chỉ đọc `Holding.quantity`/`avgCost` đã materialize (issue #18, mục "Materialize vị thế" ở trên) — O(số holding), không kéo `Cashflow`. (2) `getHoldingDetail`/`getPortfolioValuation` đều gọi `valuateHoldings()` batch giá 1 lần, và `getAllCashflowsForXirr`/`getAllCashDividendsForXirr` (`lib/portfolio-valuation.ts`) `findMany` theo tập `holdingIds` gộp 1 lần — không N+1 ở cả 2 nơi đọc. (3) App cá nhân, phi thương mại, quy mô mỗi user vài chục holding — không có dấu hiệu chậm thật, đúng nguyên tắc "không tối ưu sớm" (`docs/rules/performance.md`). (4) Thêm `unstable_cache` theo `userId` lúc này chỉ tăng rủi ro key-scoping (footgun đã cảnh báo ở mục "Đổi rule cache tầng server" phía trên) mà không giải quyết vấn đề đo được nào.
- Quyết định: giữ nguyên, không thêm `unstable_cache`/`revalidateTag` nào cho `getHoldingsRaw`, `getHoldingDetail`, `getPortfolioValuation`, hay bất kỳ query cashflow nào ở Phase 2.
- Điều kiện quay lại: Phase 3, khi thêm `Snapshot` (đọc dày cho chart NAV) — lúc đó đo lại và, nếu cần cache, áp đúng công thức: `unstable_cache` nhận `userId` làm **tham số hàm** (không đọc `auth()` bên trong hàm cache), cache key gồm `userId`, `revalidateTag` gọi trong mọi Server Action ghi `Holding`/`Cashflow` ở `src/features/holdings/actions.ts` (hiện đã có `revalidatePath` ở 4 chỗ — `createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction` — cần thêm `revalidateTag` cạnh đó nếu bọc cache). **Không** copy nguyên pattern `getLatestPriceQuotes` (`lib/valuation.ts`) — đó là cache theo `symbol` dùng chung giữa nhiều user, khác bản chất với cache theo `userId`.
- Docs đã sync: `process/phase-2.md` (mục "Hiện trạng fetch Phase 1 cần xử lý ở phase này").

## 2026-07-13

**Wiring dữ liệu thật cho màn Danh mục + Chi tiết vị thế — 2 quyết định về ca biên hiển thị (không đổi công thức XIRR/PnL cốt lõi).**

- **Vị thế đã đóng (SL=0), `getHoldingDetail()` CỐ Ý để `valuation` là `undefined`** (giống hệt ca `MISSING_PRICE`) dù NAV=0 xác định được — phát hiện qua e2e (`holdings.spec.ts` "bán hết về 0..."): `HoldingDetailScreen` (Presentational, design-implementer) hiện chỉ có 2 nhánh — nhánh `valuation` (NAV hero + ReturnMetrics + timeline, KHÔNG hiện lại Số lượng/Giá vốn bình quân) và nhánh Phase 1 fallback (Số lượng/Giá vốn bình quân/Tổng vốn). Thử build `valuation` cho ca CLOSED (NAV="0", XIRR "chốt") làm mất dòng "0 cổ phần" khỏi màn — vị thế đã bán hết không còn hiện được số lượng đã về 0. Rơi về Phase 1 fallback vẫn đúng nghiệp vụ (hiện đúng SL=0/vốn TB), chỉ là XIRR "chốt" (domain/05 "Vị thế đã đóng") chưa có chỗ hiển thị trên màn chi tiết — cần thiết kế thêm 1 biến thể riêng cho vị thế đóng ở `HoldingDetailScreen` (việc của design-implementer, không phải business-implementer) mới mở lại được. Ảnh hưởng: `src/features/holdings/queries.ts` (`getHoldingDetail`).
- **`GroupValuation.changePercent` (màn Danh mục, theo nhóm loại tài sản) chỉ tính trên các mã ĐÃ định giá được trong nhóm** — mã `MISSING_PRICE` bị loại khỏi CẢ tử số lẫn mẫu số (không mặc định NAV/vốn = 0 cho mã đó, khớp docs/domain/04 "Thiếu giá... không được mặc định 0"). Hệ quả: % nhóm hiển thị là "% thay đổi của phần đã định giá được", không phải % của toàn nhóm — nhóm không có mã nào định giá được thì bỏ hẳn key đó khỏi `groupValuations` (component tự rơi về hiển thị Phase 1). Ảnh hưởng: `src/features/holdings/queries.ts` (`getOpenHoldingsWithValuation`).
- Docs: không cần sửa `docs/domain/04-pricing-and-valuation.md` (đã có sẵn nguyên tắc "thiếu giá không mặc định 0", 2 quyết định trên chỉ là áp dụng cụ thể xuống 1 field UI + 1 công thức tổng hợp theo nhóm, không phải luật domain mới).

## 2026-07-14

**Issue #34: dedup constraint cho `Snapshot` đã đóng băng — khóa `(userId|holdingId, date, period)`, thực hiện bằng 2 partial unique index (raw SQL), không phải `@@unique`.**
- Khóa duy nhất: `(userId, date, period)` cho snapshot tổng danh mục (`holdingId = null`), và `(holdingId, date, period)` cho snapshot theo từng vị thế.
- **`period` nằm trong khóa** vì cùng một `date` lịch có thể hợp lệ sinh 2 dòng khác nhau: cron tháng (`PERIODIC`, fire 01/01 ghi cho 31/12 năm trước) và cron cuối năm (`YEAR_END`, cũng fire 01/01 ghi cho cùng 31/12) — 2 mốc báo cáo khác mục đích, không phải trùng lặp cần chặn.
- **Vì sao không dùng `@@unique` thường:** `holdingId` nullable, và Postgres coi mỗi `NULL` là khác biệt trong unique index thường (`NULL != NULL`) — một `@@unique([userId, date, period])` khai trong `schema.prisma` sẽ **không** chặn được nhiều dòng snapshot tổng danh mục trùng mốc (vì `holdingId` luôn null với các dòng này, Postgres không coi là trùng). Prisma DSL cũng không hỗ trợ `WHERE` cho `@@unique` nên không thể tự thu hẹp phạm vi bằng field thường. Giải pháp: 2 **partial unique index** viết tay bằng raw SQL trong migration `20260714075356_add_snapshot_unique_constraint` (`CREATE UNIQUE INDEX ... WHERE "holdingId" IS NULL` / `WHERE "holdingId" IS NOT NULL`) — chỉ đánh dấu bằng comment `// NOTE:` cạnh model `Snapshot` trong `schema.prisma`, không có block `@@unique` tương ứng. Vì đây không phải cấu trúc khai báo được ở DSL, các lần `prisma migrate dev` sau không diff/drop nhầm 2 index này.
- Phạm vi cố ý hẹp: issue #34 chỉ thêm ràng buộc DB, **không** viết logic ghi (upsert Server Action, cron workflow "Chốt số liệu hôm nay") — để issue Phase 3 sau.
- Docs đã sync: `prisma/schema.prisma` (comment `NOTE:`), `docs/02-data-model.md` (comment tương ứng trong code block + bullet mới trong "Ghi chú thiết kế" + xoá caveat "bản nháp" đã chốt), `docs/domain/06-snapshots.md` (bullet dedup trong "Quy tắc & bất biến" + gộp 2 ca biên cũ thành 1 rule đã chốt), `process/phase-3.md` (tick mục Model `Snapshot`), `process/PROCESS.md` (Phase 3 → 🟨).
