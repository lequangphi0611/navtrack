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

**Issue #59: `derivePosition()` cũ (chỉ-Cashflow, đã xoá — xem 2026-07-24 (4)) một mình không đủ khi Holding từng nhận cổ tức cổ phiếu — thêm hàm mới xử lý cả cổ tức cổ phiếu (`derivePositionIncludingStockDividends()`, sau đổi tên thành `derivePosition()` ở 2026-07-24 (4)), dùng ở 4 action mua/bán + `getHoldingDetail()`.**
- Bối cảnh: viết e2e cho issue #52 phát hiện trang chi tiết vị thế hiện sai SL sau khi nhận cổ tức cổ phiếu. Đào sâu hơn phát hiện phạm vi rộng hơn ban đầu tưởng: không chỉ `getHoldingDetail()` (display sai) mà cả 4 action ghi giao dịch (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`, `features/holdings/actions.ts`) đều gọi `derivePosition()` cũ (chỉ biết `Cashflow`) rồi **ghi đè toàn bộ** cache `Holding.quantity`/`avgCost` qua `persistPosition()` — mỗi lần mua/bán/sửa/xoá SAU khi nhận cổ tức cổ phiếu sẽ **xoá mất** phần SL cổ tức đã cộng trước đó (không chỉ hiển thị sai, mà mất dữ liệu cache thật). Đồng thời `wentNegative` (cờ "bán vượt") cũng tính từ Cashflow-only, có thể **chặn nhầm một lệnh bán hợp lệ** khi SL bán nằm trong phần cổ tức cổ phiếu đã nhận (không phải mua).
- Quyết định: thêm `derivePositionIncludingStockDividends(cashflows, stockDividends)` (`lib/cost-basis.ts`) — kết hợp `avgCost` từ `derivePosition()` cũ (giữ nguyên không đổi, chỉ dẫn xuất từ `Cashflow`, cổ tức cổ phiếu không đổi avgCost) với SL/`wentNegative` phát lại đúng thứ tự thời gian gồm cả `Dividend{STOCK}` qua `buildQuantityTimeline()`. **`derivePosition()` cũ giữ nguyên không đổi** (vẫn đúng/đủ riêng cho `avgCost`, unit test cũ không cần sửa) — tránh rủi ro đổi hàm đã có test suite lớn bao phủ. (Về sau, ở 2026-07-24 (4), `derivePosition()` cũ bị xoá hẳn và `derivePositionIncludingStockDividends()` chiếm lại tên đó.)
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

## 2026-07-17 (3)

**Thảo luận nghiệp vụ Phase 5 (thuế bán) trước khi implement — chốt 3 điểm, để ngỏ 2 điểm sang lúc implement/Phase 7.**
- Bối cảnh: trao đổi với user (vai chuyên gia tài chính cá nhân) để soát bất cập spec `docs/domain/07-tax.md`/`process/phase-5.md` trước khi giao việc cho `planner`/`dev-cycle`. Phát hiện: (1) `TransactionForm.tsx` từ Phase 1 có sẵn field "Thuế" nhập tay tự do cho **cả BUY lẫn SELL**, nhưng Phase 5 dự định tự động tính thuế — chưa có quyết định UI rõ ràng; (2) VN không đánh thuế TNCN khi mua chứng khoán — field thuế trên BUY vốn dĩ sai bản chất; (3) `SALE_TAX_GOLD` là "điểm còn mở" từ Phase 1 chưa chốt mức; (4) mô hình thuế-khi-bán generic áp cho mọi `SELL` không phân biệt được "đáo hạn trái phiếu" (không phải chuyển nhượng, không chịu thuế) với "bán trước hạn" (chịu thuế 0.1%).
- **Quyết định (1) — SELL: tự tính prefill, KHÔNG khoá field.** `taxAmount` tự resolve từ `SALE_TAX_<loại>` tại ngày bán, hiển thị làm giá trị mặc định trên form, nhưng người dùng sửa tay được — giống cơ chế `NavOverride` (giá trị tự động là gợi ý, không phải nguồn sự thật duy nhất), để khớp đúng số thực trừ trên sao kê CTCK khi có lệch làm tròn.
- **Quyết định (2) — BUY: bỏ hẳn field thuế khỏi form.** `taxAmount` luôn `= 0` cho `Cashflow{type: BUY}`, không có input — đúng bản chất thuế VN (không có thuế khi mua).
- **Quyết định (3) — `SALE_TAX_GOLD` seed `= 0`.** Cá nhân bán vàng miếng/trang sức tại VN không chịu thuế TNCN chuyển nhượng (khác chứng khoán/CCQ). Vẫn phải seed dòng `Setting` tường minh (không được để thiếu — nguyên tắc "thiếu cấu hình → báo lỗi" của `09-settings.md` áp dụng cả khi mức thuế là 0).
- **Để ngỏ (chưa chốt, không tự chọn thay):**
  - Đáo hạn trái phiếu (nhận lại gốc, không phải chuyển nhượng) vs bán trước hạn (chịu `SALE_TAX_BOND` 0.1%) — user hiện chỉ giữ trái phiếu tới đáo hạn, không bán thứ cấp, nên **chưa xử lý ở Phase 5**; dời bàn kỹ sang Phase 7 (đã thêm vào `process/phase-7.md` mục "Phụ thuộc / ghi chú" điểm (4)).
  - Sửa một SELL đã ghi (đổi ngày/giá) có tính lại `taxAmount` theo ngày mới hay giữ nguyên giá trị cũ (có thể đã bị sửa tay theo (1)) — chưa chốt, cần quyết định lúc implement.
- Docs đã sync: `docs/domain/07-tax.md`, `docs/domain/09-settings.md`, `docs/domain/02-transactions-and-cost-basis.md`, `process/phase-5.md`, `process/phase-7.md`.

## 2026-07-17 (4)

**Thêm tính năng mới "Chi phí ăn mòn" (cost drag) vào Phase 5 — tổng thuế + phí luỹ kế, % trên vốn đã bỏ vào.**
- Bối cảnh: tiếp tục thảo luận nghiệp vụ Phase 5, user chọn hiện thực hoá ngay ý tưởng "tổng chi phí thuế + phí đã trả từ đầu" (một trong 3 ý tưởng gợi ý ngoài roadmap) — trả lời câu hỏi gốc của `business-overview.md`: Sheet cũ không cho biết chi phí giao dịch đã ăn vào lợi nhuận bao nhiêu.
- **Phạm vi (đã hỏi user, chọn phương án gộp cả 3 nguồn):** `Σ Cashflow.taxAmount` (thuế bán, Phase 5) + `Σ Cashflow.feeAmount` (phí, có từ Phase 1) + `Σ Dividend.taxAmount` (thuế cổ tức tiền mặt, có từ Phase 4) — không giới hạn riêng trong dữ liệu mới của Phase 5 để con số phản ánh đúng tổng chi phí thật.
- **Mẫu số % (đã hỏi user, chọn "vốn đã bỏ vào"):** ~~tái dùng `totalInvested` đã có sẵn trong `lib/portfolio-valuation.ts`~~ **→ ĐÃ SỬA ở 2026-07-17 (6): dùng `grossInvested` (vốn gộp) thay vì `totalInvested` (vốn ròng), vì vốn ròng vỡ khi đã bán nhiều.** Xem entry (6) bên dưới.
- **Vị trí UI (đã hỏi user, chọn dòng phụ):** một dòng ghi chú nhỏ dưới card lãi/lỗ hiện có (`ReturnMetrics` trong `DashboardScreen.tsx`) — KHÔNG dựng card/tile riêng, giữ phạm vi UI của Phase 5 gọn (chỉ sửa component có sẵn, không thêm component mới).
- **Không phải chỉ số hiệu suất riêng, không đưa vào XIRR** — XIRR đã tự phản ánh chi phí này qua dòng tiền thực rồi; đây chỉ là phần diễn giải thêm cho lãi/lỗ.
- **Không cần schema/model mới** — mọi field cần đều đã tồn tại (`Cashflow.taxAmount/feeAmount`, `Dividend.taxAmount`), chỉ cần một hàm tổng hợp (business-implementer) + một dòng UI (design-implementer, mở rộng component có sẵn không cần mockup mới lớn). Mẫu số `grossInvested` tính thêm từ chuỗi `Cashflow` (xem (6)).
- Docs đã sync: `docs/domain/07-tax.md` (mục "Chi phí ăn mòn" mới), `docs/domain/05-returns-xirr-and-pnl.md` (cross-reference), `docs/03-roadmap.md` (Phase 5), `docs/business-overview.md` (mục 5), `process/phase-5.md`.

