"""Entry point cho job lấy giá (GitHub Actions, chạy theo lịch).

Lấy danh sách (symbol, type) STOCK/FUND đang có vị thế mở (quantity > 0) từ
`Holding`, gọi vnstock lấy giá EOD gần nhất, rồi upsert vào `PriceQuote`
(idempotent theo (symbol, date)). Nguồn theo `type`:
- STOCK: chỉ VCI (`vnstock.Quote`) — mã niêm yết sàn.
- FUND: thử VCI trước (ETF/chứng chỉ quỹ niêm yết); nếu rỗng/lỗi, fallback
  fmarket (`vnstock.Fund`) lấy NAV quỹ mở không niêm yết (vd VESAF, DCDS).
  `Holding.type = FUND` gồm cả 2 loại, không phân biệt thêm được qua field
  nào khác nên phải thử VCI trước rồi fallback (xem
  docs/domain/01-assets-and-holdings.md, process/DECISION.md). STOCK không
  fallback fmarket — vừa vô ích vừa có rủi ro trùng `shortName` với 1 quỹ.
GOLD/BOND không nằm trong phạm vi job này — mặc định nhập tay qua
`NavOverride` (nguồn tự động kém ổn định, xem
docs/domain/04-pricing-and-valuation.md). Lỗi một mã không được làm sập cả
job — xem docs/rules/python-job.md.
"""

import logging
import os
import uuid
from datetime import date, timedelta
from decimal import Decimal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv
from vnstock import Fund, Quote

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("price-fetcher")

# vnstock (nguồn VCI) trả giá theo nghìn đồng (vd VNM close = 55.7 nghĩa là
# 55.700 VND) — trong khi Cashflow.pricePerUnit của app lưu VND thô (vd
# 80000.0000). Nhân 1000 để PriceQuote cùng đơn vị, phục vụ NAV = quantity *
# price đúng ngay (đã verify thủ công với VNM/FPT trước khi code, xem
# process/DECISION.md). fmarket (quỹ mở) trả NAV/chứng chỉ quỹ **đã là VND
# thô** (verify thủ công VESAF: listing().nav khớp nav_report() mới nhất,
# 32455.33) — KHÔNG áp PRICE_SCALE cho nguồn fmarket, xem `_fetch_price_fmarket`.
PRICE_SCALE = Decimal(1000)

PRICE_SOURCE = "vnstock"

# Buffer đủ rộng để luôn có ít nhất 1 phiên giao dịch trong cửa sổ, kể cả quanh
# kỳ nghỉ lễ dài (Tết, ~9 ngày lịch + cuối tuần liền kề) — không dùng để suy ra
# ngày giá, chỉ để giới hạn query. 15 ngày để có biên an toàn hơn buffer sát nút.
HISTORY_LOOKBACK_DAYS = 15


def to_libpq_url(database_url: str) -> str:
    """Bỏ query param `schema` (chỉ Prisma hiểu) để psycopg parse được cùng
    một DATABASE_URL dùng chung với app Next — xem docs/rules/project-structure.md."""
    parsed = urlparse(database_url)
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"]
    return urlunparse(parsed._replace(query=urlencode(query)))


def get_symbols_to_fetch(conn: psycopg.Connection) -> list[tuple[str, str]]:
    """(symbol, type) của STOCK/FUND đang có vị thế mở (quantity > 0).

    Vị thế đóng (quantity = 0) có NAV = 0 nên không cần giá mới — tiết kiệm
    rate limit vnstock. GOLD/BOND không nằm trong danh sách: nguồn tự động
    kém ổn định, mặc định nhập tay (NavOverride). Trả kèm `type` để
    `fetch_price` biết mã nào mới cần thử fallback fmarket (chỉ FUND mới có
    thể là quỹ mở không niêm yết — STOCK luôn ở sàn, fallback fmarket cho
    STOCK vừa vô ích vừa có rủi ro trùng shortName với 1 quỹ nào đó).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT symbol, type
            FROM "Holding"
            WHERE type IN ('STOCK', 'FUND') AND quantity > 0
            """
        )
        return [(row[0], row[1]) for row in cur.fetchall()]


def _is_valid_price(price: Decimal) -> bool:
    """Giá hợp lệ để lưu: hữu hạn (không NaN/Infinity) và dương. Mã bị halt/lỗi
    dữ liệu có thể trả NaN hoặc 0 — Postgres NUMERIC vẫn insert được nên phải
    tự chặn ở đây trước khi ghi."""
    return price.is_finite() and price > 0


def _fetch_price_vci(symbol: str) -> tuple[date, Decimal] | None:
    """Lấy giá EOD gần nhất của `symbol` từ vnstock (nguồn VCI, mã niêm yết
    sàn: cổ phiếu, ETF/chứng chỉ quỹ niêm yết).

    Trả `(ngày_giao_dịch_thật_từ_data, giá_VND)` — dùng đúng ngày trong dữ
    liệu trả về (KHÔNG suy `date.today()`) để an toàn quanh ngày nghỉ lễ VN.
    `Quote.history()` đã tự retry nội bộ có backoff (tenacity, xem
    `vnstock/api/quote.py`) — không tự retry thêm ở tầng này để tránh gọi
    dồn dập vượt rate limit (double retry). Lỗi (mạng, rate limit, không có
    dữ liệu — vd quỹ mở không niêm yết) thì trả `None`, không raise ra ngoài.
    """
    end = date.today()
    start = end - timedelta(days=HISTORY_LOOKBACK_DAYS)

    try:
        quote = Quote(symbol=symbol, source="VCI")
        df = quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
        if df is None or df.empty:
            raise ValueError(f"no price data returned for {symbol}")

        latest = df.iloc[-1]
        quote_date = latest["time"].date()
        price = Decimal(str(latest["close"])) * PRICE_SCALE
        if not _is_valid_price(price):
            raise ValueError(f"invalid price for {symbol}: {price}")
        return quote_date, price
    except Exception:
        logger.warning("VCI fetch failed for %s", symbol, exc_info=True)
        return None


