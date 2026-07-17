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

**Session regression: không phải bug** — triệu chứng thoáng qua không tái hiện, lỗi môi trường nhất thời.

**PWA gộp vào Phase 1 — phạm vi cố ý tối giản.**
- Ràng buộc bền: (1) **không cache số liệu tài chính offline** (app tài chính — tránh hiện số sai/cũ khi mất mạng); chỉ installable + cache asset tĩnh. (2) **Chưa làm Web Push/VAPID** — cảnh báo giá vẫn ở Backlog. (3) Service worker **viết tay** (`public/sw.js`), không dùng `next-pwa`/Serwist — tránh rủi ro tương thích Next 16 + Turbopack.
- Docs đã sync: `docs/04-tech-stack.md` (mục "PWA"), `docs/03-roadmap.md` (Phase 1), `process/phase-1.md`.

**Đổi rule cache tầng server: "cấm cache cả nắm" → "cache có chọn lọc".**
- Bối cảnh: rule cũ cấm mọi cache vì số liệu tài chính phải tươi + quy mô nhỏ; bây giờ Phase 2–3 thêm `PriceQuote` + snapshot → đáng cache chọn lọc.
- **Bất biến bảo mật (mọi phase):**
  - Session/quyền **không bao giờ** cache xuyên request (thu hồi tức thời).
  - **Footgun:** cache key cho dữ liệu scoped-user **phải gồm `userId` làm tham số hàm** (không đọc từ `auth()` bên trong cache) — nếu không → mọi user chung 1 entry = rò dữ liệu. Dữ liệu dùng chung (`PriceQuote`) cache key theo `symbol`.
- Phase 2 ứng viên cache: `PriceQuote` (revalidate khớp EOD job). Phase 1 vẫn không cache (quy mô cá nhân nhỏ, không có chậm); điều kiện quay lại Phase 3 (snapshot dày) — xem ghi chú "Không thêm cache Phase 2" bên dưới.
- Docs: `docs/rules/performance.md`.

**Materialize `Holding.quantity`/`avgCost` — issue #18 (O(number) thay O(cashflow)).**
- Thêm 2 cột cache (`quantity`, `avgCost`); overview đọc thuần 2 cột. **Bất biến:** nguồn sự thật `Cashflow`, ghi cache bằng `derivePosition()` trong **cùng transaction** mọi mutation ⚠️ **Phase 4 dividend cũng đổi `quantity`** → phải cập nhật cache theo bất biến.
- Route tách `/holdings` ↔ `/holdings/closed` qua route group. Backfill đã áp.
- Docs: `docs/rules/data-prisma.md` (mục "Materialized cache").

**Issue #12: Suspense routes — áp rule #2 vs #3: chỉ tách Suspense khi Suspense vật lý tách được từ query.**
- Ví dụ: `holdings/[id]/transactions/{new,edit}` tách (form không cần query). `settings/members/*` giữ async page (query quyết định render).
- Docs: `docs/rules/component-architecture.md`.

**Phase 2: BottomNav dùng chung màn gốc (không form/route con) — quyết định cũ "không header chrome riêng" vẫn giữ cho form.**
- **Còn treo:** `NavOverrideForm` chưa có route thật; "Tuỳ chỉnh" (CUSTOM) cutoff chưa mockup.

## 2026-07-12

**`NavOverride`: `@@unique([holdingId, date])` + `@db.Date` — upsert tự động, sửa giá cùng ngày phải ghi đè.**

**Cutoff selection: cookie + Route Handler `/api/cutoff` + `CutoffHardNavGuard` hard nav để kích active state.**
- Lý do: Server Component không `cookies().set()` lúc render.
- **Cảnh báo:** Next.js soft-nav bỏ qua re-render → phải hard nav riêng cho link cutoff, tôn trọng modifier keys (open tab).
- `Setting` không lưu (read-only); "Tuỳ chỉnh" (CUSTOM) chưa mockup.

## 2026-07-14

