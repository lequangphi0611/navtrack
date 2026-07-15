"""Entry point cho job chốt snapshot (GitHub Actions, chạy theo lịch cron).

Đóng băng NAV của từng `Holding` đang mở + tổng danh mục của từng user tại
mốc **cuối tháng liền trước** (`period = PERIODIC`, cron fire ngày 01 hằng
tháng), và thêm mốc **31/12 năm trước** (`period = YEAR_END`) khi cron fire
đúng tháng 1 — xem docs/domain/06-snapshots.md.

Job này KHÔNG gọi vnstock (không cần giá mới) — chỉ đọc `Holding`/
`NavOverride`/`PriceQuote` đã có sẵn trong Postgres (do `jobs/price-fetcher`
và người dùng nhập tay ghi trước đó) rồi tính lại NAV tại đúng ngày cutoff.

Công thức định giá (resolve_price/NAV = quantity * price) ĐỒNG BỘ THỦ CÔNG với
`src/lib/valuation.ts` (`resolvePrice`/`valuateHolding`) — TS không import
được Python và ngược lại (chỉ chia sẻ schema Postgres, xem
docs/rules/project-structure.md). Sửa domain rule định giá ở một nơi thì nhớ
soát lại nơi kia.

Lỗi một Holding không được làm sập cả job — xem docs/rules/python-job.md.
"""

import logging
import os
import uuid
from datetime import date, timedelta
from decimal import Decimal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("snapshot-cron")

# Nguồn giá tổng danh mục luôn "AUTO" — một tổng là con số TÍNH TOÁN (sum),
# không phải giá trị lấy thẳng từ 1 dòng NavOverride. "MANUAL" chỉ dành cho
# giá trị đúng bằng 1 giá nhập tay (cấp Holding) — process/DECISION.md 2026-07-14.
PORTFOLIO_SNAPSHOT_SOURCE = "AUTO"


def to_libpq_url(database_url: str) -> str:
    """Bỏ query param `schema` (chỉ Prisma hiểu) để psycopg parse được cùng
    một DATABASE_URL dùng chung với app Next — xem docs/rules/project-structure.md.

    Trùng lặp y hệt hàm cùng tên ở jobs/price-fetcher/main.py — chấp nhận
    được vì mỗi job Python độc lập, không import chéo (xem docs/rules/python-job.md).
    """
    parsed = urlparse(database_url)
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"]
    return urlunparse(parsed._replace(query=urlencode(query)))


# --- Xác định mốc cần chốt ---------------------------------------------------
#
# CHỈ implement nhánh tháng (PERIODIC) + cuối năm (YEAR_END) — nhánh TUẦN nằm
# ngoài phạm vi issue #36. Khi cần thêm cron tuần: đọc day-of-week từ chính
# cron expression trong workflow (giống cách tháng đọc "ngày 01") và thêm một
# target ("PERIODIC", ngày Chủ Nhật vừa qua) vào get_snapshot_targets(), tương
# tự year_end_date() bên dưới.


def last_day_of_previous_month(today: date) -> date:
    """Ngày cuối tháng liền trước `today`. Pure — không gọi date.today() bên
    trong để test được với ngày giả lập bất kỳ (kể cả biên tháng 2 nhuận)."""
    return today.replace(day=1) - timedelta(days=1)


def year_end_date(today: date) -> date | None:
    """31/12 năm trước nếu `today` đang ở tháng 1 (cron 01/01 ghi YEAR_END cho
    31/12 năm trước) — None ở mọi tháng khác."""
    if today.month == 1:
        return date(today.year - 1, 12, 31)
    return None


def get_snapshot_targets(today: date) -> list[tuple[str, date]]:
    """Danh sách (period, date) cần chốt khi job chạy vào ngày `today`.

    Luôn có đúng 1 mốc PERIODIC (cuối tháng trước); thêm 1 mốc YEAR_END (cùng
    ngày 31/12, khác `period`) khi `today` ở tháng 1 — 2 dòng khác nhau vì
    `period` nằm trong khóa dedup (xem migration `add_snapshot_unique_constraint`).
    """
    targets: list[tuple[str, date]] = [("PERIODIC", last_day_of_previous_month(today))]
    year_end = year_end_date(today)
    if year_end is not None:
        targets.append(("YEAR_END", year_end))
    return targets


