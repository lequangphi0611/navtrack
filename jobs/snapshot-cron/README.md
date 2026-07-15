# snapshot-cron

Job Python chạy trên GitHub Actions theo lịch, chốt (đóng băng) NAV của từng `Holding` đang mở
và tổng danh mục mỗi user vào bảng `Snapshot`, dùng chung Postgres với app Next (Prisma sở hữu
migration — job chỉ đọc/ghi, không tạo bảng). Xem quy ước đầy đủ ở
[`docs/rules/python-job.md`](../../docs/rules/python-job.md) và domain spec ở
[`docs/domain/06-snapshots.md`](../../docs/domain/06-snapshots.md).

Khác `jobs/price-fetcher/` (lấy giá mới từ vnstock): job này **không** gọi API giá ngoài — chỉ
đọc `Holding`/`NavOverride`/`PriceQuote` đã có sẵn trong Postgres rồi tính lại NAV tại đúng ngày
cutoff. Hai job tách biệt hoàn toàn, không phụ thuộc lẫn nhau.

## Setup local

```bash
cd jobs/snapshot-cron
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Tạo file `.env` (hoặc export biến môi trường) cùng `DATABASE_URL` với app Next — xem
`.env.example` ở gốc repo. Khi chạy local, dùng Postgres từ `docker compose up -d` (gốc repo).

## Chạy

```bash
python main.py
```

`main.py` xác định các mốc cần chốt dựa trên ngày hôm nay:

1. **Luôn có 1 mốc `PERIODIC`** cho **ngày cuối tháng liền trước** (job chạy vào ngày 01 hằng
   tháng, `.github/workflows/snapshot-cron.yml`, cron `0 0 1 * *`).
2. **Thêm 1 mốc `YEAR_END`** cho **31/12 năm trước** khi job chạy vào tháng 1 (cùng ngày với
   mốc `PERIODIC` của tháng đó, khác `period` — 2 dòng snapshot khác nhau, không trùng).

Với mỗi mốc, job:

- Lấy mọi `Holding` đang mở (`quantity > 0`) của **mọi user**, mọi loại tài sản (kể cả
  GOLD/BOND — chỉ có `NavOverride`, không có `PriceQuote`).
- Định giá từng Holding tại ngày cutoff bằng `resolve_price()` — **mirror y hệt**
  `resolvePrice()`/`valuateHolding()` trong `src/lib/valuation.ts` (so `date` giữa dòng
  `NavOverride` và `PriceQuote` mới nhất ≤ ngày chốt, cùng ngày thì `NavOverride` thắng). Đây là
  **đồng bộ thủ công** giữa 2 ngôn ngữ — sửa domain rule định giá ở một nơi thì nhớ soát lại nơi
  kia (xem comment cross-reference ở cả 2 file).
- Upsert `Snapshot` cho từng Holding đã định giá được (idempotent theo khóa của partial unique
  index `Snapshot_holding_unique`), và 1 `Snapshot` tổng danh mục mỗi user (`holdingId = null`,
  idempotent theo `Snapshot_portfolio_unique`, `source` luôn `AUTO` vì đây là một tổng tính
  toán, không phải giá nhập tay).

### Ca biên thiếu giá

- Một Holding đang mở nhưng không resolve được giá (không có `NavOverride`/`PriceQuote` nào ≤
  ngày chốt) → **không ghi dòng Snapshot cho Holding đó** (không mặc định 0); log rõ
  `holdingId`/`userId`/`symbol`/ngày/`period`.
- Với dòng tổng danh mục của user đó: còn **ít nhất 1** Holding resolve được giá → vẫn ghi tổng
  = tổng các Holding đã biết, kèm log "PARTIAL" liệt kê mã còn thiếu. **Toàn bộ** Holding đang mở
  đều thiếu giá → **bỏ qua hẳn** dòng tổng (không ghi 0). User không có Holding nào đang mở
  (đã bán hết) → NAV = 0 là số thật, vẫn ghi.
- **Giới hạn đã biết:** `Snapshot` không có cờ boolean đánh dấu một dòng tổng đã lưu là
  "PARTIAL" — bằng chứng duy nhất là log GitHub Actions tại thời điểm job chạy (xem
  `process/DECISION.md`, mục 2026-07-14).

### Không nằm trong phạm vi job này

- **Nhánh cron tuần (weekly)** — chỉ tháng + cuối năm. Đổi cron sang tuần: đọc lịch từ
  `.github/workflows/snapshot-cron.yml` (comment "Xác định mốc cần chốt" trong `main.py`).
- **Snapshot thủ công** (`period = MANUAL`, nút "Chốt số liệu hôm nay") — issue Phase 3 khác.
- Job chạy theo lịch trên GitHub Actions
  ([`.github/workflows/snapshot-cron.yml`](../../.github/workflows/snapshot-cron.yml)), 00:00
  UTC ngày 01 hằng tháng — có thể chạy tay qua `workflow_dispatch`. `DATABASE_URL` đọc từ GitHub
  Secrets, không hardcode.

## Test & lint

```bash
pip install -r requirements-dev.txt   # thêm pytest + ruff so với requirements.txt
python -m pytest                      # test logic thuần — mock psycopg, không gọi mạng/DB thật
ruff check .
ruff format --check .
```

`test_main.py` mock connection/cursor (psycopg) bằng `unittest.mock` — không có test nào gọi
DB thật. Phủ: xác định mốc chốt (tháng thường, tháng 2 nhuận, tháng 1 → cả `PERIODIC` lẫn
`YEAR_END`); `resolve_price` (mirror đúng các case của `resolvePrice()` TS); câu SQL đọc
(`DISTINCT ON`, cutoff date) và upsert (đúng `ON CONFLICT ... WHERE ...` khớp 2 partial unique
index); orchestration `run_snapshot` (cô lập lỗi từng Holding, ca biên thiếu giá ở cả cấp
Holding lẫn tổng danh mục, user không có Holding mở vẫn ghi NAV = 0).

### Integration test

```bash
pnpm test:python-integration   # chạy ở gốc repo, không phải trong jobs/snapshot-cron
```

`test_integration.py` (marker `@pytest.mark.integration`, bị `pytest` thường loại qua
`addopts` trong `pyproject.toml`) chạy `run_snapshot()` trên Postgres **thật** — không mock —
để chứng minh 2 điều `test_main.py` (mock hoàn toàn) không chứng minh được:

- Gọi `run_snapshot()` 2 lần liên tiếp trên cùng dữ liệu **không sinh dòng `Snapshot` trùng**
  (dựa vào 2 partial unique index thật của migration `add_snapshot_unique_constraint`, không
  phải giả định câu SQL).
- Giá trị NAV ghi thật đúng bằng `quantity * price` đọc từ `PriceQuote` thật.

`pnpm test:python-integration` (`scripts/python-integration-test.mjs`) tự lo hết: `docker
compose -f docker-compose.test.yml up` DB test (tái dùng đúng hạ tầng của `pnpm e2e`, cổng
5434, KHÔNG dựng compose riêng) → `prisma migrate deploy` → chạy `pytest -m integration`
trong thư mục job này → `docker compose down` khi xong (kể cả khi test fail). Cần chạy khi
sửa `run_snapshot()`/`upsert_*` hoặc migration liên quan `Snapshot` — unit test mock không
bắt được lỗi idempotent/giá trị thật. Xem thêm
[`docs/rules/python-job.md`](../../docs/rules/python-job.md) (mục "Test — unit + integration").
