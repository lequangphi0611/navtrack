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
gọi `vnstock` (nguồn VCI) lấy giá đóng cửa (EOD) gần nhất cho từng mã, rồi upsert vào
`PriceQuote` (idempotent theo `(symbol, date)`). GOLD/BOND không nằm trong phạm vi job —
nguồn tự động kém ổn định nên mặc định nhập tay (`NavOverride`). Lỗi một mã (mạng, rate
limit, không có dữ liệu) được cô lập — retry có backoff rồi bỏ qua, không làm sập cả job;
xem chi tiết ở `docs/rules/python-job.md`.

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

`test_main.py` mock `Quote` (vnstock) và connection/cursor (psycopg) bằng `unittest.mock` —
không có test nào gọi mạng thật hay cần Postgres chạy sẵn. Phủ: câu SQL lọc mã (STOCK/FUND,
`quantity > 0`), quy tắc quy đổi giá vnstock (nghìn đồng) sang VND thô lưu `PriceQuote`, dùng
đúng ngày trong dữ liệu trả về (không suy `date.today()`), retry có backoff rồi trả `None`
(không raise), câu SQL upsert của `save_price`, và cô lập lỗi từng mã ở `main()` (một mã lỗi
không chặn các mã còn lại, rollback đúng khi ghi DB lỗi).
