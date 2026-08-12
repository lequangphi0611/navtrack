# Quyết định — Snapshot (đóng băng số liệu)

Phạm vi: model `Snapshot`, dedup, cron Python chốt số liệu, snapshot thủ công, lịch sử/chi tiết snapshot.
Spec tương ứng: [`docs/domain/06-snapshots.md`](../../docs/domain/06-snapshots.md).

---

## 2026-07-14 — Issue #34: dedup `Snapshot` bằng 2 partial unique index (raw SQL)

**Status:** Accepted

**Issue #34: dedup constraint cho `Snapshot` đã đóng băng — khóa `(userId|holdingId, date, period)`, thực hiện bằng 2 partial unique index (raw SQL), không phải `@@unique`.**
- Khóa duy nhất: `(userId, date, period)` cho snapshot tổng danh mục (`holdingId = null`), và `(holdingId, date, period)` cho snapshot theo từng vị thế.
- **`period` nằm trong khóa** vì cùng một `date` lịch có thể hợp lệ sinh 2 dòng khác nhau: cron tháng (`PERIODIC`, fire 01/01 ghi cho 31/12 năm trước) và cron cuối năm (`YEAR_END`, cũng fire 01/01 ghi cho cùng 31/12) — 2 mốc báo cáo khác mục đích, không phải trùng lặp cần chặn.
- **Vì sao không dùng `@@unique` thường:** `holdingId` nullable, và Postgres coi mỗi `NULL` là khác biệt trong unique index thường (`NULL != NULL`) — một `@@unique([userId, date, period])` khai trong `schema.prisma` sẽ **không** chặn được nhiều dòng snapshot tổng danh mục trùng mốc (vì `holdingId` luôn null với các dòng này, Postgres không coi là trùng). Prisma DSL cũng không hỗ trợ `WHERE` cho `@@unique` nên không thể tự thu hẹp phạm vi bằng field thường. Giải pháp: 2 **partial unique index** viết tay bằng raw SQL trong migration `20260714075356_add_snapshot_unique_constraint` (`CREATE UNIQUE INDEX ... WHERE "holdingId" IS NULL` / `WHERE "holdingId" IS NOT NULL`) — chỉ đánh dấu bằng comment `// NOTE:` cạnh model `Snapshot` trong `schema.prisma`, không có block `@@unique` tương ứng. Vì đây không phải cấu trúc khai báo được ở DSL, các lần `prisma migrate dev` sau không diff/drop nhầm 2 index này.
- Phạm vi cố ý hẹp: issue #34 chỉ thêm ràng buộc DB, **không** viết logic ghi (upsert Server Action, cron workflow "Chốt số liệu hôm nay") — để issue Phase 3 sau.
- Docs đã sync: `prisma/schema.prisma` (comment `NOTE:`), `docs/02-data-model.md` (comment tương ứng trong code block + bullet mới trong "Ghi chú thiết kế" + xoá caveat "bản nháp" đã chốt), `docs/domain/06-snapshots.md` (bullet dedup trong "Quy tắc & bất biến" + gộp 2 ca biên cũ thành 1 rule đã chốt), `process/phase-3.md` (tick mục Model `Snapshot`), `process/PROCESS.md` (Phase 3 → 🟨).

---

## 2026-07-14 — Issue #36: job Python `snapshot-cron` viết lại công thức định giá bằng SQL/Python

**Status:** Accepted

**Issue #36: job Python `jobs/snapshot-cron/` chốt `Snapshot{PERIODIC}`/`{YEAR_END}` — viết lại công thức định giá bằng SQL/Python, không gọi API route Next.**
- **Vì sao không cho job gọi API route:** vi phạm ranh giới ("Python và TS chỉ chia sẻ schema Postgres"). Công thức định giá đơn giản (so `date` giữa `NavOverride`/`PriceQuote` mới nhất ≤ D, `nav = quantity * price`) — viết lại bằng Python + SQL, giống tiền lệ `AUTO_PRICED_ASSET_TYPES` (ĐỒNG BỘ THỦ CÔNG giữa 2 phía).
- **`Snapshot.source` = `AUTO` cho tổng danh mục** (`holdingId = null`) bất kể holding đóng góp dùng giá `MANUAL` hay `AUTO` — tổng danh mục là sum, không phải giá từ 1 `NavOverride`. `MANUAL` chỉ cho giá trị ≡ 1 giá nhập tay (cấp Holding).
- **Ca biên thiếu giá:** Holding không resolve được giá → không ghi dòng Snapshot cho Holding đó, log rõ. Tổng danh mục: còn ≥ 1 Holding biết giá → ghi tổng = sum (PARTIAL, log mã thiếu); toàn bộ thiếu → bỏ qua. Không có cờ "PARTIAL" trong schema.
- Docs đã sync: `docs/domain/06-snapshots.md`, `docs/04-tech-stack.md`, `docs/rules/project-structure.md`, `README.md`, `process/phase-3.md`.

