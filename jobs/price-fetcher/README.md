# price-fetcher

Job Python chạy trên GitHub Actions theo lịch, ghi giá EOD (`PriceQuote`) vào Postgres dùng
chung với app Next (Prisma sở hữu migration — job chỉ đọc/ghi, không tạo bảng). Xem quy ước đầy
đủ ở [`docs/rules/python-job.md`](../../docs/rules/python-job.md).

## Setup local

```bash
cd jobs/price-fetcher
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

`main.py` lấy danh sách mã STOCK/FUND đang có vị thế mở (`quantity > 0`) từ `Holding`,
gọi `vnstock` lấy giá đóng cửa (EOD) gần nhất cho từng mã, rồi upsert vào `PriceQuote`
(idempotent theo `(symbol, date)`). Hai nguồn được thử theo thứ tự cho mỗi mã:

1. **VCI** (`vnstock.Quote`) — mã niêm yết sàn: cổ phiếu, ETF/chứng chỉ quỹ niêm yết.
2. **fmarket** (`vnstock.Fund`) — NAV quỹ mở không niêm yết (vd `VESAF`, `DCDS`), dùng khi VCI
   không có dữ liệu. `Holding.symbol` không phân biệt được ETF niêm yết vs quỹ mở nên job
   không đoán trước, luôn thử VCI trước rồi mới fallback fmarket. **fmarket chỉ liệt kê quỹ
   phân phối qua nền tảng Fmarket** — không phủ hết mọi quỹ mở VN (vd quỹ phân phối riêng qua
   kênh ngân hàng có thể không có); khi cả 2 nguồn đều fail, job log rõ gợi ý nhập tay qua
   `NavOverride`.

GOLD/BOND không nằm trong phạm vi job — nguồn tự động kém ổn định nên mặc định nhập tay
(`NavOverride`). Lỗi một mã (mạng, rate limit, không có dữ liệu) được cô lập — log rồi bỏ
qua, không làm sập cả job. `Quote.history()` (VCI) đã tự retry nội bộ có backoff (tenacity);
job **không** tự viết thêm retry loop để tránh gọi dồn dập (double retry) vượt rate limit.
Xem chi tiết ở `docs/rules/python-job.md` và quyết định thiết kế ở `process/DECISION.md`
(mục 2026-07-12).

Job chạy theo lịch trên GitHub Actions ([`.github/workflows/price-fetcher.yml`](../../.github/workflows/price-fetcher.yml)),
16:30 giờ VN các ngày trong tuần (sau khi HOSE/HNX đóng cửa) — có thể chạy tay qua
`workflow_dispatch`. `DATABASE_URL` đọc từ GitHub Secrets, không hardcode.

## Test & lint

```bash
pip install -r requirements-dev.txt   # thêm pytest + ruff so với requirements.txt
python -m pytest                      # test logic thuần — mock vnstock/psycopg, không gọi mạng/DB thật
ruff check .
ruff format --check .
```

`test_main.py` mock `Quote`/`Fund` (vnstock) và connection/cursor (psycopg) bằng
`unittest.mock` — không có test nào gọi mạng thật hay cần Postgres chạy sẵn. Phủ: câu SQL
lọc mã (STOCK/FUND, `quantity > 0`); quy tắc quy đổi giá VCI (nghìn đồng) sang VND thô, và
fmarket giữ nguyên VND thô (không quy đổi); dùng đúng ngày trong dữ liệu trả về (không suy
`date.today()`); validate giá NaN/0/âm bị từ chối trước khi lưu; match quỹ fmarket theo
CHÍNH XÁC `shortName` (không lấy đại kết quả substring đầu tiên); fallback VCI → fmarket khi
VCI không có dữ liệu; cache 1 instance `Fund()` dùng chung trong cùng lần chạy; lỗi (mạng,
không có dữ liệu) bị bắt và trả `None` (không raise, không tự retry — tin vào tenacity nội bộ
của `Quote.history()`); câu SQL upsert của `save_price`; và cô lập lỗi từng mã ở `main()`
(một mã lỗi không chặn các mã còn lại, rollback đúng khi ghi DB lỗi).