# --- Định giá (ĐỒNG BỘ THỦ CÔNG với src/lib/valuation.ts) --------------------

# (date, price) của dòng "mới nhất <= cutoff_date" đã lọc sẵn ở tầng SQL.
LatestQuoteRow = tuple[date, Decimal]


def resolve_price(
    nav_override: LatestQuoteRow | None,
    price_quote: LatestQuoteRow | None,
) -> tuple[Decimal, str, date] | None:
    """Mirror `resolvePrice()` (src/lib/valuation.ts) — so `date` giữa
    NavOverride (nhập tay) và PriceQuote (tự động), dùng nguồn có `date` mới
    hơn; cùng ngày thì NavOverride thắng (issue #40). Chỉ có 1 nguồn -> dùng
    nguồn đó (GOLD/BOND không có PriceQuote). Không nguồn nào -> None (thiếu
    giá, KHÔNG mặc định 0 — xem docs/domain/04).

    Trả `(price, source, price_date)` — `source` là "MANUAL"/"AUTO", khớp
    `SnapshotSource` enum ở Postgres.
    """
    if nav_override is not None and price_quote is not None:
        nav_date, nav_price = nav_override
        quote_date, quote_price = price_quote
        if nav_date >= quote_date:
            return nav_price, "MANUAL", nav_date
        return quote_price, "AUTO", quote_date
    if nav_override is not None:
        nav_date, nav_price = nav_override
        return nav_price, "MANUAL", nav_date
    if price_quote is not None:
        quote_date, quote_price = price_quote
        return quote_price, "AUTO", quote_date
    return None


# --- Đọc dữ liệu --------------------------------------------------------------


def get_open_holdings(conn: psycopg.Connection) -> list[dict]:
    """Mọi Holding đang mở (`quantity > 0`), MỌI loại tài sản — khác
    `get_symbols_to_fetch` của price-fetcher (chỉ STOCK/FUND): snapshot cần
    chốt cả GOLD/BOND (chỉ có NavOverride, không có PriceQuote)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "userId", symbol, quantity
            FROM "Holding"
            WHERE quantity > 0
            """
        )
        return [
            {
                "id": row[0],
                "userId": row[1],
                "symbol": row[2],
                "quantity": Decimal(str(row[3])),
            }
            for row in cur.fetchall()
        ]


def get_all_holding_user_ids(conn: psycopg.Connection) -> set[str]:
    """Mọi user đã từng tạo ít nhất 1 Holding (mở HAY đóng) — phạm vi "mọi
    user" của checklist issue #36 (process/DECISION.md 2026-07-14), KHÔNG phải
    mọi dòng `User` (user chưa từng thêm gì thì không có gì để chốt)."""
    with conn.cursor() as cur:
        cur.execute('SELECT DISTINCT "userId" FROM "Holding"')
        return {row[0] for row in cur.fetchall()}


def get_latest_nav_overrides(
    conn: psycopg.Connection, holding_ids: list[str], cutoff_date: date
) -> dict[str, LatestQuoteRow]:
    """Dòng NavOverride mới nhất <= cutoff_date cho mỗi holdingId — mirror
    `getLatestNavOverrides` (src/lib/valuation.ts), viết lại bằng SQL thuần
    (`DISTINCT ON`) thay vì Prisma `distinct`/`orderBy`."""
    if not holding_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON ("holdingId") "holdingId", date, price
            FROM "NavOverride"
            WHERE "holdingId" = ANY(%s) AND date <= %s
            ORDER BY "holdingId", date DESC
            """,
            (holding_ids, cutoff_date),
        )
        return {row[0]: (row[1], Decimal(str(row[2]))) for row in cur.fetchall()}


def get_latest_price_quotes(
    conn: psycopg.Connection, symbols: list[str], cutoff_date: date
) -> dict[str, LatestQuoteRow]:
    """Dòng PriceQuote mới nhất <= cutoff_date cho mỗi symbol — mirror
    `getLatestPriceQuotes` (src/lib/valuation.ts), viết lại bằng SQL thuần."""
    if not symbols:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (symbol) symbol, date, price
            FROM "PriceQuote"
            WHERE symbol = ANY(%s) AND date <= %s
            ORDER BY symbol, date DESC
            """,
            (symbols, cutoff_date),
        )
        return {row[0]: (row[1], Decimal(str(row[2]))) for row in cur.fetchall()}


