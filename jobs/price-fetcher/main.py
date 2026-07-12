"""Entry point cho job lấy giá (GitHub Actions, chạy theo lịch).

Lấy danh sách mã STOCK/FUND đang có vị thế mở (quantity > 0) từ `Holding`, gọi
vnstock (nguồn VCI) lấy giá EOD gần nhất, rồi upsert vào `PriceQuote`
(idempotent theo (symbol, date)). GOLD/BOND không nằm trong phạm vi job này —
mặc định nhập tay qua `NavOverride` (nguồn tự động kém ổn định, xem
docs/domain/04-pricing-and-valuation.md). Lỗi một mã không được làm sập cả
job — xem docs/rules/python-job.md.
"""

import logging
import os
import time
import uuid
from datetime import date, timedelta
from decimal import Decimal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv
from vnstock import Quote

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("price-fetcher")

# vnstock (nguồn VCI) trả giá theo nghìn đồng (vd VNM close = 55.7 nghĩa là
# 55.700 VND) — trong khi Cashflow.pricePerUnit của app lưu VND thô (vd
# 80000.0000). Nhân 1000 để PriceQuote cùng đơn vị, phục vụ NAV = quantity *
# price đúng ngay (đã verify thủ công với VNM/FPT trước khi code, xem báo cáo
# cuối task).
PRICE_SCALE = Decimal(1000)

PRICE_SOURCE = "vnstock"

# Buffer đủ rộng để luôn có ít nhất 1 phiên giao dịch trong cửa sổ, kể cả quanh
# kỳ nghỉ lễ dài (Tết) — không dùng để suy ra ngày giá, chỉ để giới hạn query.
HISTORY_LOOKBACK_DAYS = 10

# Retry thủ công có backoff, không thêm dependency (vd tenacity) — tối đa 3
# lần retry (4 lần gọi tổng cộng), sleep tăng dần trước mỗi lần retry.
MAX_RETRIES = 3
RETRY_DELAYS_SECONDS = (2, 4, 8)


def to_libpq_url(database_url: str) -> str:
    """Bỏ query param `schema` (chỉ Prisma hiểu) để psycopg parse được cùng
    một DATABASE_URL dùng chung với app Next — xem docs/rules/project-structure.md."""
    parsed = urlparse(database_url)
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"]
    return urlunparse(parsed._replace(query=urlencode(query)))


def get_symbols_to_fetch(conn: psycopg.Connection) -> list[str]:
    """Mã STOCK/FUND đang có vị thế mở (quantity > 0).

    Vị thế đóng (quantity = 0) có NAV = 0 nên không cần giá mới — tiết kiệm
    rate limit vnstock. GOLD/BOND không nằm trong danh sách: nguồn tự động
    kém ổn định, mặc định nhập tay (NavOverride).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT symbol
            FROM "Holding"
            WHERE type IN ('STOCK', 'FUND') AND quantity > 0
            """
        )
        return [row[0] for row in cur.fetchall()]


def fetch_price(symbol: str) -> tuple[date, Decimal] | None:
    """Lấy giá EOD gần nhất của `symbol` từ vnstock (nguồn VCI).

    Trả `(ngày_giao_dịch_thật_từ_data, giá_VND)` — dùng đúng ngày trong dữ
    liệu trả về (KHÔNG suy `date.today()`) để an toàn quanh ngày nghỉ lễ VN.
    Retry tối đa `MAX_RETRIES` lần với backoff khi lỗi (mạng, rate limit,
    không có dữ liệu); hết retry vẫn lỗi thì trả `None`, không raise ra ngoài.
    """
    end = date.today()
    start = end - timedelta(days=HISTORY_LOOKBACK_DAYS)

    for attempt in range(MAX_RETRIES + 1):
        try:
            quote = Quote(symbol=symbol, source="VCI")
            df = quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
            if df is None or df.empty:
                raise ValueError(f"no price data returned for {symbol}")

            latest = df.iloc[-1]
            quote_date = latest["time"].date()
            price = Decimal(str(latest["close"])) * PRICE_SCALE
            return quote_date, price
        except Exception:
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS_SECONDS[attempt]
                logger.warning(
                    "fetch attempt %d/%d failed for %s, retrying in %ds",
                    attempt + 1,
                    MAX_RETRIES + 1,
                    symbol,
                    delay,
                )
                time.sleep(delay)
            else:
                logger.exception("all retries exhausted fetching price for %s", symbol)
                return None
    return None  # unreachable — satisfies type checkers


def save_price(
    conn: psycopg.Connection,
    symbol: str,
    quote_date: date,
    price: Decimal,
    source: str = PRICE_SOURCE,
) -> None:
    """Upsert idempotent theo (symbol, date) — chạy lại không tạo dòng trùng."""
    # PriceQuote.id là String @id @default(cuid()) ở phía Prisma, nhưng cột
    # không ràng buộc đúng format cuid — uuid4 hex là String hợp lệ, đủ unique,
    # và có sẵn trong stdlib (tránh thêm dependency `cuid`/`cuid2` chỉ để sinh
    # id). Bị bỏ qua khi có conflict (dòng cũ giữ nguyên id của nó).
    price_id = uuid.uuid4().hex
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "PriceQuote" (id, symbol, date, price, source, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, now(), now())
            ON CONFLICT (symbol, date) DO UPDATE
            SET price = EXCLUDED.price, "updatedAt" = now()
            """,
            (price_id, symbol, quote_date, price, source),
        )


def main() -> None:
    load_dotenv()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "DATABASE_URL is not set. Copy .env.example to .env (local) "
            "or set the DATABASE_URL secret (GitHub Actions)."
        )
    database_url = to_libpq_url(database_url)

    with psycopg.connect(database_url) as conn:
        symbols = get_symbols_to_fetch(conn)
        logger.info("found %d symbol(s) to fetch", len(symbols))

        ok_count = 0
        fail_count = 0
        for symbol in symbols:
            try:
                result = fetch_price(symbol)
                if result is None:
                    fail_count += 1
                    continue
                quote_date, price = result
                save_price(conn, symbol, quote_date, price)
                conn.commit()
                ok_count += 1
                logger.info("saved %s @ %s = %s", symbol, quote_date, price)
            except Exception:
                # Một mã lỗi không được làm sập cả job — log rồi tiếp tục.
                # Rollback để giải phóng transaction đang lỗi (nếu có) trước
                # khi xử lý mã tiếp theo trên cùng connection.
                logger.exception("fetch failed for %s", symbol)
                conn.rollback()
                fail_count += 1
                continue

        logger.info("done: %d ok, %d failed (of %d symbol(s))", ok_count, fail_count, len(symbols))


if __name__ == "__main__":
    main()