_fund_client_instance: Fund | None = None


def _fund_client() -> Fund:
    """`Fund()` tải toàn bộ danh sách quỹ mở trên fmarket khi khởi tạo (1 API
    call) — cache trong process để mọi mã FUND fallback trong cùng lần chạy
    job dùng chung 1 instance, tránh gọi lại `listing()` nhiều lần (tôn trọng
    rate limit, xem docs/rules/python-job.md)."""
    global _fund_client_instance
    if _fund_client_instance is None:
        _fund_client_instance = Fund()
    return _fund_client_instance


def _fetch_price_fmarket(symbol: str) -> tuple[date, Decimal] | None:
    """Lấy NAV/chứng chỉ quỹ mở gần nhất của `symbol` từ fmarket — fallback
    khi VCI không có dữ liệu (quỹ mở không niêm yết sàn, vd VESAF, DCDS).

    fmarket chỉ liệt kê quỹ phân phối qua nền tảng Fmarket — không phủ hết
    mọi quỹ mở VN (quỹ phân phối riêng qua kênh khác có thể không có ở đây);
    khi đó coi như fail, log rõ lý do (xem `fetch_price`) để cân nhắc nhập tay
    qua `NavOverride`. `Fund.filter(symbol)` search theo substring phía server
    (vd tìm "VCBF" trả về cả VCBF-BCF/VCBF-TBF/...) nên phải tự lọc khớp
    CHÍNH XÁC `shortName`, không lấy đại dòng đầu. NAV trả về từ
    `nav_report()` đã là VND thô (verify thủ công VESAF, xem PRICE_SCALE ở
    đầu file) — KHÔNG nhân PRICE_SCALE (khác VCI trả nghìn đồng).

    fmarket không có retry nội bộ (không dùng tenacity như `Quote.history()`)
    — cố ý KHÔNG thêm retry/backoff thủ công riêng cho nguồn này: job chạy
    lại theo lịch mỗi ngày nên lỗi mạng thoáng qua tự phục hồi ở lần chạy sau,
    và thêm 1 vòng retry tay riêng cho từng nguồn đi ngược lại lý do bỏ retry
    thủ công ở VCI (tránh phức tạp hoá không cần thiết).
    """
    try:
        client = _fund_client()
        matches = client.filter(symbol)
        exact = matches[matches["shortName"].str.upper() == symbol.upper()]
        if exact.empty:
            raise ValueError(f"no exact fmarket fund match for {symbol}")
        fund_id = int(exact["id"].iloc[0])

        nav = client.nav_report(fundId=fund_id)
        if nav is None or nav.empty:
            raise ValueError(f"no NAV history from fmarket for {symbol}")

        latest = nav.sort_values("date").iloc[-1]
        quote_date = date.fromisoformat(latest["date"])
        price = Decimal(str(latest["nav_per_unit"]))
        if not _is_valid_price(price):
            raise ValueError(f"invalid fmarket NAV for {symbol}: {price}")
        return quote_date, price
    except Exception:
        logger.warning("fmarket fallback failed for %s", symbol, exc_info=True)
        return None


def fetch_price(symbol: str, asset_type: str) -> tuple[date, Decimal] | None:
    """Lấy giá EOD gần nhất của `symbol`.

    STOCK luôn ở sàn — chỉ thử VCI, không fallback fmarket (vô ích, và có rủi
    ro trùng `shortName` với 1 quỹ mở nào đó trên fmarket → lưu nhầm giá).
    FUND gồm cả ETF niêm yết (VCI có data) lẫn quỹ mở không niêm yết (chỉ
    fmarket có data) và `Holding` không phân biệt thêm được 2 loại này qua
    field nào khác — nên với FUND: thử VCI trước, rỗng/lỗi thì fallback
    fmarket trước khi coi là fail hẳn. Trả `None`, không raise ra ngoài — một
    mã lỗi không được làm sập cả job (xem docs/rules/python-job.md).
    """
    result = _fetch_price_vci(symbol)
    if result is not None:
        return result

    if asset_type != "FUND":
        logger.warning("no VCI data for %s (type=%s)", symbol, asset_type)
        return None

    logger.info("no VCI data for %s (possibly an open-end fund) — trying fmarket NAV", symbol)
    result = _fetch_price_fmarket(symbol)
    if result is not None:
        return result

    logger.warning(
        "no price found for %s on VCI or fmarket — if this is an open-end fund not "
        "distributed via fmarket, enter its NAV manually via NavOverride",
        symbol,
    )
    return None


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
        for symbol, asset_type in symbols:
            try:
                result = fetch_price(symbol, asset_type)
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
