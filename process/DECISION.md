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