## 2026-07-17 (5)

**Thêm 2 ý tưởng còn lại vào roadmap: "Cảnh báo tập trung" (Phase 6) và "Lịch dòng tiền sắp tới" (Phase 8 mới) — cùng đảo quyết định treo Phase 7 (1).**
- Bối cảnh: tiếp tục danh sách 3 ý tưởng gợi ý ngoài roadmap ban đầu (idea 1 — chi phí ăn mòn — đã vào Phase 5 ở quyết định trên). User xác nhận đưa nốt idea 2 (cảnh báo tập trung) và idea 3 (lịch dòng tiền) vào domain docs + roadmap + phase-x.
- **Cảnh báo tập trung (Phase 6):**
  - **Phạm vi (đã hỏi user, chọn theo Holding):** cảnh báo theo từng `Holding` riêng lẻ, KHÔNG theo `AssetType` nhóm — sát rủi ro thực tế hơn dù `AllocationBar` theo nhóm đã có sẵn dễ tái dùng hơn.
  - **Ngưỡng (đã hỏi user):** 30%, cấu hình qua `Setting{CONCENTRATION_WARNING_THRESHOLD}` (group mới `RISK`) — user chủ động chọn "cấu hình trên Settings" thay vì hard-code, nhất quán nguyên tắc "cấu hình được, không hard-code" của `07-tax.md`.
  - Resolve `atDate = hôm nay` (không effective-dated theo giao dịch) — cùng pattern với `MAX_MEMBERS`.
  - Vị thế `MISSING_PRICE` loại khỏi tính cảnh báo (không mặc định 0%) — nhất quán nguyên tắc "thiếu giá không mặc định 0".
  - Docs: `docs/domain/04-pricing-and-valuation.md` (mục "Cảnh báo tập trung" mới), `docs/domain/09-settings.md`, `process/phase-6.md`, `docs/03-roadmap.md`.
