# Python job (GitHub Actions)

Quy tắc cho **các job Python** chạy trên GitHub Actions, ghi vào Postgres. Job chính là **lấy giá** bằng `vnstock`; các job Python khác (chốt snapshot định kỳ, nạp danh sách mã cho autocomplete) **tuân theo cùng các rule dưới đây**. Lịch chạy mỗi job nằm trong **cron của workflow** (vd snapshot tháng fire ngày 01) — không tự kiểm ngày trong code. Ranh giới tổng thể: xem `project-structure.md`.

## Vị trí & ranh giới
- Đặt ở thư mục **tách riêng ngoài app Next**, vd `jobs/price-fetcher/`, có `requirements.txt` + README riêng.
- **Chỉ chia sẻ schema Postgres với TS** — không import code TS, TS không gọi job.
- **Prisma sở hữu migration.** Job **chỉ đọc/ghi theo bảng đã có**, **không** `CREATE/ALTER TABLE`, không chạy migration.
- App Next **chỉ đọc** giá; job **chỉ ghi** giá tự động vào bảng **`PriceQuote`** (do Prisma định nghĩa — xem `02-data-model.md`), upsert theo `(symbol, date)`.

## Kết nối & secrets
- Đọc `DATABASE_URL` từ **env / GitHub Secrets**; không hardcode, không log.
- Mở kết nối, làm việc, **đóng kết nối gọn** (context manager).

```python
# ❌ Bad — hardcode secret, không đóng kết nối
conn = psycopg.connect("postgresql://user:pass@host/db")

# ✅ Good — từ env, đóng tự động
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    ...
```

## Idempotent (chạy lại an toàn)
- Ghi giá phải **upsert theo `(symbol, date)`** — chạy lại cùng ngày không tạo bản ghi trùng. `date` phải là **date-only** (chuẩn hóa về nửa đêm UTC / cột `@db.Date`) để unique đảm bảo đúng 1 giá/mã/ngày.

```python
# ✅ Good — upsert
# INSERT ... ON CONFLICT (symbol, date) DO UPDATE SET price = EXCLUDED.price
# ❌ Bad — INSERT thẳng → trùng mỗi lần chạy lại
```

## Cô lập lỗi
- **Một mã lỗi KHÔNG làm sập cả job** — `try/except` từng mã rồi `continue`; log rõ mã fail và có fallback không.

```python
# ✅ Good
for symbol in symbols:
    try:
        save_price(fetch_price(symbol))
    except Exception:
        logging.exception("fetch failed for %s", symbol)
        continue
# ❌ Bad — lỗi một mã làm mất luôn các mã sau
for symbol in symbols:
    save_price(fetch_price(symbol))
```

## Tiền & số
- Dùng `decimal.Decimal` khi xử lý/ghi giá tiền — **không** `float`.

```python
# ❌ Bad
price = float(raw)
# ✅ Good
from decimal import Decimal
price = Decimal(str(raw))
```

## Logging
- Dùng **`logging` của Python ra stdout** (GitHub Actions tự thu). Có ngữ cảnh (mã, nguồn), **không log secret**. Nguyên tắc chung: `error-handling.md`.
- Log rõ **nguồn giá lỗi** và **có dùng fallback không** (vd vàng SJC 403 → nhập tay).

## vnstock
- Nguồn tự động cho **cổ phiếu/quỹ**; **vàng/trái phiếu** nguồn kém ổn định → mặc định nhập tay (`NavOverride`), job không cố ghi đè.
- Tôn trọng **rate limit**: retry có backoff, không gọi dồn dập.
- License `vnstock` bản miễn phí = dùng cá nhân, không thương mại (phù hợp Navtrack).

## Style
- **PEP 8**, có **type hints**; lint + format bằng **ruff** (bao gồm `ruff format`, không dùng thêm black).
- Tên biến/hàm tiếng Anh; comment giải thích "tại sao".
- Hàm nhỏ, một việc; tách `fetch_*` và `save_*` để test được logic riêng.