**Đổi rule ưu tiên giá: so ngày `NavOverride` vs `PriceQuote`, không còn "nhập tay luôn thắng" (issue #40).**
- Bối cảnh: STOCK/FUND định giá tự động nhưng vẫn cho sửa tay. Rule cũ (`resolvePrice()`, `src/lib/valuation.ts`) luôn ưu tiên `NavOverride` nếu tồn tại, bất kể ngày — một lần nhập tay giá sẽ shadow vĩnh viễn mọi `PriceQuote` mới hơn về sau, giá nhập tay cũ không tự nhường lại cho giá tự động mới.
- Quyết định: `resolvePrice()` so `date` giữa 2 nguồn (đã lọc "gần nhất ≤ D" ở tầng query, không đổi), dùng nguồn có `date` mới hơn; cùng ngày → vẫn ưu tiên NavOverride. Chỉ có 1 nguồn (GOLD/BOND không có PriceQuote) → hành vi không đổi.
- Docs đã sync: `docs/domain/04-pricing-and-valuation.md` (mục "Ưu tiên giá tại ngày D" + thêm ví dụ staleness).

**`pnpm e2e` chạy trên DB Postgres riêng, ephemeral — tách hẳn khỏi DB dev.**
- Bối cảnh: trước đây `pnpm e2e` (`playwright.config.ts` webServer chạy `pnpm dev`) dùng chung `DATABASE_URL` với dev (`.env`, service `db` cổng 5433) — test và data đang thao tác tay lẫn vào cùng 1 DB.
- Quyết định: thêm service `db-test` (`docker-compose.test.yml`, project name riêng `navtrack-test`, cổng 5434, data ở tmpfs — không named volume) + `.env.test`. `pnpm e2e` đổi thành `node scripts/e2e.mjs`: tự `docker compose -f docker-compose.test.yml up --wait` → `prisma migrate deploy` vào DB test → `playwright test` (kế thừa `DATABASE_URL` đã override qua biến môi trường tiến trình con, không cần sửa `playwright.config.ts`) → `down` khi xong (kể cả fail, trong `finally`). Project name riêng đảm bảo `down` không đụng service `db` (dev) dù chung `docker-compose.yml`/network mặc định.
- Docs đã sync: `README.md` (mục "Chạy e2e"), `docs/rules/testing.md` (mục "End-to-end").

**Issue #34: dedup constraint cho `Snapshot` đã đóng băng — khóa `(userId|holdingId, date, period)`, thực hiện bằng 2 partial unique index (raw SQL), không phải `@@unique`.**
- Khóa duy nhất: `(userId, date, period)` cho snapshot tổng danh mục (`holdingId = null`), và `(holdingId, date, period)` cho snapshot theo từng vị thế.
- **`period` nằm trong khóa** vì cùng một `date` lịch có thể hợp lệ sinh 2 dòng khác nhau: cron tháng (`PERIODIC`, fire 01/01 ghi cho 31/12 năm trước) và cron cuối năm (`YEAR_END`, cũng fire 01/01 ghi cho cùng 31/12) — 2 mốc báo cáo khác mục đích, không phải trùng lặp cần chặn.
- **Vì sao không dùng `@@unique` thường:** `holdingId` nullable, và Postgres coi mỗi `NULL` là khác biệt trong unique index thường (`NULL != NULL`) — một `@@unique([userId, date, period])` khai trong `schema.prisma` sẽ **không** chặn được nhiều dòng snapshot tổng danh mục trùng mốc (vì `holdingId` luôn null với các dòng này, Postgres không coi là trùng). Prisma DSL cũng không hỗ trợ `WHERE` cho `@@unique` nên không thể tự thu hẹp phạm vi bằng field thường. Giải pháp: 2 **partial unique index** viết tay bằng raw SQL trong migration `20260714075356_add_snapshot_unique_constraint` (`CREATE UNIQUE INDEX ... WHERE "holdingId" IS NULL` / `WHERE "holdingId" IS NOT NULL`) — chỉ đánh dấu bằng comment `// NOTE:` cạnh model `Snapshot` trong `schema.prisma`, không có block `@@unique` tương ứng. Vì đây không phải cấu trúc khai báo được ở DSL, các lần `prisma migrate dev` sau không diff/drop nhầm 2 index này.
- Phạm vi cố ý hẹp: issue #34 chỉ thêm ràng buộc DB, **không** viết logic ghi (upsert Server Action, cron workflow "Chốt số liệu hôm nay") — để issue Phase 3 sau.
- Docs đã sync: `prisma/schema.prisma` (comment `NOTE:`), `docs/02-data-model.md` (comment tương ứng trong code block + bullet mới trong "Ghi chú thiết kế" + xoá caveat "bản nháp" đã chốt), `docs/domain/06-snapshots.md` (bullet dedup trong "Quy tắc & bất biến" + gộp 2 ca biên cũ thành 1 rule đã chốt), `process/phase-3.md` (tick mục Model `Snapshot`), `process/PROCESS.md` (Phase 3 → 🟨).

**Issue #36: job Python `jobs/snapshot-cron/` chốt `Snapshot{PERIODIC}`/`{YEAR_END}` — viết lại công thức định giá bằng SQL/Python, không gọi API route Next.**
- **Vì sao không cho job gọi API route:** vi phạm ranh giới ("Python và TS chỉ chia sẻ schema Postgres"). Công thức định giá đơn giản (so `date` giữa `NavOverride`/`PriceQuote` mới nhất ≤ D, `nav = quantity * price`) — viết lại bằng Python + SQL, giống tiền lệ `AUTO_PRICED_ASSET_TYPES` (ĐỒNG BỘ THỦ CÔNG giữa 2 phía).
- **`Snapshot.source` = `AUTO` cho tổng danh mục** (`holdingId = null`) bất kể holding đóng góp dùng giá `MANUAL` hay `AUTO` — tổng danh mục là sum, không phải giá từ 1 `NavOverride`. `MANUAL` chỉ cho giá trị ≡ 1 giá nhập tay (cấp Holding).
- **Ca biên thiếu giá:** Holding không resolve được giá → không ghi dòng Snapshot cho Holding đó, log rõ. Tổng danh mục: còn ≥ 1 Holding biết giá → ghi tổng = sum (PARTIAL, log mã thiếu); toàn bộ thiếu → bỏ qua. Không có cờ "PARTIAL" trong schema.
- Docs đã sync: `docs/domain/06-snapshots.md`, `docs/04-tech-stack.md`, `docs/rules/project-structure.md`, `README.md`, `process/phase-3.md`.

## 2026-07-15

**Integration test Python: snapshot-cron + price-fetcher trên Postgres thật ephemeral.**
- **Tái dùng `docker-compose.test.yml`/`.env.test` cho cả 2 job** (đã là hạ tầng ephemeral độc lập, không dựng compose riêng).
- **Script Node (`scripts/python-integration-test.mjs`) orchestrate docker + migrate + pytest**, không để Python tự gọi docker (giữ ranh giới Python↔TS: chỉ chia sẻ schema Postgres).
- **snapshot-cron:** marker `@pytest.mark.integration` + `addopts = "-m 'not integration'"` trong pyproject.toml để pytest mặc định bỏ integration test (nhanh dev loop). Guard DB_URL phải là `:5434` trong fixture autouse.
- **price-fetcher:** monkeypatch `main.fetch_price` (chỉ tầng high, không mock vnstock), verify `get_symbols_to_fetch()` + idempotent trên constraint thật, tự quét tất cả job có `test_integration.py` thay hardcode tên job.
- Docs đã sync: `docs/rules/python-job.md`, `docs/rules/testing.md`, `HARNESS.md`, `README.md`, `jobs/*/README.md`.

## 2026-07-15 (2)

**Issue #37: Snapshot thủ công (`MANUAL`) — Serializable transaction + `findFirst` rồi create/update, re-chốt idempotent.**
- **Không dùng `.upsert()`:** khóa dedup là 2 partial unique index raw SQL (không `@@unique` trong schema), Prisma Client không sinh input `where` compound. Dùng `findFirst` + `create`/`update` trong `db.$transaction({ isolationLevel: Serializable })`. An toàn kép: Serializable chặn race, partial unique index thật chặn create trùng (catch P2034 + P2002).
- **Re-chốt "hôm nay" nhiều lần = upsert idempotent, `ok: true` luôn**, không lỗi — chốt lại phải ghi đè (đã được partial unique index + Serializable đảm bảo), không phải chặn UI bấm nút.
- **Thêm `Snapshot.updatedAt @default(now()) @updatedAt`** — reflect lần chốt gần nhất khi re-chốt. `@default(now())` (khác `updatedAt` khác) backfill NOT NULL non-interactively. **Cập nhật cùng lúc `jobs/snapshot-cron/main.py`:** thêm `"updatedAt": now()` vào INSERT/DO UPDATE SET.
- **`Snapshot.date` là `TIMESTAMP(3)` không `@db.Date`** — dùng `Date` cố định 00:00:00 UTC (không `endOfDay()` có 23:59:59.999) để ổn định giữa nhiều lần gọi cùng ngày.
- **Ca biên thiếu giá MANUAL:** mirror cron (#36) — tách logic thuần `planManualSnapshot()` để unit test, action gọi rồi ghi.
- Docs đã sync: `docs/02-data-model.md`, `docs/domain/06-snapshots.md`, `process/phase-3.md`.

## 2026-07-15 (3)

**Issue #46: `getSnapshotHistory()`/`getSnapshotDetail(id)` — badge suy từ `period`, breakdown liên kết via `(userId, date, period)`, comparison threshold 1 VND.**
- **Badge suy từ `Snapshot.period` không thêm field schema** — không phân biệt "MANUAL do giao dịch" vs "MANUAL do user bấm"; chấp nhận gộp (PERIODIC/YEAR_END/MANUAL → badge khác nhau).
- **`/snapshots/[id]` liên kết breakdown per-holding với tổng** qua query `(userId, date, period, holdingId IS NOT NULL)` — dùng khóa dedup có sẵn, không cần FK/index. 404 nếu snapshot không user hiện tại / là per-holding / `frozen=false`.
- **`recomputedComparison`:** suy ngược `quantity = frozenValue / historicalPrice`, nhân giá hiện tại — so sánh ảnh hưởng **giá**, không mua/bán. Thiếu giá → fallback `frozenValue`, không NaN. Ngưỡng 1 VND (VND không lẻ, đủ sensitive).
- Logic thuần tách riêng (`snapshot-history.ts`, `snapshot-recompute.ts`) để unit test không cần DB.
- Docs đã sync: `docs/domain/06-snapshots.md`, `process/phase-3.md`.

## 2026-07-16

**Issue #52: `DIVIDEND_PAR_VALUE` Setting mới; `avgCost` giữ nguyên khi STOCK dividend; SL-tại-ngày-ghi replay cả Cashflow + Dividend.**
- **`DIVIDEND_PAR_VALUE` + `DIVIDEND_TAX_RATE` đều là Setting mới** (trước #52, chỉ có `MAX_MEMBERS`); seed `effectiveFrom = 2020-01-01`: `TAX_RATE = "5"`, `PAR_VALUE = "10000"`. Không hard-code mệnh giá (Setting = runtime config).
- **`avgCost` giữ nguyên** — `recordDividend` chỉ `update({ quantity })`, KHÔNG gọi `derivePosition()`/`buildQuantityTimeline()` lại (STOCK dividend chỉ CỘNG, không "bán vượt" cần validate).
- **SL-tại-ngày-ghi:** tổng quát `derivePosition()` thành `buildQuantityTimeline()` — phát lại TOÀN BỘ Cashflow + Dividend STOCK, cộng "probe event" (`delta=0`) tại ngày ghi để đọc `.before`. Cần vì ghi cổ tức có thể lùi ngày so với giao dịch gần nhất.
- **`Dividend` không lưu `percent`** — suy ngược `percentLabel`/`quantityBefore/After` từ data + `buildQuantityTimeline()`, không thêm cột schema.
- **`recordDividend` không trigger snapshot** — chưa quyết định nghiệp vụ.
- Docs đã sync: `docs/domain/03-dividends.md`, `docs/domain/09-settings.md`, `docs/domain/01-assets-and-holdings.md`, `process/phase-4.md`.

## 2026-07-16 (2)

**Issue #52 fix: `computeStockDividend` floor `stockQuantity` + user override, tolerance 2 đơn vị.**
- Bối cảnh: `stockQuantity = quantity × percent/100` không làm tròn → số lẻ CP (vd 105 × 12% = 12.6) — vô lý.
- `computeStockDividend()` trả `{ rawStockQuantity, stockQuantity, wasRounded }`. `stockQuantity = floor(raw)` mặc định lưu DB. Thêm `stockQuantityOverride` vào schema cho phép user sửa; validate sai lệch ≤ `TOLERANCE = 2` so với raw. **Validate TRONG transaction** (sau khi có `quantityAtDate`/`rawStockQuantity` từ `holding.cashflows/dividends`), override sai → return `{ ok: false, fieldErrors }`.
- Cache `Holding.quantity` cộng `finalStockQuantity` (floor hoặc override); `avgCost` giữ nguyên.
- **Không lưu `wasRounded`/`rawAddedQuantity`** — chỉ derive trong `DividendRecordedResult` để display cảnh báo.
- Docs đã sync: `docs/domain/03-dividends.md`.

## 2026-07-16 (3)

**Thêm Phase 7 — Trái tức (lãi trái phiếu) vào roadmap, ngoài trình tự ưu tiên gốc.**
- Bối cảnh: `docs/domain/03-dividends.md` mục "Ca biên" từ đầu đã cố tình để ngỏ "cổ tức của trái phiếu... xử lý cụ thể khi làm Phase liên quan" — Phase 4 (đã ✅ xong) chỉ scope cổ tức tiền mặt/cổ phiếu cho STOCK/FUND, không bao gồm lãi trái phiếu (công thức khác: coupon rate × mệnh giá theo kỳ, không phải `% × parValue` cố định).
- Quyết định: tạo **Phase 7** mới (`process/phase-7.md`, thêm dòng roadmap `docs/03-roadmap.md`) thay vì gộp vào Phase 4 đã đóng hoặc để mãi trong Backlog không phase — vì đây là việc đủ lớn (mở rộng schema + Server Action + UI) để cần theo dõi như một phase riêng, nhưng không thuộc trình tự ưu tiên gốc (chỉ làm khi có nhu cầu, không chặn Phase 5/6).
- Chia 3 issue qua `issue-breakdown`, thứ tự: **Schema & Setting** (không phụ thuộc) → **Design & UI** (mở rộng `DividendForm` có sẵn, dùng mock cho field mệnh giá/coupon rate mới, chạy song song Schema) → **Server Action + tính toán** (phụ thuộc cả 2, cần Props contract thật từ UI + bảng đã migrate từ Schema).
- **Điểm cố ý chưa chốt, để ngỏ cho issue lúc implement quyết định** (không tự chọn thay): (1) mệnh giá/coupon rate nhập tay mỗi lần ghi (nhất quán cách cổ tức tiền mặt `percent` hiện đã hoạt động) hay lưu cố định trên `Holding` — đề xuất mặc định "nhập tay mỗi lần" vì mỗi trái phiếu mệnh giá khác nhau, không có Setting mặc định dùng chung hợp lý như `DIVIDEND_PAR_VALUE` của cổ phiếu; (2) thuế lãi trái phiếu dùng chung `DIVIDEND_TAX_RATE` hay cần `Setting` key riêng (`docs/domain/07-tax.md` mục "Ca biên" đã ghi mức thuế là "điểm còn mở" từ Phase 1, chưa nói riêng về trái phiếu).
- Docs đã sync: `docs/03-roadmap.md` (mục Phase 7), `process/PROCESS.md` (bảng trạng thái + nhật ký), `process/phase-7.md` (mới).

## 2026-07-16 (4)

**Issue #59: `derivePosition()` một mình không đủ khi Holding từng nhận cổ tức cổ phiếu — thêm `derivePositionIncludingStockDividends()`, dùng ở 4 action mua/bán + `getHoldingDetail()`.**
- Bối cảnh: viết e2e cho issue #52 phát hiện trang chi tiết vị thế hiện sai SL sau khi nhận cổ tức cổ phiếu. Đào sâu hơn phát hiện phạm vi rộng hơn ban đầu tưởng: không chỉ `getHoldingDetail()` (display sai) mà cả 4 action ghi giao dịch (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`, `features/holdings/actions.ts`) đều gọi `derivePosition()` (chỉ biết `Cashflow`) rồi **ghi đè toàn bộ** cache `Holding.quantity`/`avgCost` qua `persistPosition()` — mỗi lần mua/bán/sửa/xoá SAU khi nhận cổ tức cổ phiếu sẽ **xoá mất** phần SL cổ tức đã cộng trước đó (không chỉ hiển thị sai, mà mất dữ liệu cache thật). Đồng thời `wentNegative` (cờ "bán vượt") cũng tính từ Cashflow-only, có thể **chặn nhầm một lệnh bán hợp lệ** khi SL bán nằm trong phần cổ tức cổ phiếu đã nhận (không phải mua).
- Quyết định: thêm `derivePositionIncludingStockDividends(cashflows, stockDividends)` (`lib/cost-basis.ts`) — kết hợp `avgCost` từ `derivePosition()` (giữ nguyên không đổi, chỉ dẫn xuất từ `Cashflow`, cổ tức cổ phiếu không đổi avgCost) với SL/`wentNegative` phát lại đúng thứ tự thời gian gồm cả `Dividend{STOCK}` qua `buildQuantityTimeline()`. **`derivePosition()` giữ nguyên không đổi** (vẫn đúng/đủ riêng cho `avgCost`, unit test cũ không cần sửa) — tránh rủi ro đổi hàm đã có test suite lớn bao phủ.
- **Di chuyển `buildQuantityTimeline()`/`PositionTrailEvent` từ `features/dividends/position-trail.ts` ra `lib/position-trail.ts`** (`docs/rules/project-structure.md`: "chỉ đẩy lên `lib/` chung khi thực sự tái dùng ở nhiều feature") — giờ dùng chung cả `features/holdings/` (qua `cost-basis.ts`) lẫn `features/dividends/` (giữ nguyên 2 chỗ dùng cũ, chỉ đổi đường import).
- **Giao dịch ĐANG XỬ LÝ (chưa lưu DB) dùng `id: "__candidate__"` + `createdAt` = mốc xa nhất có thể** (`CANDIDATE_CREATED_AT`, cùng pattern `PROBE_CREATED_AT` của `dividends/actions.ts`) khi đưa vào `buildQuantityTimeline()` — đảm bảo LUÔN được coi là sự kiện gần nhất khi trùng ngày với cashflow/dividend đã ghi trước đó.
- **Đồng ý (chủ động, không tự chốt thay) chấp nhận giới hạn:** tie-break cùng ngày giữa Cashflow và Dividend dựa vào `createdAt` thật (độ chính xác cấp mili-giây) — không có ca biên thực tế nào trong app cần chính xác hơn (domain chỉ nói "ngày", không nói "giờ trong ngày").
- **Không viết migration backfill dữ liệu cũ** — app chưa có user thật ngoài dev/test (phi thương mại, mới ở Phase 4), không có Holding nào bị ảnh hưởng thật ngoài môi trường phát triển.
- **Bài học ghi vào `docs/rules/data-prisma.md`** (mục "Materialized cache…"): khi thêm một NGUỒN GHI MỚI cho giá trị đã materialize (ở đây: cổ tức cổ phiếu ghi thêm vào `Holding.quantity`), phải rà **toàn bộ nơi recompute/derive lại giá trị đó** — không chỉ nơi vừa thêm nguồn ghi mới, mà cả các nơi ghi/đọc CŨ đã tồn tại từ trước (4 action mua/bán, 1 query display) mà giờ đã lỗi thời vì không biết nguồn ghi mới.
- Docs đã sync: `docs/domain/01-assets-and-holdings.md` (mục "Cách tính"), `docs/domain/02-transactions-and-cost-basis.md` (mục "Quy tắc & bất biến" + "Cách tính"), `docs/domain/03-dividends.md` (sửa đường dẫn `position-trail.ts`), `docs/rules/data-prisma.md` (mục "Materialized cache…", thêm "Ca thật đã xảy ra").

## 2026-07-17

**Issue #61 (follow-up nhỏ của Phase 4): `recordDividend` tự tạo `NavOverride` bù pha loãng NAV; thêm `Dividend.paymentDate` (thuần thông tin).**
- Bối cảnh: `STOCK` dividend cộng `Holding.quantity` NGAY khi ghi nhưng giá (`PriceQuote`/`NavOverride`) chưa đổi kịp → NAV vị thế bị thổi phồng tạm thời tới khi có giá mới. `CASH` dividend cũng lệch giá theo hướng ngược lại (tiền rời khỏi vốn công ty, giá ex-dividend thường giảm tương ứng ngoài thị trường thật nhưng hệ thống chưa phản ánh).
- Quyết định: thêm 2 hàm thuần `computeStockDividendPriceAdjustment`/`computeCashDividendPriceAdjustment` (`features/dividends/dividend-math.ts`) và gọi trong `recordDividend` TRƯỚC `tx.dividend.create`, ghi `NavOverride` **tại `date`** (ngày chia, KHÔNG phải `paymentDate` mới thêm) qua `upsert` theo `(holdingId, date)` đã có sẵn. Đọc giá cũ TRONG transaction bằng `tx.navOverride.findFirst`/`tx.priceQuote.findFirst` (KHÔNG dùng `getLatestNavOverrides`/`getLatestPriceQuotes` của `lib/valuation.ts` — 2 hàm đó đọc `db` ngoài transaction + `unstable_cache`, không an toàn với race của transaction ghi cổ tức), nhưng vẫn TÁI DÙNG `resolvePrice()` (hàm thuần, không phụ thuộc nguồn đọc) để không lặp lại logic ưu tiên giá.
- **`priceAlreadyReflectsMarket`** (field mới trong `recordDividendSchema`, KHÔNG lưu vào `Dividend`): cờ để user tắt hoàn toàn bước tự điều chỉnh khi biết giá hiện có đã đúng. Submit qua hidden input chuỗi `"true"/"false"` — dùng `z.enum(["true","false"]).transform()`, KHÔNG dùng `z.coerce.boolean()` (coi mọi string non-empty kể cả `"false"` là `true`).
- **`Dividend.paymentDate` (mới, optional, `DateTime` không `@db.Date`** khớp kiểu `date` hiện có cùng model**)**: ngày tiền/CP thực về tài khoản — THUẦN THÔNG TIN, không dùng cho bất kỳ tính toán nào (không XIRR, không quantity timeline, không phải mốc ghi `NavOverride` — luôn ghi tại `date`).
- **Không clamp giá điều chỉnh âm/0** — chưa chốt spec cho ca biên này (để ngỏ, ghi comment trong code).
- **Không xử lý MISSING_PRICE** khác gì bình thường — bỏ qua bước tạo `NavOverride`, dividend vẫn ghi thành công.
- **UI (checkbox `priceAlreadyReflectsMarket`, input `paymentDate`) do `design-implementer` làm riêng ngay sau đó** — kéo lại mockup Figma mới (`Phase 4 Screens.dc.html`, bản cập nhật cho issue #61) qua DesignSync thay vì dùng cache cũ trước Phase 4, sửa `DividendForm.tsx` bind đúng contract `business-implementer` đã chuẩn bị. e2e cho ca "tick checkbox" đã đổi từ inject `page.evaluate()` sang tương tác checkbox thật (`getByRole("checkbox")`) khi `verifier` kiểm chứng lại.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức" mới, cập nhật Entity/field), `docs/domain/04-pricing-and-valuation.md` (thêm dòng cross-reference ở "Ca biên"), `docs/02-data-model.md` (field `paymentDate` trong snippet `Dividend`).

## 2026-07-17 (2)

**Đóng quyết định treo từ #52: ghi cổ tức KHÔNG tự trigger `Snapshot{period: MANUAL}` (khác mua/bán).**
- Bối cảnh: mọi giao dịch mua/bán (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`) tự gọi `freezeManualSnapshot()` sau khi commit — đóng băng một mốc `Snapshot{date: hôm nay, period: MANUAL}`. `recordDividend` không làm việc này, để ngỏ từ Phase 4 (#52) như một quyết định nghiệp vụ chưa chốt; issue #61 (bù pha loãng NAV) không đụng tới.
- Quyết định: **giữ nguyên — không trigger.** Lý do: mua/bán là quyết định phân bổ vốn thật (tiền vào/ra), NAV danh mục thực sự đổi — đóng một mốc ngay sau đó tách bạch được "NAV đổi vì giao dịch" khỏi "NAV đổi vì giá thị trường". Ghi cổ tức thì ngược lại: cơ chế `NavOverride` bù pha loãng (#61) được thiết kế **cố tình giữ NAV gần như liên tục** qua sự kiện chia cổ tức (STOCK: SL tăng, giá giảm tương ứng, tổng giá trị bất biến; CASH: giá ex-dividend giảm đúng bằng phần gross rời khỏi vốn, NAV cũng gần bất biến — cổ tức nhận về chỉ sống trong dòng tiền XIRR, không phải một tài sản Navtrack theo dõi số dư). Một Snapshot MANUAL đóng ngay sau ghi cổ tức gần như sẽ trùng số với mốc gần nhất (chỉ lệch do làm tròn floor SL cổ phiếu), không mang thêm thông tin, trong khi tạo thêm nhiễu ở "Các mốc đã chốt" (UI hiện chỉ có 1 badge "THỦ CÔNG" chung cho mọi trigger MANUAL — user dễ nhầm là một giao dịch thật đã xảy ra ngày đó).
- Ca biên đã cân nhắc: khi `MISSING_PRICE` (không có giá cũ để bù), NAV có thể lệch thật do SL tăng "chay" không giá đi kèm — nhưng đúng lúc này Snapshot cũng tự bỏ qua Holding đó (không resolve được giá, theo rule ở `06-snapshots.md`), nên trigger snapshot cũng không cứu được ca này.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức", bỏ khung "quyết định treo", ghi rõ đã chốt + lý do).