- **Lịch dòng tiền sắp tới (Phase 8 mới):**
  - **Phạm vi (đã hỏi user, chọn chỉ trái phiếu):** chỉ đáo hạn + coupon trái phiếu — cố tình KHÔNG dự đoán cổ tức STOCK/FUND vì không có ngày/mức cố định theo hợp đồng, dự đoán sẽ không đáng tin.
  - **Đảo quyết định treo Phase 7 điểm mở (1)** (đã hỏi user, chọn lưu cố định trên Holding): mệnh giá/coupon rate **lưu cố định trên `Holding`** (5 field mới: `parValue`/`couponRatePercent`/`couponFrequencyMonths`/`maturityDate`/`nextCouponDate`, chỉ có ý nghĩa khi `type = BOND`) thay vì "nhập tay mỗi lần ghi" như đề xuất mặc định ban đầu của Phase 7 — cần thiết để suy ra "kỳ tới" cho Phase 8. `recordDividend` (Phase 7) đọc từ `Holding`, không hỏi lại; tự cộng `couponFrequencyMonths` vào `nextCouponDate` sau mỗi lần ghi thành công, vẫn cho user sửa tay.
  - **Phase 8 phụ thuộc chặt Phase 7** (đọc field Phase 7 thêm, không tự thêm schema) — không phải trình tự ưu tiên gốc, giống Phase 7.
  - Ước tính đáo hạn KHÔNG trừ thuế (nhất quán quyết định "đáo hạn không chịu SALE_TAX_BOND" ở `07-tax.md`); ước tính coupon hiển thị số gộp trước thuế (công thức thuế lãi trái phiếu chính xác vẫn là điểm mở của Phase 7, không tự chọn thay ở đây).
  - Docs: `docs/domain/10-cashflow-calendar.md` (file mới), `docs/domain/README.md` (index #10), `docs/domain/01-assets-and-holdings.md`, `docs/02-data-model.md` (5 field mới trên `Holding`), `process/phase-7.md` (đảo điểm mở (1)), `process/phase-8.md` (file mới), `docs/03-roadmap.md` (Phase 7 cập nhật + Phase 8 mới), `process/PROCESS.md` (bảng trạng thái + nhật ký).
- Ca biên đã cân nhắc: khi `MISSING_PRICE` (không có giá cũ để bù), NAV có thể lệch thật do SL tăng "chay" không giá đi kèm — nhưng đúng lúc này Snapshot cũng tự bỏ qua Holding đó (không resolve được giá, theo rule ở `06-snapshots.md`), nên trigger snapshot cũng không cứu được ca này.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức", bỏ khung "quyết định treo", ghi rõ đã chốt + lý do).

## 2026-07-17 (3)

**Đóng review finding #5 (PR #62): `computeCashDividendPriceAdjustment` trả `null` khi giá điều chỉnh ra âm/0.**
- Bối cảnh: `giá_mới = giá_cũ − grossAmount/SL` (nhánh CASH) là phép TRỪ nên có thể ra âm/0 thật — ca thực tế: CP giao dịch **dưới mệnh giá** (khá phổ biến ở CP nhỏ/thanh khoản thấp trên TTCK Việt Nam) kết hợp **%cổ tức cao** trên mệnh giá (một số công ty chia cổ tức đặc biệt >100% mệnh giá từ thanh lý tài sản/lợi nhuận bất thường), hoặc **nhiều đợt cổ tức liên tiếp cùng holding** dồn giá xuống dần (mỗi đợt trừ tiếp vào giá đã điều chỉnh của đợt trước). Nhánh `STOCK` KHÔNG có rủi ro này — `giá_mới = giá_cũ × SL_trước/SL_sau` là phép NHÂN với tỷ lệ luôn dương, không thể ra âm/0 trừ khi `giá_cũ` vốn đã hỏng sẵn (ngoài phạm vi tính năng này).
- **Trước fix:** `if (newPrice)` ở `recordDividend` (`features/dividends/actions.ts`) chỉ kiểm tra `newPrice !== null` — một `Decimal` instance LUÔN truthy trong JS bất kể giá trị âm/0/dương, nên giá âm/0 vẫn bị ghi thẳng vào `NavOverride` trước fix này.
- Quyết định: **xử lý giống `MISSING_PRICE`** — `computeCashDividendPriceAdjustment()` trả `null` khi kết quả `<= 0` (dùng `.gt(0)`, không dùng `.isPositive()` vì API đó có thể coi `0` dương tùy dấu nội bộ của decimal.js). Caller (`recordDividend`) không cần sửa gì thêm — `if (newPrice)` đã coi `null` = bỏ qua tạo `NavOverride`, dividend vẫn ghi thành công bình thường. Không clamp về một sàn tối thiểu (vd 1 VND) — giá trị đó không phản ánh đúng công thức bù trừ, không mang ý nghĩa tài chính thật, dễ gây hiểu nhầm hơn là hữu ích.
- Không thêm log cảnh báo riêng cho ca này — giữ nhất quán với `MISSING_PRICE` (cũng không có log riêng, xem `docs/domain/03-dividends.md` "Không xử lý MISSING_PRICE khác gì bình thường").
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức", đổi "Ca biên chưa xử lý" thành đã chốt).

## 2026-07-17 (6)

**Sửa A1: "Chi phí ăn mòn" đổi mẫu số từ `totalInvested` (vốn ròng) sang `grossInvested` (vốn gộp đã triển khai `Σ|BUY.amount|`).**
- Bối cảnh: rà soát lại nghiệp vụ dưới góc nhìn tài chính (thảo luận với user), phát hiện mẫu số `totalInvested` chốt ở (4) là **sai** cho chỉ số chi phí. `totalInvested = -(Σ Cashflow.amount + Σ Dividend.netAmount)` là **vốn ròng** — đã bị phần đã bán + cổ tức rút bớt. Khi user bán nhiều, mẫu số co lại (bán sạch → về ~0 hoặc âm) làm `costDragPercent` phình vô lý (thậm chí âm), dù chi phí thật không đổi. Ví dụ: mua 100tr, bán bớt thu 80tr → vốn ròng ~20tr; chi phí 2tr chia vốn ròng ra 10% (sai), chia vốn gộp 100tr ra 2% (đúng).
- Quyết định: **mẫu số = `grossInvested` = `Σ |Cashflow.amount|` trên các dòng `type = BUY`** (tổng tiền mặt đã chi ra để mua, gồm cả phí mua), tính tới `cutoffDate`. Lý do tài chính: chi phí ăn mòn là chi phí tích luỹ trên **hoạt động giao dịch** → mẫu số phải là vốn đã *rót vào để mua* (chỉ đi lên, không bị bán làm co) chứ không phải vốn *còn lại*. Cân nhắc turnover (Σ|BUY|+Σ|SELL|) nhưng chọn `Σ|BUY|` vì trực giác hơn với user cá nhân ("phí ăn X% số tiền tôi từng rót vào"). `grossInvested = 0` (chưa mua gì) → 0%, không chia 0.
- `totalInvested` (vốn ròng) **vẫn đúng** cho `navDeltaPercent` (lợi suất trên vốn đang làm việc) — không đụng tới chỗ đó; chỉ tách khái niệm cho riêng chi phí ăn mòn.
- Tính năng chưa implement (chỉ mới ở docs) nên đây là sửa spec, không đụng code.
- Docs đã sync: `docs/domain/07-tax.md` (công thức + ví dụ ca bán nhiều), `docs/domain/05-returns-xirr-and-pnl.md` (cross-reference), `docs/03-roadmap.md` (Phase 5), `process/phase-5.md`, cùng ghi chú đính chính ở entry (4).

## 2026-07-17 (7)

**Rà soát nghiệp vụ dưới góc nhìn tài chính — chốt A2 (sửa docs), log C1/C2/B1 thành issue để sửa sau; B2 giữ ở Backlog.**
- Bối cảnh: tiếp tục rà bất cập nghiệp vụ với user. Phân loại theo "đã phản ánh vào code hay chưa": vấn đề nằm trong code đã ship → tạo issue sửa sau; vấn đề chỉ ở spec Phase 5+ chưa code → sửa docs ngay.
- **A2 (sửa docs — spec Phase 6 chưa code):** cảnh báo tập trung dùng `NAV(danh mục)` làm mẫu số; khi danh mục còn mã `MISSING_PRICE` thì mẫu số là **NAV một phần** (`navValueIsPartial`), làm `concentrationPercent` của các mã *có giá* bị thổi phồng → báo động giả (vd FPT 180tr + trái phiếu 300tr chưa nhập giá → FPT "100%"). **Quyết định: khi `navValueIsPartial` thì TREO cảnh báo tập trung** (không kết luận trên mẫu số khuyết), kèm ghi chú cần cập nhật giá — giống cách NAV gắn dấu `*`. Chỉ tính khi NAV danh mục đầy đủ. Docs: `docs/domain/04-pricing-and-valuation.md` (mục "Cảnh báo tập trung"), `process/phase-6.md` (tiêu chí).
- **C1/C2/B1 (đã phản ánh trong code Phase 1/2/4 → log issue, sửa sau):**
  - **#65 (C1):** dòng tiền cổ tức/coupon vào XIRR đặt tại `date` (ngày chia) thay vì `paymentDate` (ngày tiền thực về) — `xirr-cashflow.ts:21`; lợi suất bị thổi nhẹ, rõ hơn với coupon trái phiếu kỳ dài. Sẽ đảo một phần quyết định #61 ("paymentDate thuần thông tin") khi làm.
  - **#66 (C2):** phí mua không gộp vào `avgCost` (`cost-basis.ts:54`) → "lãi đã thực hiện" per-lot hơi cao hơn thực. Hai hướng (A gộp phí vào cost basis / B giữ + sửa nhãn), chốt lúc implement.
  - **#67 (B1):** lãi/lỗ tuyệt đối gộp chung đã-thực-hiện vs chưa-thực-hiện (`portfolio-valuation.ts`) — đề xuất tách, gộp làm ở Phase 6, phụ thuộc C2.
- **B2 (benchmark lãi suất tiết kiệm):** đã nằm ở Backlog (`docs/03-roadmap.md`) — đây là câu hỏi gốc của `business-overview.md` ("có hơn gửi tiết kiệm không?"). Không tạo issue trùng; nếu muốn kéo lên phase gần thì sửa roadmap (chưa làm, chờ user quyết).

## 2026-07-18

**Bề mặt preview component dev-only + Playwright MCP — để `design-implementer` tự soi UI thay vì dựng mù.**
- Bối cảnh: `design-implementer` dựng Presentational không thấy được thành phẩm, tệ nhất với component design-first chưa wire vào route nào.
- Cấu trúc: `src/app/preview/<slug>/page.tsx` render component cô lập + sample props (import component thật, cấm chép markup). Soi qua Playwright MCP (`.mcp.json` → `scripts/playwright-mcp.mjs`). **Việc soi/chụp là của orchestrator (`dev-cycle`/main context), KHÔNG phải subagent** — ảnh chụp bên trong subagent kẹt lại đó, không tới được user; orchestrator chụp rồi `SendUserFile` để user thấy bằng chứng thật.
- **Footgun (đã trả giá khi làm):** chặn production **ở `src/proxy.ts` (trả 404 TRƯỚC khi route render)**, KHÔNG dùng `notFound()` trong page/layout — `notFound()` vẫn để Next render page rồi **nhúng markup vào payload RSC ở body 404** → lộ nội dung. Mẹo `pageExtensions` đuôi `.dev.tsx` **không dùng được** cho App Router/Turbopack (resolver khớp `tsx` trước, coi `page.dev` ≠ `page`). `force-dynamic` ở `preview/layout.tsx` để không prerender tĩnh (khỏi sinh HTML chứa sample markup trong build output).
- **Bất biến:** soi UI **không phải cổng verify** — e2e suite + unit test vẫn là source of truth (soi chỉ self-check lúc author). Chạy được cả Cloud lẫn Local vì component cô lập không cần Docker/DB (khác e2e — xem `TOOLS.md`). Trên Cloud, wrapper ép `--executable-path /opt/pw-browsers/chromium` (revision lệch sẽ fail launch).
- Docs sync: `docs/rules/component-architecture.md` (mục "Bề mặt preview" + quy tắc viết preview page), `docs/rules/testing.md`, `TOOLS.md` (dòng "Soi UI component qua browser"), `.claude/agents/design-implementer.md`, `.claude/skills/dev-cycle/SKILL.md`, `CLAUDE.md`.

**`design-fetcher`: owner DUY NHẤT kéo mockup Claude Design, front-load digest cho cả chuỗi.**
- Bối cảnh: `design-implementer` tự kéo DesignSync lúc implement → mọi khâu chạy trước (`planner`, `issue-breakdown`) đều mù, không biết phase có mấy màn/component/state.
- Quyết định: tách agent `design-fetcher` chạy ĐẦU phase, là nơi **duy nhất** gọi DesignSync + ghi `.claude/design-cache/`; sinh digest `process/UI_phase_N.md` (màn → component → atom tái dùng → Props phác thảo). `design-implementer` thành **người đọc** (bỏ `DesignSync`/`ToolSearch` khỏi tools), chỉ firm up phần Props khi component thật ra đời. `planner`/`issue-breakdown`/`business-implementer` đều đọc digest.
- **Bất biến:** file mockup để kéo **do user/caller chỉ định**, `design-fetcher` KHÔNG tự suy từ số phase (`Phase {N} Screens.dc.html` chỉ là quy ước tên tham khảo); chưa rõ thì `list_files` báo lại cho người gọi chọn, không tự đoán.
- Docs sync: `.claude/agents/design-fetcher.md` (mới), `design-implementer.md`, `planner.md`, `business-implementer.md`, `.claude/skills/{dev-cycle,issue-breakdown}/SKILL.md`, `CLAUDE.md`.
- **Footgun phát hiện sau (2026-07-18):** `DesignSync` là deferred tool — nạp qua `ToolSearch` gắn với phiên hiện tại, **không lan xuống subagent** được spawn qua Agent tool dù `.claude/agents/design-fetcher.md` liệt kê `DesignSync` trong `tools`. `design-fetcher` chạy như subagent độc lập bị chặn hoàn toàn ở bước gọi `DesignSync` (mọi `ToolSearch` từ subagent đều trả "No matching deferred tools found"). Xử lý tạm: phiên chính tự gọi `DesignSync` thay khi subagent báo bị chặn — phá vỡ tạm thời bất biến "duy nhất design-fetcher gọi DesignSync". Đã log issue riêng để theo dõi/fix hạ tầng (xem GitHub issue tương ứng, tạo qua `issuer`).

## 2026-07-18 (2)

**Thảo luận đối chiếu mockup Phase 5 thật (`Phase 5 Screens.dc.html`, 6 màn 5a-5f) trước khi implement — chốt 2 điểm còn mở, mở rộng phạm vi UI theo mockup.**
- Bối cảnh: `design-fetcher` kéo mockup Phase 5 lần đầu (chưa có trong cache), sinh digest `process/UI_phase_5.md`. Đối chiếu với `process/phase-5.md`/`docs/domain/07-tax.md` phát hiện mockup giải quyết luôn 1 điểm mở cũ + mở rộng phạm vi 2 chỗ so với mô tả hiện có. Đã hỏi lại user xác nhận từng điểm (không tự chọn thay).
- **Quyết định (1) — sửa một SELL đã ghi: TÍNH LẠI thuế theo ngày mới, không giữ nguyên giá trị cũ.** Đóng điểm mở ghi ở `docs/domain/07-tax.md` (mục "Ca biên") và quyết định 2026-07-17 (3). Đổi **ngày** bán của một SELL đã ghi → form tự resolve lại `SALE_TAX_<loại>` tại ngày mới (effective dating), hiển thị giá trị cũ (gạch ngang) cạnh giá trị mới tính lại + tên `Setting`/ngày hiệu lực áp dụng (mockup 5f). Giá trị tính lại vẫn **sửa tay được** sau đó — không tự khôi phục một giá trị user từng tự sửa tay trước đó (không có cách phân biệt "giá trị cũ do auto-tính" với "giá trị cũ do user tự sửa" trong dữ liệu hiện có).
- **Quyết định (2) — giữ sheet chi tiết "chi phí ăn mòn" trong Phase 5 (mở rộng so với mô tả cũ).** `process/phase-5.md` trước đây chỉ mô tả "một dòng phụ tĩnh" (quyết định 2026-07-17 (4)); mockup 5e vẽ thêm một bottom sheet mở từ dòng phụ đó, breakdown đúng 3 nguồn đã có sẵn trong công thức `costDragAmount` (phí giao dịch / thuế bán / thuế cổ tức) kèm % đóng góp mỗi nguồn + stacked bar. User chọn làm luôn trong Phase 5 thay vì cắt bớt — không cần field/hàm tổng hợp mới, chỉ là một cách trình bày khác của 3 con số đã tính.
- **Quyết định (3) — cấu trúc lại `ReturnMetrics`/card lãi-lỗ Dashboard, ghi rõ trong `phase-5.md` thay vì để design-implementer tự quyết lúc code.** Mockup 5d tách card lãi/lỗ (thực nhận) thành card đứng riêng full-width (có footer "Chi phí ăn mòn" tappable) khỏi hàng 2 cột XIRR; hàng 2 cột mới ghép "XIRR (sau thuế)" với chỉ số **mới** "Vốn đã bỏ ra mua" (hiển thị trực tiếp `grossInvested`, khác `ReturnMetrics` hiện tại là 2 cột XIRR+PnL cạnh nhau). Khác tiền lệ Phase 4 (để design-implementer tự bám mockup, ghi lại ở "điểm lệch so với plan" sau khi xong) — lần này ghi rõ trước trong `phase-5.md` vì đây là thay đổi cấu trúc component có sẵn (`src/components/ReturnMetrics`), không phải component mới.
- **Chốt phụ:** nhãn "Lãi/lỗ (thực nhận)" — bỏ chữ "cân nhắc" trong `phase-5.md` cũ, dùng cố định (mockup nhất quán ở mọi màn 5a-5d).
- Docs đã sync: `docs/domain/07-tax.md` (mục "Ca biên" + "Chi phí ăn mòn"), `process/phase-5.md` (Công việc cần làm + Tiêu chí hoàn thành), `process/UI_phase_5.md` (mới, digest tiền-triển khai).

## 2026-07-18 (3)

**Issue #76 — chốt hướng fix chính thức: chuyển trách nhiệm gọi `DesignSync` từ subagent `design-fetcher` sang orchestrator (main context).**
- Bối cảnh: footgun ghi ở entry 2026-07-18 phía trên (`design-fetcher` chạy như subagent độc lập không gọi được `DesignSync` — `ToolSearch` từ subagent luôn trả "No matching deferred tools found") mới chỉ có "xử lý tạm" (phiên chính tự gọi thay khi subagent báo bị chặn). Đã cân nhắc phương án "biến `design-fetcher` thành Skill" (chạy trong chính context gọi, né được vấn đề vì Skill không spawn session mới) nhưng loại bỏ: `get_file` có thể trả tới 256KB/file, chạy như Skill sẽ đổ thẳng raw HTML vào context của phiên điều phối (`dev-cycle`/`issue-breakdown`), làm phình context các bước sau chạy chung phiên (`planner`, `business-implementer`...) — đúng thứ mà kiến trúc "agent riêng, chỉ trả digest cô đọng" đang cố tránh.
- **Quyết định:** giữ nguyên `design-fetcher` là **agent** (không đổi sang Skill), nhưng đổi **ai** gọi `DesignSync`: orchestrator (phiên chính khi user gọi trực tiếp, hoặc `dev-cycle`/`issue-breakdown` khi điều phối tự động — luôn chạy ở main context có `DesignSync`) tự `ToolSearch select:DesignSync` → `list_files`/`get_file` → `Write` raw HTML ra `.claude/design-cache/raw/` + entry cơ bản (`designFile`, `cachedAt`) vào `index.json` **TRƯỚC KHI** spawn `design-fetcher`. `design-fetcher` bỏ `DesignSync`/`ToolSearch` khỏi `tools:`, chỉ `Read` raw cache đã có sẵn trên đĩa (không qua text response/prompt) để chưng cất digest — giữ nguyên cách ly context của kiến trúc multi-agent, không cần platform hỗ trợ gì thêm.
- Prompt spawn `design-fetcher` giờ **bắt buộc** kèm đường dẫn raw cache đã fetch; thiếu đường dẫn → `design-fetcher` dừng và báo lỗi lại người gọi (lỗi ở orchestrator chưa fetch trước, không tự đoán/tự gọi vì không còn tool đó).
- Docs đã sync: `.claude/agents/design-fetcher.md` (bỏ `DesignSync`/`ToolSearch` khỏi `tools`, đổi toàn bộ mô tả "Đầu vào"/"Nguồn mockup"/"Cache local"/"Quy trình"), `.claude/skills/dev-cycle/SKILL.md` (Bước 0b), `.claude/skills/issue-breakdown/SKILL.md` (Bước 1 mục 7).

## 2026-07-18 (4)

**Bổ sung requirement Phase 5: phí mua/bán tự tính qua `Setting` (mặc định 0.3% theo TPS), tách theo `AssetType` × chiều BUY/SELL — đồng thời đóng issue #66 (gộp phí mua vào `avgCost`).**
- Bối cảnh: `feeAmount` từ Phase 1 tới nay 100% nhập tay tự do (không auto-calc), khác hẳn `taxAmount` đã có cơ chế `SALE_TAX_<loại>` từ Phase 5. User đề xuất áp cùng cơ chế Setting cho phí, mặc định theo biểu phí CTCK đang dùng (TPS, 0.3%), vẫn override được theo từng giao dịch (phòng ca cổ phiếu/công ty khác nhau có phí khác).
- **Quyết định (1) — tách theo từng `AssetType`** (đã hỏi user, không chọn 1 key chung áp mọi loại): `TRANSACTION_FEE_<chiều>_<STOCK/FUND/BOND/GOLD>` — cùng pattern `SALE_TAX_<LOẠI>`. Lý do đề xuất ban đầu (1 key chung, chỉ áp STOCK/FUND) bị bác — user chọn tách đủ 4 loại để nhất quán với thuế, phòng trường hợp sau này BOND/GOLD cũng phát sinh phí qua kênh khác.
- **Quyết định (2) — tách riêng 2 key theo chiều mua/bán** (đã hỏi user, không dùng 1 mức chung cho cả 2 chiều dù hiện tại cùng 0.3%): `TRANSACTION_FEE_BUY_<LOẠI>` / `TRANSACTION_FEE_SELL_<LOẠI>` — tổng **8 key mới**, group `FEE`. Phòng trường hợp CTCK áp biểu phí khác nhau giữa mua và bán sau này.
- **Khác biệt so với thuế (quan trọng):** phí áp dụng cho **CẢ BUY lẫn SELL** (thuế chỉ áp SELL, VN không đánh thuế mua) — vì đây là phí công ty chứng khoán thu trên mỗi lệnh khớp, không phải thuế TNCN do luật quy định. Cùng UX prefill-nhưng-sửa-được như thuế (không khoá field).
- **Quyết định (3) — đóng issue #66 (đang treo từ 2026-07-17 (4)):** chọn **hướng A** (gộp phí mua vào cost basis) trong 2 hướng từng để ngỏ. Lý do chốt ngay đợt này: một khi phí auto-prefill khác `0` cho MỌI giao dịch mua (thay vì thường bị bỏ trống như trước), sai số `avgCost` do bỏ sót phí sẽ lộ rõ và thường xuyên hơn hẳn — không còn hợp lý để treo tiếp. Công thức mới: `giá vốn mới = (SL cũ × giá vốn cũ + (SL mua × giá mua + phí mua)) / (SL cũ + SL mua)`. **Lãi/lỗ đã thực hiện** khi bán chỉ trừ phí/thuế **của lần bán** (phí mua đã nằm trong giá vốn bình quân, tránh trừ trùng).
- **Mức seed:** `STOCK` = `0.3%` (đã xác nhận, theo TPS). `FUND`/`BOND`/`GOLD` **chưa chốt mức** — để ngỏ, seed `0` mặc định (chưa dùng kênh tính phí % cho 2 loại BOND/GOLD hiện tại) theo đúng nguyên tắc "seed tường minh, không thiếu dòng" đã áp cho `SALE_TAX_GOLD`. Cần xác nhận lại lúc implement nếu phát sinh nhu cầu.
- **Không cần schema/migration mới** — `Setting` đã là bảng key-value generic, chỉ cần seed thêm dòng.
- Docs đã sync: `docs/domain/07-tax.md` (mục mới "Phí giao dịch (mua & bán)", cập nhật "Mục đích"/"Entity"/"Ca biên"/"Ví dụ"), `docs/domain/02-transactions-and-cost-basis.md` (công thức `avgCost` + "Lãi/lỗ đã thực hiện" + Ví dụ), `docs/domain/09-settings.md` (bảng "Các key hiện có" + Ví dụ), `process/phase-5.md` (Mục tiêu + Công việc cần làm + Tiêu chí hoàn thành + Phụ thuộc/ghi chú), `docs/02-data-model.md` (ghi chú `Setting`).

## 2026-07-18 (5)

**Chốt 4 điểm còn mở trong plan nháp Phase 5 (`process/phase-5-plan-DRAFT.md`) — trước khi implement, chưa code.**
- Bối cảnh: agent `planner` lên plan triển khai Phase 5, để lại 5 điểm cần user xác nhận (1 điểm kỹ thuật thuần do orchestrator tự quyết, không tính). Đi qua từng điểm, user chọn theo đề xuất ở cả 4.
- **(1) `SALE_TAX_BOND` = 0.1%.** Tra cứu thực tế (không suy diễn): Nghị định 253/2026/NĐ-CP + Thông tư 87/2026/TT-BTC (hiệu lực 01/07/2026) quy định thu nhập từ chuyển nhượng trái phiếu chịu thuế TNCN 0.1% trên giá chuyển nhượng mỗi lần — cùng mức và công thức với cổ phiếu/chứng chỉ quỹ, không có mức riêng cho trái phiếu. Seed `SALE_TAX_BOND = 0.1%` cùng `effectiveFrom = BASELINE_DATE`. **Không đổi** quyết định 2026-07-17 về việc đáo hạn trái phiếu (nhận gốc từ tổ chức phát hành) vẫn để ngỏ tới Phase 7 — mức 0.1% này chỉ áp cho SELL (chuyển nhượng thứ cấp), xem `docs/domain/07-tax.md` mục "Ca biên".
- **(2) Nút "Đặt lại" đồng bộ cho cả card Thuế lẫn card Phí trong `TransactionForm`.** Mockup 5a/5b chỉ vẽ nút này ở card Thuế — nhận định đó là thiếu sót lúc dựng mockup hơn là chủ đích (không có lý do nghiệp vụ để 2 card cùng cơ chế "tự điền, sửa tay" lại khác nhau ở đúng điểm này). `design-implementer` thêm nút "Đặt lại" cho cả 2 card khi implement, không chỉ bám đúng pixel mockup.
- **(3) Card "Phí giao dịch" cho màn bán Vàng hiện `0 ₫` + badge, không ẩn.** Nhất quán với tiền lệ `SALE_TAX_GOLD = 0` (quyết định 2026-07-17) vẫn hiện rõ trên UI kèm badge — tránh người dùng không phân biệt được "phí = 0 đã seed tường minh" với "màn này chưa làm phần phí". Mockup 5c hiện không vẽ card phí riêng cho vàng — đây là mở rộng nhỏ so với mockup, cùng tinh thần "seed tường minh, không âm thầm dùng 0" đã áp dụng nhất quán trong Phase 5.
- **(4) 6 key `TRANSACTION_FEE_BUY/SELL_<FUND/BOND/GOLD>` seed = 0%** (chỉ `STOCK` = 0.3%) — xác nhận lại đúng như `phase-5.md`/`docs/domain/07-tax.md` đã ghi "mặc định 0 nếu chưa dùng kênh tính phí %", không có mức thật nào khác cần áp ngay.
- **(Không hỏi, tự quyết kỹ thuật)** Gộp 1 component `AutoFilledAmountCard` dùng chung cho card Thuế/Phí thay vì viết 2 khối JSX riêng — thuần DRY, không ảnh hưởng nghiệp vụ, đúng tiền lệ tái dùng pattern `NavOverrideForm`.
- Docs đã sync: `docs/domain/07-tax.md` (mục "Ca biên" — `SALE_TAX_BOND`, mục "Phí giao dịch" — mức FUND/BOND/GOLD), `process/phase-5.md` (mục "Công việc cần làm"), `process/phase-5-plan-DRAFT.md` (mục "Quyết định còn mở" → đánh dấu đã chốt).

## 2026-07-19

**Issue #65 — mốc dòng tiền XIRR của cổ tức tiền mặt đổi từ `date` (ngày chia) sang `paymentDate ?? date` (tiền thực về, fallback `date`) — đảo một phần quyết định 2026-07-17 #61.**
- Bối cảnh: log ở entry 2026-07-17 (7) mục C1 — `buildXirrCashflows` (`lib/xirr-cashflow.ts`) ghép điểm cổ tức tại `Dividend.date` (ngày chia), trong khi `paymentDate` (ngày tiền thực về tài khoản, có thể trễ vài tuần) từ #61 chỉ để hiển thị, không dùng cho tính toán nào.
- **Quyết định:** `XirrCashflowInput.dividends` nhận thêm `paymentDate: Date | null`; điểm dòng tiền XIRR của cổ tức CASH đặt tại `paymentDate ?? date` thay vì luôn `date`. Áp dụng ở 3 nơi build input: `lib/portfolio-valuation.ts::getAllCashDividendsForXirr` (dashboard + widget XIRR toàn danh mục), `features/holdings/queries.ts::getCashDividends` (chi tiết một vị thế), `features/holdings/queries.ts::getCashDividendsForHoldings` (danh sách vị thế đang mở, batch).
- **Lý do tài chính:** XIRR quy đổi lợi suất theo thời gian (annualized) — đặt dòng tiền dương sớm hơn thời điểm tiền thực sự về tay sẽ thổi nhẹ lợi suất tính được (dòng tiền dương xuất hiện sớm hơn → nghiệm r lớn hơn thực tế). Sai số này rõ nhất với coupon trái phiếu (Phase 7/8), nơi khoảng trễ chia→trả thường dài hơn cổ tức cổ phiếu vài tuần.
- **KHÔNG đổi** 2 mốc khác vẫn dùng `Dividend.date`: mốc ghi `NavOverride` bù pha loãng (`features/dividends/dividend-math.ts`/`actions.ts`) và mốc `buildQuantityTimeline()` (`lib/position-trail.ts`, số lượng nắm giữ tại ngày chia) — cả hai gắn với **ngày chia** theo đúng bản chất nghiệp vụ (pha loãng NAV xảy ra tại ngày chia; số lượng cổ tức cổ phiếu cộng vào đúng ngày chia), không liên quan tới thời điểm tiền/CP thực về.
- Việc lọc `date <= cutoffDate` ở tầng query (3 hàm trên) **giữ nguyên theo `date`** (ngày chia) — không đổi sang lọc theo `paymentDate`, tránh vênh với "cổ tức đã ghi nhận tính tới mốc chốt" (một cổ tức chia trước cutoff nhưng `paymentDate` rơi sau cutoff vẫn được tính, chỉ lệch mốc dòng tiền trong chuỗi XIRR).
- Không đụng Prisma schema/migration — field `paymentDate` đã tồn tại từ #61.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Entity / field"), `docs/domain/05-returns-xirr-and-pnl.md` (mục "Cách tính"), `docs/02-data-model.md` (comment field `paymentDate` trong snippet `Dividend`).
- Tham chiếu: GitHub issue #65.

## 2026-07-24

**Issue #67 — tách `realizedPnl`/`unrealizedPnl` khỏi `absolutePnl` trên card "Lãi/lỗ" Dashboard; hàm tính viết mới thay vì mở rộng `derivePosition()`.**
- Bối cảnh: log 2026-07-17 (7) mục B1 để lại từ trước — user xác nhận đưa vào Phase 6 (đóng gói cùng các tính năng hoàn thiện dashboard khác) thay vì làm standalone ngoài phase, vì đây cũng chỉ là một chỉ số diễn giải thêm cho `absolutePnl` đã có (không phải chỉ số hiệu suất riêng, không đổi XIRR), tương tự tinh thần "chi phí ăn mòn" ở Phase 5.
- **(a) Không mở rộng `derivePosition()`/`CashflowInput` (`lib/cost-basis.ts`) — viết hàm thuần riêng `computeRealizedGainForHolding`/`computeUnrealizedGain` ở `lib/realized-pnl.ts`.** Lý do: `CashflowInput` hiện tại (`type/date/quantity/pricePerUnit/feeAmount`) phục vụ đúng nhu cầu ghi giao dịch (4 Server Action ở `features/holdings/actions.ts`, có test suite lớn bao phủ) — không có `taxAmount`/không cần `amount` đã materialize. Chỉ số realized/unrealized cần chính xác `Cashflow.amount` đã materialize (gồm phí mua, trừ phí+thuế bán) để khớp đúng dòng tiền XIRR, khác input `derivePosition()` cần. Mở rộng `derivePosition()` để nhét thêm nhu cầu đọc-only này sẽ buộc sửa 1 hàm nền tảng của write-path chỉ vì 1 chỉ số hiển thị — rủi ro không cần thiết. `computeRealizedGainForHolding` dùng CÙNG công thức avgCost bình quân di động (tương đương đại số, không phát minh khác đi), chỉ khác nguồn dữ liệu đầu vào (`amount.abs()` đã gồm phí thay vì `quantity*pricePerUnit + feeAmount` tách rời).
- **(b) `unrealizedPnl` dùng `quantity`/`avgCost` HIỆN TẠI (cache materialize trên `Holding`), không phải tại `cutoffDate`** — khi mốc chốt khác "hôm nay", con số không chính xác tuyệt đối. **Đây là giới hạn CÓ SẴN của toàn cơ chế cutoff trong `portfolio-valuation.ts`** (NAV toàn danh mục cũng tính theo `quantity` hiện tại của `Holding`, không phải tại cutoff) — không phải lỗi mới phát sinh từ issue #67, và **cố ý không mở rộng phạm vi sửa** vấn đề cutoff-accuracy cho quá khứ trong lần này.
- **Bất biến đã verify bằng unit test đối chiếu tay** (`src/lib/realized-pnl.test.ts`): `realizedPnl + unrealizedPnl == absolutePnl` khớp tuyệt đối (sai lệch 0 VND) trên portfolio giả lập nhiều holding (1 đã đóng SL=0, 1 bán một phần còn mở, có cổ tức tiền mặt) khi cutoff = hôm nay và không thiếu giá.
- **Không cờ `isPartial` riêng cho 2 field mới** — tái dùng `absolutePnlIsPartial`/`navValueIsPartial` đã có, vì chỉ `unrealizedPnl` bị ảnh hưởng khi thiếu giá (cùng điều kiện NAV không đầy đủ).
- **Không đổi Prisma schema** — mọi field cần (`Cashflow.holdingId/quantity/amount`, `Dividend.netAmount`, `HoldingSummary.totalCostBasis`) đã tồn tại.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" + "Cách tính"), `docs/business-overview.md` (mục 5), `process/phase-6.md` (checklist mới), `process/PROCESS.md` (Phase 6 → 🟨 + nhật ký).
- Tham chiếu: GitHub issue #67.

## 2026-07-24 (2)

**Code review PR #87 — 2 quyết định thiết kế cho fix `realizedPnl` khi có cổ tức cổ phiếu + cờ cảnh báo `pnlSplitIsApproximate`.**
- Bối cảnh: PR #87 (gộp issue #83 + #82 + #67) chưa merge, chạy code review đa góc nhìn tìm ra 9 finding. Nghiêm trọng nhất: `computeRealizedGainForHolding()` (`lib/realized-pnl.ts`) tính sai `realizedPnl` khi holding có cổ tức cổ phiếu — hàm chỉ phát lại `Cashflow` (BUY/SELL) trong khi cổ tức cổ phiếu cộng thẳng vào `Holding.quantity` mà không tạo `Cashflow` (`features/dividends/actions.ts`), đúng vấn đề issue #59 đã giải quyết ở write-path bằng `derivePosition()` (khi đó tên `derivePositionIncludingStockDividends()`).
- **(a) Quyết định thiết kế "2 bộ đếm song song" ở `computeRealizedGainForHolding` — `avgCostQuantity`/`avgCost` (CHỈ track BUY/SELL) tách riêng khỏi `realQuantity` (track CẢ BUY/SELL lẫn cổ tức cổ phiếu).** Lý do KHÔNG dùng `realQuantity` làm mẫu số cho công thức bình quân di động (averaging): sẽ pha loãng `avgCost` bởi cổ tức cổ phiếu, sai quy tắc domain đã chốt ("cổ tức cổ phiếu không đổi avgCost", `docs/domain/03-dividends.md`) và làm `avgCost` ở đây lệch khỏi `avgCost` cache thật trên `Holding` (chỉ derive từ `Cashflow`, mirror `derivePosition()`). `realQuantity` CHỈ dùng để quyết định đúng thời điểm reset `avgCost`/`avgCostQuantity` về 0 (khi vị thế THỰC SỰ đóng hết, kể cả phần số lượng đến từ cổ tức) — đổi điều kiện reset từ `avgCostQuantity.isZero()` sang `realQuantity.isZero()` là fix mấu chốt, không đổi 1 dòng công thức averaging nào khác. Verify bằng số tính tay trong `src/lib/realized-pnl.test.ts` (BUY 100 → cổ tức +20 → SELL 120 → BUY 50 → SELL 30, tổng `realizedGain` kỳ vọng 130.000; nếu không reset đúng sẽ ra avgCost lô mới 13.333,33 thay vì 12.000 đúng).
- **(b) Quyết định thêm cờ `pnlSplitIsApproximate` (thay vì sửa cơ chế cutoff-accuracy tổng thể).** Giới hạn "`unrealizedPnl` dùng `quantity`/`avgCost` HIỆN TẠI, không phải tại `cutoffDate`" đã chốt là chấp nhận được ở entry 2026-07-24 (b) phía trên (issue #67) — chỉ thêm cờ `pnlSplitIsApproximate: boolean = (selection.key !== "TODAY")` vào `XirrAndPnlCore`/`PortfolioValuation` để UI cảnh báo khi mốc chốt khác hôm nay, KHÔNG mở rộng phạm vi sửa cutoff-accuracy trong lần này (vẫn ngoài phạm vi, cùng lý do đã ghi ở (b) phía trên).
- Đồng thời dọn 3 trùng lặp/lệch nhỏ tìm được cùng đợt review: tách `sortByPositionTrailOrder()` (`lib/position-trail.ts`) dùng chung giữa `buildQuantityTimeline()` và `computeRealizedGainForHolding()` (tiebreak `(date, createdAt, id)` nhất quán toàn repo); `getAllCashflowsForXirr()` thêm `orderBy`/`id`/`createdAt` cho đúng tiebreak khi group theo holding; tách `paginateWithCursor()` (`lib/snapshot-history.ts`) dùng chung cho `getSnapshotHistory()`/`getMoreSnapshotHistory()` (trước đó lặp lại y hệt khối peek `LIMIT+1`/tính `hasMore`/`nextCursor`), đồng thời bỏ field `hasMore` dư thừa khỏi kiểu trả về của `getSnapshotHistory()` (không consumer nào khác cần ngoài `nextCursor !== null`).
- Không sửa `derivePosition()` cũ / `CashflowInput` / `derivePositionIncludingStockDividends()` (`lib/cost-basis.ts`) hay 4 Server Action ghi giao dịch (`features/holdings/actions.ts`) — giữ nguyên quyết định 2026-07-24 (a) ở entry issue #67 phía trên, chỉ sửa lớp đọc (`lib/realized-pnl.ts`).
- Không đổi Prisma schema — mọi field cần (`Cashflow.id/createdAt`, `Dividend.id/createdAt/stockQuantity`) đã tồn tại.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" — 2 gạch đầu dòng mới), `process/PROCESS.md` (nhật ký).
- Tham chiếu: code review PR #87.

## 2026-07-24 (3)

**Sửa lần 2 PR #87 — retrofit thiết kế "2 bộ đếm song song" thành "1 bộ đếm `realQuantity` duy nhất" cho CẢ `computeRealizedGainForHolding` (đã merge, sửa lại) LẪN `derivePositionIncludingStockDividends` (bug write-path chưa fix).**
- Bối cảnh: thiết kế "2 bộ đếm song song" chốt ở entry `2026-07-24 (2)` (a) chỉ đúng cho ca **đóng hết vị thế rồi mở lại** — điều kiện reset `avgCostQuantity`/`avgCost` (`realQuantity.isZero()`) không bao giờ kích hoạt ở ca **bán một phần (không đóng hết, kể cả tính CP từ cổ tức) rồi mua tiếp**, vì vị thế chưa từng thực sự chạm 0. `avgCostQuantity` (bộ đếm chỉ-Cashflow) khi đó đã lệch khỏi `realQuantity` (có tính cổ tức) mà không được xoá, bị dùng làm mẫu số/tử số bình quân sai ở lần BUY kế tiếp. Rà lại phát hiện `derivePositionIncludingStockDividends()` (`lib/cost-basis.ts`, write-path thật — cache `avgCost`/`totalCostBasis` trên `Holding`, dùng ở 4 Server Action ghi giao dịch + `getHoldingDetail`) mắc **cùng họ bug** nhưng CHƯA từng fix: hàm này lấy `avgCost` thẳng từ `derivePosition(cashflows)` cũ (chỉ-Cashflow, đã xoá — xem 2026-07-24 (4)) — chỉ biết BUY/SELL, không biết cổ tức cổ phiếu.
- **Quyết định: đổi cả hai hàm từ "2 bộ đếm + reset tường minh" sang "1 bộ đếm `realQuantity` duy nhất" (gồm cả BUY/SELL lẫn cổ tức cổ phiếu).** `avgCost` chỉ đổi ở BUY, dùng `realQuantity` NGAY TRƯỚC sự kiện đó (không phải biến cashflow-only riêng) làm cơ sở bình quân: `newAvgCost = (realQuantityTrước*avgCostCũ + tiềnMua) / (realQuantityTrước+SLMua)`. Khi vị thế đóng hết thật (`realQuantityTrước=0`), số hạng `0*avgCostCũ=0` tự "quên" avgCost cũ — không cần bước reset tường minh riêng, đúng cho CẢ ca đóng hết LẪN ca bán một phần. `derivePositionIncludingStockDividends()` áp dụng cùng công thức, tái dùng `before`/`after` sẵn có từ `buildQuantityTimeline()` (`lib/position-trail.ts`) làm `realQuantityTrước`/`SL sau BUY` — không thêm vòng lặp tính quantity riêng.
- Verify bằng số tính tay, ca biên "bán một phần rồi mua tiếp" (BUY 100 → cổ tức +20 → SELL 105, real còn 15 không về 0 → BUY 85 → SELL 100 đóng hết): `avgCost` sau BUY 85 = 171.500 (`src/lib/cost-basis.test.ts`), tổng `realizedGain` = 8.060.000 (`src/lib/realized-pnl.test.ts`, so với 4.022.500 sai theo thiết kế "2 bộ đếm" cũ). Test "đóng hết rồi mua lại" (130.000, `2026-07-24 (2)`) chạy lại vẫn đúng với thiết kế mới — không đổi số kỳ vọng, chỉ khác cách hiện thực bên trong.
- **Production chưa có record cổ tức cổ phiếu nào** (user xác nhận) → không cần script recompute/migration dữ liệu cũ, chỉ áp dụng cho giao dịch mới từ giờ trở đi.
- Không đổi chữ ký `derivePosition()` cũ, `derivePositionIncludingStockDividends()`, `computeRealizedGainForHolding()` — chỉ đổi cách tính bên trong. Không đổi 4 Server Action ghi giao dịch, `getHoldingDetail`, hay chỗ gọi `computeRealizedGainForHolding` ở `portfolio-valuation.ts`. Không đổi Prisma schema.
- Không xử lý ca lý thuyết "cổ tức xen giữa lúc `realQuantity=0` và BUY kế tiếp" (holding không giữ cổ phần nào mà vẫn nhận cổ tức) — trạng thái dữ liệu không hợp lệ theo domain, chỉ ghi chú comment trong code.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" — sửa lại mô tả cơ chế reset cho khớp thiết kế mới), `process/PROCESS.md` (nhật ký).
- Tham chiếu: PR #87 (sửa lần 2, tiếp theo entry `2026-07-24 (2)`).

## 2026-07-24 (4)

**Sửa lần 3 PR #87 — xoá `derivePosition()` cũ (chỉ-Cashflow), đổi tên `derivePositionIncludingStockDividends()` thành `derivePosition()`, gộp toàn bộ test về một hàm duy nhất — phát hiện VÀ sửa lần 4: bug thật "avgCost không reset về 0 khi đóng hết vị thế bằng SELL không có BUY sau đó".**
- Bối cảnh: sau fix lần 2 (entry `2026-07-24 (3)`), `derivePositionIncludingStockDividends()` không còn gọi `derivePosition(cashflows)` cũ để lấy `avgCost` nữa → `derivePosition()` cũ không còn production caller nào, chỉ còn sống trong `cost-basis.test.ts`. Thảo luận với user phát hiện 2 vấn đề: (1) test suite của `derivePositionIncludingStockDividends()` thiếu case trực tiếp cho "mua có phí"/"số lượng thập phân" — trước đây được bảo vệ GIÁN TIẾP qua test của `derivePosition()` cũ (khi hàm mới còn delegate `avgCost` cho nó), sự bảo vệ gián tiếp đó đã đứt sau fix lần 2; (2) giữ `derivePosition()` cũ làm "oracle đối chiếu" không có giá trị thật — công thức `avgCost` trong `derivePositionIncludingStockDividends()` là COPY trực tiếp từ `derivePosition()` cũ (cùng người, cùng lúc viết), không phải 2 cách tính độc lập. Giữ 2 bản công thức song song (dù 1 bản chỉ còn sống trong test) chính là pattern đã gây ra chuỗi bug retrofit ở entry `2026-07-24 (2)` và `(3)`.
- **Quyết định (sửa lần 3): xoá hẳn `derivePosition()` cũ (hàm + test suite riêng), đổi tên `derivePositionIncludingStockDividends()` thành `derivePosition()`** (chiếm lại tên cũ — giờ là cài đặt DUY NHẤT, tên "IncludingStockDividends" không còn ý nghĩa "thêm vào một hàm gốc khác" nữa). Viết lại toàn bộ 10 test case của `derivePosition()` cũ để gọi hàm mới với `stockDividends=[]`, gộp vào đầu describe hiện có (trước các test có cổ tức) — đồng thời tự động lấp gap coverage (phí, số thập phân) lên đúng hàm sản xuất thật mà không cần viết test mới. Xoá test "không có cổ tức nào -> kết quả khớp `derivePosition()` thuần" (không còn gì để đối chiếu sau khi gộp).
- **Bug phát hiện khi gộp test (sửa lần 4):** test "bán đúng hết số lượng đang giữ -> quantity và avgCost về 0" FAIL trên hàm mới — `avgCost` trả về 100.000 thay vì 0. Nguyên nhân: cơ chế "tự quên `avgCost` cũ nhờ nhân `realQuantityTrước=0`" (chốt ở sửa lần 2) chỉ kích hoạt tại **lần BUY kế tiếp** (vì vòng lặp `avgCost` chỉ duyệt qua BUY) — nếu chuỗi sự kiện kết thúc ngay sau một lệnh SELL đóng hết vị thế (không còn BUY nào sau), không có "lần BUY kế tiếp" nào để kích hoạt việc quên, nên `avgCost` bị kẹt ở giá trị cũ dù `quantity` thật đã về 0. Đây là regression có thật đưa vào từ sửa lần 2 (2026-07-24 (3), đã có sẵn trong PR #87 trước khi bắt đầu việc rename/dedup này) — không phải lỗi do rename gây ra, chỉ bị phơi ra khi gộp test trực tiếp vào hàm sản xuất thật. Ảnh hưởng thật: `Holding.avgCost` (materialize) hiện sai (khác 0) cho một vị thế đã bán sạch không mua lại — hiển thị trong `HoldingSummary` (cả tab "Đã đóng"), dù `totalCostBasis` vẫn đúng (nhân với `quantity=0`).
- **Quyết định (sửa lần 4): thêm reset tường minh `if (quantity.isZero()) avgCost = new Decimal(0);` ngay trước `return`, dùng `quantity` thật (dividend-aware, đã tính đúng ở vòng lặp `buildQuantityTimeline()` phía trên) — không dùng một biến cashflow-only riêng.** Nhất quán với thiết kế "real quantity là nguồn sự thật duy nhất" xuyên suốt hàm này (cùng tinh thần sửa lần 2). Không cần sửa `computeRealizedGainForHolding()` (`lib/realized-pnl.ts`) — hàm đó không trả `avgCost` ra ngoài (chỉ dùng nội bộ để tính `realizedGain`), nên `avgCost` "kẹt" ở cuối hàm không ảnh hưởng giá trị trả về.
- 4 call site sản xuất thật (`features/holdings/actions.ts` — 4 Server Action, `features/holdings/queries.ts::getHoldingDetail`) đổi tên lời gọi, tham số truyền vào không đổi.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md`, `docs/domain/01-assets-and-holdings.md`, `docs/domain/02-transactions-and-cost-basis.md`, `docs/rules/data-prisma.md`, `process/PROCESS.md` (nhật ký).
- Tham chiếu: PR #87 (sửa lần 3 + 4, tiếp theo entry `2026-07-24 (3)`).

## 2026-07-24 (5)

**Chốt quy ước viết e2e theo Page Object Model + tách tài liệu e2e ra khỏi production code.**
- Bối cảnh: bộ e2e hiện tại (`e2e/*.spec.ts`) viết lối thủ tục — gọi `page.getByRole/locator` trực tiếp trong spec, trùng lặp selector nặng, có chỗ bám class Tailwind (`div.rounded-2xl.border-border`) làm selector giòn, và tri thức domain (redirect `?cashflowId=`, DatePicker input hidden, timezone lệch ngày...) nằm rải rác trong comment từng spec. Cần một quy ước để spec mới nhất quán và gom tri thức lại một nơi.
- **Quyết định:** áp dụng **Page Object Model** cho e2e — ba tầng rạch ròi: **page object** (theo màn hình, ở `e2e/pages/`, giữ URL + selector + action), **component object** (widget dùng lại xuyên màn), **fixture** cross-cutting (ở `e2e/support/`, đã có sẵn: session, dates, date-picker, urls). Spec chỉ mô tả ý định + kỳ vọng, gọi page object.
- **Chiến lược selector:** role/label-first (repo có **0 `data-testid`** — dựa vào selector khả truy cập đúng khuyến nghị Playwright); `input[name="..."]` được phép cho form field (hợp đồng ổn định với Server Action); **cấm bám class CSS/Tailwind**; `data-testid` là **ngoại lệ có kiểm soát** — chỉ thêm vào `src/` khi selector khả truy cập thật sự không phân biệt được, nêu rõ trong PR.
- **Assertion:** locator là API chính của page object, `expect` nằm ở **spec** (giữ ý định kỳ vọng dễ đọc); chỉ thêm assertion helper trong page object khi lặp ≥3 lần.
- **Tách tài liệu e2e vs production (mục tiêu token/ngữ cảnh):** tri thức e2e gom vào `e2e/` + `docs/rules/` để khi Claude làm e2e chỉ nạp context e2e, không kéo `src/` vào; page object tập trung selector giúp người viết spec không phải mở internals component. Scoped `e2e/CLAUDE.md` auto-load chỉ khi làm trong `e2e/`.
- **Phạm vi lần này: chỉ tài liệu**, không tạo `e2e/pages/` thật, không refactor spec đang xanh (tránh rủi ro vỡ test). Refactor spec cũ sang POM theo dõi ở GitHub issue riêng — spec **mới** viết theo POM ngay; spec cũ đụng tới đâu POM hoá tới đó.
- Docs đã sync: `docs/rules/e2e-page-object.md` (rule mới — gồm mục "Best practices" gom lại: test independence/isolation cho `fullyParallel`, cấm logic điều khiển trong page object, tránh trừu tượng hoá non), `docs/coding-rules.md` (index), `docs/rules/testing.md` (mục End-to-end trỏ sang), `CLAUDE.md` (root — mục "Đọc khi cần" trỏ tường minh tới `e2e/CLAUDE.md`), `e2e/CLAUDE.md` (instruction scoped), `e2e/GOTCHAS.md` (nhật ký bẫy, seed từ bug thật đã gặp).