---

## 2026-07-15 (2) — Issue #37: Snapshot thủ công (`MANUAL`), Serializable + `findFirst` rồi create/update

**Status:** Accepted

**Issue #37: Snapshot thủ công (`MANUAL`) — Serializable transaction + `findFirst` rồi create/update, re-chốt idempotent.**
- **Không dùng `.upsert()`:** khóa dedup là 2 partial unique index raw SQL (không `@@unique` trong schema), Prisma Client không sinh input `where` compound. Dùng `findFirst` + `create`/`update` trong `db.$transaction({ isolationLevel: Serializable })`. An toàn kép: Serializable chặn race, partial unique index thật chặn create trùng (catch P2034 + P2002).
- **Re-chốt "hôm nay" nhiều lần = upsert idempotent, `ok: true` luôn**, không lỗi — chốt lại phải ghi đè (đã được partial unique index + Serializable đảm bảo), không phải chặn UI bấm nút.
- **Thêm `Snapshot.updatedAt @default(now()) @updatedAt`** — reflect lần chốt gần nhất khi re-chốt. `@default(now())` (khác `updatedAt` khác) backfill NOT NULL non-interactively. **Cập nhật cùng lúc `jobs/snapshot-cron/main.py`:** thêm `"updatedAt": now()` vào INSERT/DO UPDATE SET.
- **`Snapshot.date` là `TIMESTAMP(3)` không `@db.Date`** — dùng `Date` cố định 00:00:00 UTC (không `endOfDay()` có 23:59:59.999) để ổn định giữa nhiều lần gọi cùng ngày.
- **Ca biên thiếu giá MANUAL:** mirror cron (#36) — tách logic thuần `planManualSnapshot()` để unit test, action gọi rồi ghi.
- Docs đã sync: `docs/02-data-model.md`, `docs/domain/06-snapshots.md`, `process/phase-3.md`.

---

## 2026-07-15 (3) — Issue #46: lịch sử & chi tiết snapshot

**Status:** Accepted

**Issue #46: `getSnapshotHistory()`/`getSnapshotDetail(id)` — badge suy từ `period`, breakdown liên kết via `(userId, date, period)`, comparison threshold 1 VND.**
- **Badge suy từ `Snapshot.period` không thêm field schema** — không phân biệt "MANUAL do giao dịch" vs "MANUAL do user bấm"; chấp nhận gộp (PERIODIC/YEAR_END/MANUAL → badge khác nhau).
- **`/snapshots/[id]` liên kết breakdown per-holding với tổng** qua query `(userId, date, period, holdingId IS NOT NULL)` — dùng khóa dedup có sẵn, không cần FK/index. 404 nếu snapshot không user hiện tại / là per-holding / `frozen=false`.
- **`recomputedComparison`:** suy ngược `quantity = frozenValue / historicalPrice`, nhân giá hiện tại — so sánh ảnh hưởng **giá**, không mua/bán. Thiếu giá → fallback `frozenValue`, không NaN. Ngưỡng 1 VND (VND không lẻ, đủ sensitive).
- Logic thuần tách riêng (`snapshot-history.ts`, `snapshot-recompute.ts`) để unit test không cần DB.
- Docs đã sync: `docs/domain/06-snapshots.md`, `process/phase-3.md`.

---

## Quyết định liên quan ở file khác

- Ghi cổ tức KHÔNG tự trigger `Snapshot{MANUAL}` — [`dividends.md`](./dividends.md), mục 2026-07-17 (2).
- Integration test cho job Python (`snapshot-cron`, `price-fetcher`) — [`agent-workflow-and-tooling.md`](./agent-workflow-and-tooling.md), mục 2026-07-15.
- Tách `paginateWithCursor()` khỏi `snapshot-history.ts` — [`transactions-and-cost-basis.md`](./transactions-and-cost-basis.md), mục 2026-07-24 (2).
