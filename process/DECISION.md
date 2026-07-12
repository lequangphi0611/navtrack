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

**Nghi vấn regression session ở `proxy.ts`/middleware — không phải bug thật.**
- Triệu chứng: mọi route đã đăng nhập bị redirect `/sign-in` dù session hợp lệ. Nghi vấn ban đầu: Next.js 16 đổi middleware sang **Edge**, không gọi được Prisma cho `session: { strategy: "database" }`.
- Kết luận: **không tái hiện** (fetch trực tiếp + `holdings.spec.ts`/`smoke.spec.ts` pass, `/holdings` trả 200). Từ v16.0.0 Proxy **mặc định Node.js runtime** (ngược nghi vấn) → Prisma gọi bình thường. Lần fail đầu là lỗi môi trường/cookie nhất thời. Ghi lại để **không đi lại hướng "middleware Edge runtime"**; không sửa gì ở `proxy.ts`/`auth.ts`.

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

**Materialize vị thế (`quantity`/`avgCost`) lên `Holding` — issue #18 (đảo hướng "giá vốn không lưu cứng").**
- Bối cảnh: màn Danh mục (`getHoldingsRaw`) dù `select` hẹp vẫn **kéo toàn bộ cashflow của mọi holding** chỉ để `derivePosition` ra vài con số. `select` hẹp chỉ giảm **bề rộng field**, **không giảm số dòng** → payload phình vô hạn theo lịch sử giao dịch. (Đính chính lý do "driver chậm chính" của bước refactor `include`→`select` cùng ngày: bỏ `include` chưa phải fix; giảm **số dòng** mới là fix, và cách làm là materialize.)
- Quyết định: thêm 2 cột **materialized cache** `Holding.quantity` + `Holding.avgCost`. Overview đọc thuần 2 cột (O(số holding), không kéo cashflow). **Đảo** ghi chú domain cũ "giá vốn bình quân không lưu cứng".
- Vì sao an toàn (không data drift): mọi mutation cashflow tập trung đúng **4 action** (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`), job Python **không** đụng cashflow, cả 4 **đã** gọi `derivePosition` sẵn để validate `wentNegative` → ghi cache gần như **miễn phí** (không thêm round-trip).
- **Bất biến:** cache là bản chiếu, **nguồn sự thật vẫn là `Cashflow`**; chỉ ghi bằng `persistPosition(derivePosition(toàn bộ cashflow))` trong **cùng transaction** với mọi thay đổi cashflow, **không cộng/trừ tay**. ⚠️ **Cổ tức cổ phiếu (Phase 4)** cũng làm đổi `quantity` → đường ghi đó phải cập nhật cache theo cùng bất biến, nếu không cache lệch.
- Backfill dữ liệu cũ: **data migration** `20260711092933_backfill_holding_position` (recursive CTE bản sao `derivePosition`, gồm reset avgCost khi SL về 0; đã **verify khớp** local: 4 holding thật + 4 kịch bản synthetic). Chạy **tự động 1 lần/DB** qua `migrate deploy` (Prisma ghi `_prisma_migrations` nên không lặp; idempotent như lưới an toàn) — **không còn thao tác tay trên prod**. Cả migration schema `20260711081325_add_holding_position_cache` + data migration này **đã áp local**; prod sẽ tự áp khi deploy.
- Route (cùng issue #18): tách `/holdings` (mở) ↔ `/holdings/closed` (đóng) qua route group `holdings/(overview)/` dùng chung `layout.tsx`, mỗi route con Suspense riêng vùng danh sách; xóa `HoldingsTabs` (thay bằng `<Link>` thật, không giữ tab state client).
- Docs đã sync: `prisma/schema.prisma`, `docs/02-data-model.md`, `docs/domain/01-assets-and-holdings.md` (+ cảnh báo cổ tức Phase 4), `docs/domain/02-transactions-and-cost-basis.md`, `docs/rules/data-prisma.md` (mục "Chọn `select` hẹp…" + "Materialized cache…"), `docs/rules/component-architecture.md` (Suspense per-region + "tab → tách route").

**Issue #12: full-page skeleton khi chuyển trang — chỉ 2/6 route thật sự cần tách, không phải 4.**
- Khảo sát: `(dashboard)/layout.tsx` cố ý không có header chrome riêng (theo mockup Phase 1 Screens, điều hướng nằm trong từng màn) — xác nhận đây **là chủ đích thiết kế**, không phải chỗ thiếu; không đổi layout gốc.
- Chỉ 2 route thật sự cần tách Suspense: `holdings/[id]/transactions/new` và `holdings/[id]/transactions/[cashflowId]/edit` — header tĩnh (title cố định + route param, không phụ thuộc query) và có `loading.tsx` tổ tiên (`holdings/[id]/loading.tsx`) làm prefetch boundary sẵn, nên tách `TransactionForm` thành async section trong `Suspense` riêng (page giữ sync/`PageHeader` + fallback skeleton) là đúng checklist rule #2 (`docs/rules/component-architecture.md`, mục "Loading, skeleton & Suspense"). Xoá `loading.tsx` cấp route tương ứng cho 2 route này (đúng ngoại lệ quy tắc #1, vì đã có prefetch boundary ở tổ tiên).
- `settings/members` và `settings/members/invite` **ban đầu bị áp nhầm hướng tách Suspense** (tưởng giống case trên) — code review phát hiện: cả 2 route này có `getInvitableStatus()` là **1 query quyết định toàn bộ nhánh render** (Denied vs List ở `/settings/members`; render form vs redirect ở `/settings/members/invite`) → đúng case rule #3 ("1 query quyết định toàn bộ layout → giữ async page + `loading.tsx` riêng"), không phải rule #2. Tách bằng Suspense sai vì (a) fallback skeleton (quota+list shape) hiện ra cho cả user bị từ chối quyền — ngầm gợi ý sai họ có quyền truy cập, đi ngược tinh thần bảo mật của `MembersDeniedScreen`; (b) xóa `loading.tsx` làm mất prefetch boundary (route này không có `loading.tsx` tổ tiên nào khác thay thế). Đã **revert** về async `page.tsx` (gọi `getInvitableStatus()` trực tiếp, rẽ nhánh JSX) + `loading.tsx` riêng — giống cách xử lý `holdings/[id]`. Giữ lại phần dọn code hợp lệ: `PageHeader` gọi 1 lần ở `page.tsx` thay vì lặp lại trong từng screen con (`MembersListScreen`/`MembersDeniedScreen` không tự dựng wrapper/header riêng).
- **Không đổi** `holdings/[id]` (title = `holding.symbol`, phụ thuộc đúng query mà nội dung còn lại cũng cần → rule #3, giữ nguyên `loading.tsx`) và `holdings/(overview)` (đã tách route group từ issue #18).
- Trade-off có chủ đích (2 route transactions): `getHoldingDetail()`/`notFound()` cho cashflow không tồn tại giờ chạy **bên trong `Suspense`** → theo Next.js, sau khi fallback đã stream thì không đổi được HTTP status nữa, nên id không hợp lệ trả về **200** (không phải 404 thật). Chấp nhận vì app private/auth-gated, không có crawler/SEO — ưu tiên UX header hiện tức thì mỗi lần điều hướng.
- Không cần đổi rule vì code đang **chưa tuân** rule sẵn có (`settings/members/page.tsx` là ví dụ mẫu ✅ Good ngay trong rule #2 nhưng implementation cũ lại await tuần tự) — không sync thêm doc nào ngoài mục này.

**Phase 2: thêm `BottomNav` dùng chung cho màn gốc/tab — ghi đè phạm vi hẹp quyết định "không có header chrome riêng" (issue #12, mục trên).**
- Bối cảnh: mockup Phase 2 (`Phase 2 Screens.dc.html`, 2a/2b) giới thiệu thanh bottom nav (Tổng quan / Danh mục / Cài đặt) — Phase 1 cố ý không có, điều hướng nằm trong từng màn (xem quyết định issue #12 ở trên). Đây là thay đổi kiến trúc điều hướng, áp dụng **ngược lại** cho cả màn gốc Phase 1 để nhất quán.
- Quyết định: **ghi đè có phạm vi hẹp hơn** — quyết định cũ "không có header chrome riêng" vẫn đúng cho **màn con/form** (nhập vị thế, giao dịch, chi tiết vị thế, nhập giá tay, mời thành viên, đăng nhập): giữ nguyên header back/close, không có BottomNav. **Màn gốc/tab** nay có BottomNav: `/` (Dashboard), `/holdings` + `/holdings/closed` (kể cả nhánh rỗng `HoldingsEmptyState`, vì layout thay thế hoàn toàn `HoldingsOverviewScreen` khi chưa có vị thế nào — vẫn cùng route), `/settings`.
- Wiring đúng 4 chỗ: `HoldingsOverviewScreen`, `HoldingsEmptyState`, `DashboardScreen` (mới), `SettingsScreen` (mới, tách từ `settings/page.tsx` inline JSX cũ).
- Docs đã sync: `process/UI_phase_2.md` (mới — Props-contract chi tiết từng component Phase 2 UI, deliverable của `design-implementer`), `process/phase-2.md` (trỏ tới `UI_phase_2.md`).
- Còn treo (business-implementer xác nhận khi wiring dữ liệu thật, xem `UI_phase_2.md`): nơi lưu lựa chọn mốc chốt định giá (`Setting` không lưu theo `docs/domain/09-settings.md` — query param/cookie/field `User` mới TBD); route thật cho `NavOverrideForm` (hiện chưa có, CTA tạm trỏ `ROUTES.holdingDetail`).

## 2026-07-12

**Đơn vị giá `jobs/price-fetcher`: VCI trả nghìn đồng (×1000), fmarket trả VND thô (không nhân).**
- `PRICE_SCALE = Decimal(1000)` áp cho nguồn VCI (`vnstock.Quote`, cổ phiếu/ETF niêm yết) — verify thủ công VNM/FPT khớp giá thị trường thật. Lý do: khớp đơn vị với `Cashflow.pricePerUnit` (VND thô), tránh sai NAV/XIRR **1000 lần** nếu quên quy đổi.
- fmarket (`vnstock.Fund`, quỹ mở không niêm yết, xem mục dưới) trả NAV/chứng chỉ quỹ **đã là VND thô** — verify thủ công VESAF: `listing().nav` (32455.33) khớp `nav_report()` mới nhất cùng ngày. **KHÔNG** áp `PRICE_SCALE` cho nguồn này — 2 nguồn khác đơn vị dù cùng nằm trong thư viện `vnstock`.
- Docs đã sync: `docs/domain/04-pricing-and-valuation.md` (mục "Quy tắc & bất biến", thêm 1 câu nêu rõ 2 nguồn khác đơn vị).

**FUND holdings không niêm yết sàn (quỹ mở, vd VESAF/DCDS) — thêm fallback fmarket khi VCI không có dữ liệu.**
- Bối cảnh: `Holding{ type: FUND }` gồm cả ETF niêm yết sàn (có ticker VCI thật, vd FUEVFVND) lẫn quỹ mở không niêm yết (vd TCBF, VESAF, DCDS — nguồn VCI luôn fail vì không có ticker sàn). Không có field phân loại thêm trong `Holding` để tách 2 loại này trước khi gọi API.
- Quyết định: `fetch_price(symbol, asset_type)` thử VCI trước (`_fetch_price_vci`); nếu rỗng/lỗi **và `asset_type == "FUND"`**, fallback thử fmarket (`_fetch_price_fmarket`, dùng `vnstock.explorer.fmarket.fund.Fund`) trước khi coi là fail hẳn. `asset_type` lấy từ `Holding.type` (query kèm trong `get_symbols_to_fetch`, trước đó chỉ lấy `symbol` nên bị bỏ phí). **STOCK không fallback fmarket** — cổ phiếu luôn niêm yết sàn nên VCI fail là fail hẳn; fallback fmarket cho STOCK vừa vô ích vừa có rủi ro (dù hiếm) trùng `shortName` với 1 quỹ mở nào đó trên fmarket, lưu nhầm giá NAV quỹ vào `PriceQuote` của mã cổ phiếu. Match quỹ theo **CHÍNH XÁC** `shortName` (API `Fund.filter()` search substring phía server, vd tìm "VCBF" trả về cả VCBF-BCF/VCBF-MGF/...).
- **Giới hạn đã biết:** fmarket chỉ liệt kê quỹ phân phối qua nền tảng Fmarket — **không phủ hết mọi quỹ mở VN**. Verify thủ công: `TCBF` (ví dụ minh hoạ ở `docs/domain/01-assets-and-holdings.md`) **không có** trong danh sách 66 quỹ của fmarket tại thời điểm verify (có thể phân phối riêng qua kênh ngân hàng Techcombank, không qua Fmarket) — trong khi VESAF/DCDS **có**. Khi cả VCI lẫn fmarket đều fail, job log rõ gợi ý nhập tay qua `NavOverride` thay vì log chung chung.
- fmarket **không có retry nội bộ** (khác VCI dùng tenacity) — cố ý không thêm retry/backoff thủ công riêng cho nguồn này (job chạy lại theo lịch mỗi ngày nên lỗi mạng thoáng qua tự phục hồi ở lần chạy sau; thêm retry tay riêng cho 1 nguồn đi ngược lý do đã bỏ retry tay ở VCI — xem mục double-retry bên dưới).
- `Fund()` tải toàn bộ listing quỹ khi khởi tạo (1 API call) — cache 1 instance dùng chung trong suốt lần chạy job (`_fund_client()`), tránh gọi lại `listing()` cho mỗi mã FUND fallback.
- Docs đã sync: `docs/domain/04-pricing-and-valuation.md`, `jobs/price-fetcher/README.md`.

**`NavOverride`: thêm `@@unique([holdingId, date])` + đổi `date` sang `@db.Date`.**
- Bối cảnh: wiring Server Action `saveNavOverride` (nhập giá tay cho vàng/trái phiếu, có thể mọi loại tài sản) cần "upsert theo (holdingId, date)" — sửa giá cùng ngày phải ghi đè, không tạo dòng trùng. `NavOverride` khi đó **chưa có** unique constraint nào (khác `PriceQuote` đã có `@@unique([symbol, date])` cho đúng mục đích này) → Prisma `upsert` không có `where` hợp lệ để dùng.
- Quyết định: thêm `@@unique([holdingId, date])`, đồng thời đổi `date DateTime` → `date DateTime @db.Date` — `NavOverride.date` chỉ bao giờ nhận từ `<input type="date">` (không có giờ), giữ nguyên `DateTime` có giờ sẽ khiến 2 lần nhập cùng ngày nhưng khác millisecond/giờ (nếu code sau này parse khác đi) âm thầm né được unique constraint và làm lệch kết quả "dòng mới nhất ≤ D" ở `lib/valuation.ts` (`getLatestNavOverrides`, dùng `distinct: ["holdingId"]`).
- Migration: `20260712023349_add_nav_override_unique_date_only` (SQL sinh bằng `prisma migrate diff` vì môi trường CLI non-interactive không chạy được `migrate dev` thẳng — verify không có dữ liệu `NavOverride` cũ nên đổi kiểu cột không rủi ro mất dữ liệu).
- Docs đã sync: `docs/02-data-model.md` (định nghĩa `NavOverride`).

**Bỏ retry loop thủ công trong `fetch_price` — `Quote.history()` (VCI) đã tự retry nội bộ qua tenacity.**
- Bối cảnh: code review phát hiện `fetch_price()` tự viết retry loop (3 lần, backoff 2/4/8s) bọc ngoài `Quote.history()`, trong khi `Quote.history()` của vnstock đã tự retry 3 lần nội bộ (`Config.RETRIES=3`, tenacity `wait_exponential`, xem `vnstock/api/quote.py`). 1 mã lỗi có thể tốn tới 9 lần gọi HTTP thật — không tôn trọng rate limit.
- Quyết định: bỏ hẳn retry loop tay viết; `_fetch_price_vci`/`_fetch_price_fmarket` chỉ `try/except` bắt exception cuối cùng (sau khi tenacity đã tự retry hết ở phía VCI) rồi trả `None`, không raise ra ngoài — vẫn đúng rule "cô lập lỗi" (`docs/rules/python-job.md`), chỉ bỏ phần tự retry dư thừa.
- Docs đã sync: không cần đổi `docs/rules/python-job.md` (rule "retry có backoff" vẫn đúng — chỉ là backoff nằm ở tầng thư viện `vnstock` thay vì code job tự viết); ghi lại đây để không quay lại thêm retry tay lần nữa.
