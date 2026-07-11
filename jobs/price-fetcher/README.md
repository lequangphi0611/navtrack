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

Hiện tại `main.py` chỉ xác nhận kết nối DB (khung hạ tầng). Logic lấy giá `vnstock` +
upsert `PriceQuote` sẽ thêm ở Phase 2.