# --- Ghi snapshot (upsert idempotent) -----------------------------------------


def upsert_holding_snapshot(
    conn: psycopg.Connection,
    user_id: str,
    holding_id: str,
    snapshot_date: date,
    value: Decimal,
    source: str,
    period: str,
) -> None:
    """Upsert idempotent theo khóa của partial unique index
    `Snapshot_holding_unique` (`"holdingId", "date", "period"` WHERE
    `"holdingId" IS NOT NULL` — migration `20260714075356_add_snapshot_unique_constraint`).
    Chạy lại cùng mốc ghi đè `value`/`source`/`updatedAt`, không tạo dòng mới.

    `"updatedAt"` PHẢI được set thủ công ở đây (mirror `save_price`,
    jobs/price-fetcher/main.py) — cột này KHÔNG có default ở DB (Prisma
    `@default(now())` chỉ áp dụng cho backfill lúc migrate, ghi mới qua Prisma
    Client mới tự set; raw SQL từ job Python không đi qua Prisma Client nên
    phải tự set, nếu không sẽ NULL/giữ giá trị cũ khi upsert)."""
    snapshot_id = uuid.uuid4().hex
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Snapshot"
                ("id", "userId", "holdingId", "date", "value", "source", "period", "frozen", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, true, now(), now())
            ON CONFLICT ("holdingId", "date", "period") WHERE "holdingId" IS NOT NULL
            DO UPDATE SET "value" = EXCLUDED."value", "source" = EXCLUDED."source", "updatedAt" = now()
            """,
            (snapshot_id, user_id, holding_id, snapshot_date, value, source, period),
        )


def upsert_portfolio_snapshot(
    conn: psycopg.Connection,
    user_id: str,
    snapshot_date: date,
    value: Decimal,
    period: str,
) -> None:
    """Upsert idempotent cho dòng tổng danh mục (`holdingId IS NULL`) — khóa
    của partial unique index `Snapshot_portfolio_unique` (`"userId", "date",
    "period"` WHERE `"holdingId" IS NULL`). `source` luôn AUTO (xem
    PORTFOLIO_SNAPSHOT_SOURCE). `"updatedAt"` set thủ công — xem ghi chú ở
    upsert_holding_snapshot phía trên."""
    snapshot_id = uuid.uuid4().hex
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Snapshot"
                ("id", "userId", "holdingId", "date", "value", "source", "period", "frozen", "createdAt", "updatedAt")
            VALUES (%s, %s, NULL, %s, %s, %s, %s, true, now(), now())
            ON CONFLICT ("userId", "date", "period") WHERE "holdingId" IS NULL
            DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
            """,
            (snapshot_id, user_id, snapshot_date, value, PORTFOLIO_SNAPSHOT_SOURCE, period),
        )


# --- Orchestration -------------------------------------------------------------


