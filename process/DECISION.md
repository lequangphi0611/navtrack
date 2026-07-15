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

**Session regression: không phải bug — tránh tranh luận lại ở phase sau bảo mật middleware.**
- Triệu chứng thoáng qua (redirect `/sign-in` dù session hợp lệ) không tái hiện, lỗi môi trường nhất thời.

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

**Issue #12: Suspense routes — chỉ 2/6 route tách Suspense (rule #2 vs #3).**
- Chỉ `holdings/[id]/transactions/{new,edit}` tách; `settings/members/*` giữ async page (query quyết định toàn bộ render).
- Docs: `docs/rules/component-architecture.md` (rule #2 vs #3).

**Phase 2: BottomNav dùng chung màn gốc/tab — ghi đè phạm vi hẹp (issue #12).**
- Quyết định cũ "không header chrome riêng" vẫn đúng cho **màn con/form** (giữ back/close). **Màn gốc** (`/`, `/holdings`, `/holdings/closed`, `/settings`) nay có BottomNav.
- Wiring: `DashboardScreen`, `HoldingsOverviewScreen`, `HoldingsEmptyState`, `SettingsScreen`.
- Còn treo: `NavOverrideForm` chưa có route thật (CTA tạm); "Tuỳ chỉnh" (CUSTOM) cutoff chưa có mockup (để task sau).

## 2026-07-12

**`NavOverride`: `@@unique([holdingId, date])` + `@db.Date` — upsert tự động cùng ngày.**
- Sửa giá cùng ngày phải ghi đè; `@db.Date` tránh nhầm lẫn giờ khác ngày.

**Wire mốc chốt cookie + Route Handler (`/api/cutoff`) — `CutoffHardNavGuard` ép hard nav để kích active state.**
- Lý do: Server Component không thể `cookies().set()` lúc render (lan `/settings` → `/`); giải pháp: Route Handler + cookie + hard navigation.
- Cảnh báo khi sửa `/api/cutoff`: Next.js soft-nav (`/settings` → `/settings`) bỏ qua re-render hoàn toàn (active state không cập nhật UI) → `CutoffHardNavGuard` client component ép hard nav (`window.location.href`) riêng cho link `/api/cutoff`, tôn trọng modifier keys (mở tab). Verify bằng Playwright (network trace + `context.cookies()`).
- Chi tiết: `getCutoffSelection()` (cookie), `getCutoffOptions()` (preview XIRR/mốc), `getPortfolioValuation()` chuyển xuống `lib/`.
- `Setting` không lưu (app read-only). "Tuỳ chỉnh" (CUSTOM) chưa mockup.

**Không thêm cache Holdings/Cashflow ở Phase 2 — giữ query thẳng Prisma. Quay lại Phase 3 (Snapshot).**
- Lý do: `getHoldingsRaw` đọc cột materialize (O(holding)), batch query giá + cashflow 1 lần → không N+1. App cá nhân nhỏ, không chậm thật; không tối ưu sớm.
- Điều kiện Phase 3: khi thêm `Snapshot` (dày + dùng chart) → đo lại. Nếu cache, dùng `userId` làm **tham số hàm** (đặt trong cache key), + `revalidateTag` trong Server Action holdings.
- **Không** copy pattern `getLatestPriceQuotes` (cache `symbol` dùng chung, khác bản chất cache `userId`).

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
- **Vì sao không cho job gọi API route nội bộ của app Next:** vi phạm ranh giới đã chốt từ đầu dự án ("Python và TS chỉ chia sẻ schema Postgres — không bên nào import code bên kia", `docs/rules/project-structure.md` + `docs/rules/python-job.md`). Công thức định giá (`resolvePrice`/`valuateHolding`, `src/lib/valuation.ts`) thực chất rất đơn giản (so `date` giữa dòng `NavOverride`/`PriceQuote` mới nhất ≤ D, `nav = quantity * price`) — rủi ro lệch khi domain rule đổi là thấp, nên chấp nhận viết lại bằng Python + SQL thuần (`DISTINCT ON`), giống tiền lệ `AUTO_PRICED_ASSET_TYPES` (đã "ĐỒNG BỘ THỦ CÔNG" giữa `valuation.ts` và `jobs/price-fetcher/main.py`). Cả 2 phía đã thêm comment cross-reference 2 chiều.
- **`Snapshot.source` của bản ghi tổng danh mục (`holdingId = null`) luôn là `AUTO`**, bất kể các Holding đóng góp dùng giá `MANUAL` hay `AUTO` — tổng danh mục là một con số tính toán (sum), không phải giá trị lấy thẳng từ 1 dòng `NavOverride`. `MANUAL` chỉ dành cho giá trị đúng bằng 1 giá nhập tay (cấp Holding).
- **Ca biên thiếu giá:** một Holding đang mở không resolve được giá tại mốc chốt → **không ghi dòng Snapshot cho Holding đó** (không mặc định 0), log rõ (`holdingId`/`userId`/`symbol`/ngày/`period`) theo đúng "cô lập lỗi" của `docs/rules/python-job.md`. Tổng danh mục của user đó: còn ≥ 1 Holding resolve được giá → ghi tổng = tổng các Holding đã biết (PARTIAL, log rõ mã thiếu, mirror `navSum`/`navValueIsPartial` đã có ở `src/lib/portfolio-valuation.ts`); toàn bộ Holding đang mở đều thiếu giá → **bỏ qua hẳn** dòng tổng (0 sẽ sai). User không có Holding nào đang mở → NAV = 0 là số thật, vẫn ghi. **Giới hạn đã biết:** `Snapshot` không có cờ boolean đánh dấu dòng tổng "PARTIAL" — bằng chứng duy nhất là log GitHub Actions; không mở rộng schema cho việc này ở issue #36.
- **Phạm vi "mọi user"** trong checklist Phase 3 = mọi user **có ít nhất 1 Holding** (đã từng tạo, mở hay đóng) — không phải mọi dòng `User`.
- **Không làm trong issue #36:** nhánh cron tuần (weekly) — chỉ tháng + cuối năm; Snapshot thủ công (`period = MANUAL`, nút "Chốt số liệu hôm nay"); cờ "partial" trong schema `Snapshot`; input tuỳ chỉnh ngày cho `workflow_dispatch` (backfill).
- Docs đã sync: `docs/domain/06-snapshots.md` (mục "Ca biên" + "Cách tính"), `docs/04-tech-stack.md` (tách sơ đồ + mục "Job Python" thành 2 job riêng), `docs/rules/project-structure.md` (thêm `jobs/snapshot-cron/` vào cây thư mục mẫu), `README.md` (trỏ tới `jobs/snapshot-cron/README.md`), `process/phase-3.md` (tick mục Cron GitHub Actions workflow), `process/PROCESS.md`.

## 2026-07-15

**Thêm integration test trên Postgres thật cho `jobs/snapshot-cron/` — tái dùng hạ tầng DB test của e2e, không dựng compose riêng.**
- Bối cảnh: `test_main.py` mock hoàn toàn `psycopg`/DB — chỉ chứng minh đúng câu SQL `ON CONFLICT ... WHERE ...` được gọi, không chứng minh được `run_snapshot()` chạy 2 lần liên tiếp trên DB thật thực sự idempotent (dựa vào 2 partial unique index thật của migration `add_snapshot_unique_constraint`), cũng không verify giá trị NAV tính đúng khi đọc dữ liệu thật.
- **Tái dùng `docker-compose.test.yml`/`.env.test` (cổng 5434) thay vì dựng compose riêng cho job Python:** đây đã là hạ tầng Postgres ephemeral độc lập với DB dev/prod, project name riêng (`navtrack-test`) đảm bảo `down` không đụng service `db` dev. Dựng thêm 1 compose file riêng chỉ để test 1 job Python là trùng lặp không cần thiết, tăng bề mặt bảo trì mà không có lợi ích rõ ràng.
- **Dùng script Node (`scripts/python-integration-test.mjs`) orchestrate `docker compose` + `prisma migrate deploy` + `pytest`, không để Python tự gọi `docker compose`:** đây là lúc **TEST**, không phải lúc job **chạy production** (job production chỉ đọc/ghi Postgres qua `psycopg`, không phụ thuộc Node runtime) — nên không vi phạm ranh giới Python↔TS đã chốt ở `docs/rules/project-structure.md`/`docs/rules/python-job.md` ("chỉ chia sẻ schema Postgres, không import code chéo"). Script test là tooling ở tầng CI/dev-loop, mirror đúng pattern đã có (`scripts/e2e.mjs`), không phải code chạy trong job Python.
- **Marker `@pytest.mark.integration` + `addopts = "-m 'not integration'"`** trong `pyproject.toml` của job: để `pytest` mặc định (không tham số, dùng khi dev tay/CI nhanh) tự loại integration test, không kéo Docker mỗi lần chạy unit test — giữ vòng lặp dev nhanh như trước.
- **Guard cứng trong `test_integration.py`:** autouse fixture kiểm `DATABASE_URL` chứa `:5434` trước khi cho phép TRUNCATE/INSERT chạy — vì `.env` của app không cố định host (có lúc là Neon prod, xem ghi chú `project_prisma_cli_env_gotcha`), integration test tuyệt đối không được lỡ tay chạm DB thật.
- **Phạm vi cố ý chỉ làm `jobs/snapshot-cron/` lần này, chưa retrofit `jobs/price-fetcher/`:** `price-fetcher` gọi `vnstock` (network thật) — integration test cho job đó cần quyết định riêng về mock network (vd ghi trước fixture giá, hay mock HTTP layer của `vnstock`), để lại cho một task sau.
- Docs đã sync: `docs/rules/python-job.md` (mục mới "Test — unit + integration"), `docs/rules/testing.md` (mục mới "Integration test — job Python"), `docs/coding-rules.md` (dòng mô tả `testing.md`), `HARNESS.md` (bảng "Verify khi hoàn thành", tổng quát hoá dòng Job Python), `jobs/snapshot-cron/README.md` (mục "Integration test"), `README.md` gốc (bảng "Lệnh thường dùng"), `process/PROCESS.md`.

## 2026-07-15 (2)

**Retrofit integration test trên Postgres thật cho `jobs/price-fetcher/` — không còn hoãn (khác quyết định 2026-07-15 (1)).**
- Bối cảnh: mục "Phạm vi cố ý" ở quyết định 2026-07-15 (1) để lại `jobs/price-fetcher/` cho một task sau vì job này gọi `vnstock` (network thật), cần quyết định riêng về cách mock network. Task này chốt cách mock và hiện thực luôn.
- **Cách mock đã chọn: monkeypatch `main.fetch_price` (hàm orchestration cao nhất của việc lấy giá), không mock sâu `Quote`/`Fund` (client vnstock).** `_fetch_price_vci`/`_fetch_price_fmarket` và fallback VCI → fmarket đã được `test_main.py` unit-test kỹ (mock `Quote`/`Fund` trực tiếp, xem `jobs/price-fetcher/test_main.py`) — integration test chỉ cần verify phần `test_main.py` KHÔNG chứng minh được: `get_symbols_to_fetch()` đọc đúng Holding thật, và `save_price()`/`main()` ghi đúng + idempotent trên constraint `PriceQuote_symbol_date_key` thật. Mock ở tầng `fetch_price` tránh phụ thuộc chi tiết nội bộ thư viện `vnstock` (shape DataFrame, tên cột...) trong integration test — giữ test ổn định khi `vnstock` đổi phiên bản, vì phần đó không phải điều integration test này muốn chứng minh.
- 4 test: `test_save_price_upsert_is_idempotent_on_real_db`, `test_get_symbols_to_fetch_reads_real_holdings` (STOCK/FUND đang mở, loại GOLD và vị thế đã đóng), `test_main_isolates_one_symbol_failure_and_persists_the_rest_on_real_db` (3 Holding thật, 1 mã fail qua `fetch_price` mock trả `None`), `test_main_run_twice_does_not_duplicate_price_quote_rows` (gọi `main()` thật 2 lần liên tiếp, không trace `save_price` riêng).
- **`scripts/python-integration-test.mjs` đổi từ nhận đúng 1 job path cứng sang nhận nhiều job path qua argv HOẶC tự quét `jobs/*/test_integration.py` khi không truyền argv nào:** để job Python mới sau này (vd job đọc danh sách mã autocomplete) tự động được gộp vào `pnpm test:python-integration` mà không cần sửa lại script hay `package.json` mỗi lần thêm job. Vẫn giữ nguyên 1 lần `docker compose up`/`down` dùng chung cho tất cả job chạy trong 1 lượt (không up/down lặp lại theo từng job) — chạy hết tất cả job dù có job fail giữa chừng, để thấy đủ lỗi trong 1 lần chạy thay vì dừng ở job đầu tiên fail.
- `package.json`: `test:python-integration` bỏ hardcode `jobs/snapshot-cron`, dựa hẳn vào cơ chế tự quét của script — không liệt kê cứng tên job nào trong `package.json`.
- Docs đã sync: `HARNESS.md` (bảng "Verify khi hoàn thành" — liệt kê cả `jobs/price-fetcher/` và `jobs/snapshot-cron/` đã có `test_integration.py`), `README.md` gốc (bảng "Lệnh thường dùng" — mô tả `pnpm test:python-integration` là tự quét mọi job, không liệt kê cứng tên job), `jobs/price-fetcher/README.md` (mục mới "Integration test"), `process/PROCESS.md`.

## 2026-07-15 (3)

**Issue #37: Snapshot thủ công (`MANUAL`) — Server Action `freezeManualSnapshot()` dùng check-before-insert trong transaction Serializable, KHÔNG `.upsert()`/raw SQL.**
- **Đặt ở `src/features/snapshots/actions.ts`, không phải `holdings/actions.ts`:** Snapshot là entity riêng dùng chung ở 3 nơi (Dashboard, `/snapshots`, và `holdings/actions.ts` gọi làm trigger) — `holdings/actions.ts` gọi sang `snapshots/actions.ts` để trigger tự nhiên hơn chiều ngược lại (buộc `snapshots` phải import ngược từ `holdings`).
- **Không dùng `db.snapshot.upsert()`:** khóa dedup của `Snapshot` là 2 partial unique index viết tay bằng raw SQL (migration `add_snapshot_unique_constraint`, không phải `@@unique` trong `schema.prisma`), nên Prisma Client không sinh input `where` compound cho `(holdingId, date, period)`/`(userId, date, period)` để `.upsert()` dùng được.
- **Không dùng raw SQL** (dù `jobs/snapshot-cron/main.py` làm vậy vì Python không có ORM): raw INSERT đòi tự sinh `id` (cuid) — dự án không có dependency cuid độc lập. Dùng `findFirst` rồi `create`/`update` trong 1 `db.$transaction(..., { isolationLevel: Serializable })` — đúng pattern đã có ở 4 action khác trong `holdings/actions.ts`. An toàn kép: Serializable chặn phần lớn race (P2034), partial unique index thật ở Postgres tự chặn `create()` trùng nếu lọt qua (P2002) — catch cả 2 mã, giống `createHolding`.
- **Re-chốt "hôm nay" nhiều lần trong ngày = upsert idempotent, LUÔN `ok: true`, KHÔNG phải lỗi.** `docs/domain/06-snapshots.md` mục "Ca biên" nói rõ chốt lại một mốc phải ghi đè, không tạo dòng mới — không nói trả lỗi. `SnapshotFreezeSheet`/`SnapshotTodayCard` (đã merge từ #35) cũng không có prop kiểu "đã chốt rồi thì chặn nút" — form luôn cho bấm bất kể đã chốt trong ngày chưa. Diễn giải câu "chặn ghi đè" trong issue gốc thành: chặn tạo dòng **thứ hai** trùng khóa (đã tự động thoả bởi partial unique index + Serializable), **không phải** chặn người dùng bấm lại. `alreadySnapshotToday` chỉ là hiển thị đọc lại từ DB, không phải cổng chặn ghi.
- **Thêm `Snapshot.updatedAt DateTime @default(now()) @updatedAt`** (migration `add_snapshot_updated_at`) — để "Đã chốt lúc HH:mm" phản ánh đúng lần chốt gần nhất khi re-chốt trong ngày (`createdAt` chỉ set lúc INSERT đầu, không đổi khi UPDATE đè giá trị). `@default(now())` (khác các `updatedAt` khác trong schema) cần thiết để backfill NOT NULL vì bảng `Snapshot` đã có dữ liệu (cron #36 đã chạy) khi cột này được thêm vào — nếu không, `prisma migrate dev` không chạy được non-interactively. **Kéo theo bắt buộc sửa cùng lúc `jobs/snapshot-cron/main.py`** (`upsert_holding_snapshot`/`upsert_portfolio_snapshot` thêm `"updatedAt"` vào cả `INSERT` lẫn `DO UPDATE SET`, giá trị `now()`) — job ghi trực tiếp bằng raw SQL, không qua Prisma Client nên không tự có giá trị này, nếu bỏ sót sẽ vi phạm NOT NULL và làm sập cron ngay sau khi migration chạy trên production.
- **`Snapshot.date` là `TIMESTAMP(3)` KHÔNG `@db.Date`** (xác nhận từ migration init) — khác `NavOverride`/`PriceQuote`. Vì 2 partial unique index khóa theo giá trị chính xác của cột này, thêm `todayIctDateOnly()` (`src/lib/cutoff.ts`) trả về `Date` cố định (00:00:00 UTC của đúng ngày dương lịch ICT) — ổn định giữa nhiều lần gọi cùng ngày, khác `endOfDay()` (dùng để LỌC "≤ cutoffDate", trả 23:59:59.999 ICT — mục đích khác).
- **`SnapshotFreezeSheetProps.breakdown` LUÔN đúng 4 dòng (STOCK/FUND/BOND/GOLD)** — đọc đúng nghĩa đen comment `// đúng 4 nhóm` cạnh field (đã merge từ #35, không đổi Props). `getSnapshotFreezePreview()` (`features/snapshots/queries.ts`) build đủ 4 dòng, mặc định `value: "0"` cho nhóm không có holding nào VALUED — khác `buildAllocation()` (`lib/portfolio-valuation.ts`) vốn bỏ nhóm rỗng (dùng cho % phân bổ, nhóm rỗng vô nghĩa ở biểu đồ đó).
- **Cờ "vừa giao dịch xong" cho `HoldingDetailScreen.justRecorded`: query param `?cashflowId=<id>`**, không cookie — `lib/routes.ts::holdingDetailAfterTransaction()`. `page.tsx` KHÔNG tin thẳng query string: `getJustRecordedBanner()` (`holdings/queries.ts`) tự verify `cashflowId` thuộc đúng `holding.cashflows` đã fetch trước khi dựng banner. Chỉ áp dụng cho `createHolding`/`addTransaction`/`updateTransaction` (có điều hướng sau khi thành công) — `deleteTransaction` không điều hướng đi đâu và không có biến thể banner cho xóa, nhưng vẫn kích hoạt trigger tự động chốt snapshot như 3 action kia.
- **Ca biên thiếu giá khi chốt MANUAL: mirror y hệt cron (#36)** — tách logic thuần `planManualSnapshot()` (`src/lib/manual-snapshot.ts`, không đụng DB) để unit test được, Server Action chỉ gọi hàm thuần rồi thực thi ghi.
- Docs đã sync: `docs/02-data-model.md` (code block `Snapshot` + bullet `updatedAt` trong "Ghi chú thiết kế"), `docs/domain/06-snapshots.md` (mục "Ca biên" — gộp MANUAL vào cùng rule với cron, xóa câu "vẫn là issue Phase 3 riêng sau"), `process/phase-3.md` (tick "Công việc cần làm"), `process/PROCESS.md`.