def run_snapshot(conn: psycopg.Connection, period: str, snapshot_date: date) -> None:
    """Chốt snapshot cho một mốc (period, snapshot_date): mỗi Holding đang mở
    của mọi user + 1 dòng tổng danh mục mỗi user.

    Ca biên (process/DECISION.md 2026-07-14, docs/domain/06-snapshots.md):
    - Holding đang mở KHÔNG resolve được giá -> KHÔNG ghi dòng Snapshot riêng
      cho Holding đó (không mặc định 0), log rõ (holdingId, userId, symbol,
      date, period).
    - Tổng danh mục của 1 user: còn >= 1 Holding resolve được giá -> ghi tổng
      = tổng các Holding đã biết (PARTIAL, log rõ mã thiếu). Toàn bộ Holding
      đang mở đều thiếu giá -> bỏ qua hẳn dòng tổng (0 sẽ sai).
    - User không có Holding nào đang mở (đã bán hết/toàn bộ Holding đã đóng)
      -> NAV = 0 là số thật, vẫn ghi.
    - User chưa từng tạo Holding nào -> không có gì để chốt, bỏ qua (không có
      trong get_all_holding_user_ids()).
    """
    all_user_ids = get_all_holding_user_ids(conn)
    open_holdings = get_open_holdings(conn)

    holding_ids = [h["id"] for h in open_holdings]
    symbols = list({h["symbol"] for h in open_holdings})
    nav_overrides = get_latest_nav_overrides(conn, holding_ids, snapshot_date)
    price_quotes = get_latest_price_quotes(conn, symbols, snapshot_date)

    nav_by_user: dict[str, Decimal] = {}
    missing_symbols_by_user: dict[str, list[str]] = {}
    open_user_ids: set[str] = set()

    for holding in open_holdings:
        user_id = holding["userId"]
        holding_id = holding["id"]
        symbol = holding["symbol"]
        open_user_ids.add(user_id)

        try:
            resolved = resolve_price(nav_overrides.get(holding_id), price_quotes.get(symbol))
            if resolved is None:
                logger.warning(
                    "missing price for holding=%s user=%s symbol=%s date=%s period=%s "
                    "— skipping snapshot for this holding",
                    holding_id,
                    user_id,
                    symbol,
                    snapshot_date,
                    period,
                )
                missing_symbols_by_user.setdefault(user_id, []).append(symbol)
                continue

            price, source, _price_date = resolved
            value = holding["quantity"] * price
            upsert_holding_snapshot(conn, user_id, holding_id, snapshot_date, value, source, period)
            conn.commit()
            nav_by_user[user_id] = nav_by_user.get(user_id, Decimal(0)) + value
        except Exception:
            # Lỗi bất ngờ (vd deadlock khi ghi DB) — cô lập, không chặn các
            # Holding còn lại (docs/rules/python-job.md "Cô lập lỗi").
            logger.exception(
                "unexpected error snapshotting holding=%s user=%s symbol=%s",
                holding_id,
                user_id,
                symbol,
            )
            conn.rollback()
            missing_symbols_by_user.setdefault(user_id, []).append(symbol)
            continue

    for user_id in all_user_ids:
        if user_id not in open_user_ids:
            # Không có Holding nào đang mở — NAV = 0 là số thật (đã bán hết,
            # hoặc mọi Holding đã tạo đều đóng).
            upsert_portfolio_snapshot(conn, user_id, snapshot_date, Decimal(0), period)
            conn.commit()
            continue

        nav = nav_by_user.get(user_id)
        if nav is None:
            # Có Holding đang mở nhưng KHÔNG mã nào resolve được giá — 0 sẽ
            # sai, bỏ qua hẳn dòng tổng cho user này ở mốc này.
            logger.warning(
                "all open Holdings missing price for user=%s date=%s period=%s "
                "— skipping portfolio snapshot entirely",
                user_id,
                snapshot_date,
                period,
            )
            continue

        missing = missing_symbols_by_user.get(user_id, [])
        if missing:
            logger.warning(
                "PARTIAL portfolio snapshot for user=%s date=%s period=%s — missing price for: %s",
                user_id,
                snapshot_date,
                period,
                ", ".join(missing),
            )

        upsert_portfolio_snapshot(conn, user_id, snapshot_date, nav, period)
        conn.commit()


def _today() -> date:
    """Tách khỏi main() để test được — `date.today()` là builtin bất biến,
    monkeypatch trực tiếp `datetime.date` khó và dễ rò rỉ sang test khác."""
    return date.today()


def main() -> None:
    load_dotenv()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(
            "DATABASE_URL is not set. Copy .env.example to .env (local) "
            "or set the DATABASE_URL secret (GitHub Actions)."
        )
    database_url = to_libpq_url(database_url)

    today = _today()
    targets = get_snapshot_targets(today)

    with psycopg.connect(database_url) as conn:
        for period, snapshot_date in targets:
            logger.info("running snapshot period=%s date=%s", period, snapshot_date)
            run_snapshot(conn, period, snapshot_date)
            logger.info("done snapshot period=%s date=%s", period, snapshot_date)


if __name__ == "__main__":
    main()
