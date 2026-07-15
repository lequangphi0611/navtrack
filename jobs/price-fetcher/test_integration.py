"""Integration test cho main.py — chạy trên Postgres THẬT (ephemeral, tái dùng
docker-compose.test.yml + .env.test, cổng 5434), khác `test_main.py` (mock hoàn toàn
psycopg/vnstock). `fetch_price` (gọi vnstock, mạng thật) vẫn bị monkeypatch ở đây — job này
chỉ verify phần ghi/đọc Postgres thật, không gọi mạng thật trong test (xem
process/DECISION.md, mục 2026-07-15). Chứng minh những điều unit test mock KHÔNG chứng minh
được:

1. `save_price()` upsert thật idempotent theo `(symbol, date)` trên constraint
   `PriceQuote_symbol_date_key` thật, không phải giả định về câu SQL.
2. `get_symbols_to_fetch()` đọc đúng dữ liệu `Holding` thật (lọc STOCK/FUND đang mở, loại
   GOLD/BOND và vị thế đã đóng).
3. `main()` chạy hết đường đi thật (đọc Holding -> fetch (mock) -> ghi PriceQuote), cô lập
   lỗi 1 mã không mất các mã còn lại, và chạy 2 lần liên tiếp không sinh dòng trùng.

Chạy qua `pnpm test:python-integration` (tự docker compose up DB test + `prisma migrate
deploy` trước khi gọi pytest) — xem `scripts/python-integration-test.mjs` và
docs/rules/python-job.md (mục "Test — unit + integration"). KHÔNG chạy trực tiếp
`pytest -m integration` trừ khi đã tự đảm bảo `DATABASE_URL` trỏ đúng DB test (guard bên
dưới sẽ chặn nếu sai).
"""

import os
import uuid
from datetime import date
from decimal import Decimal

import psycopg
import pytest

import main

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Guard an toàn — KHÔNG BAO GIỜ được lỡ tay TRUNCATE/INSERT vào DB dev/prod.
# `.env` của app không cố định host (có lúc là Neon prod) — DATABASE_URL của integration
# test phải luôn trỏ đúng DB test ephemeral (cổng 5434, docker-compose.test.yml).
#
# Copy y hệt logic guard của jobs/snapshot-cron/test_integration.py — cố ý KHÔNG import
# chéo giữa 2 job Python (chỉ chia sẻ schema Postgres, xem docs/rules/project-structure.md).
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _guard_test_database_url() -> None:
    """Chặn cứng trước khi bất kỳ test nào trong file này chạy — không autouse fixture
    nào khác (conn, clean_tables) được phép đụng DB nếu guard này chưa pass. Fixture khác
    request `conn`/`clean_tables` (phụ thuộc trực tiếp/gián tiếp vào guard qua `conn`) nên
    thứ tự chạy được đảm bảo bởi dependency graph của pytest, không chỉ thứ tự khai báo."""
    database_url = os.environ.get("DATABASE_URL", "")
    if ":5434" not in database_url:
        pytest.fail(
            "DATABASE_URL khong tro toi DB test ephemeral (cong 5434, "
            f"docker-compose.test.yml) — got {database_url!r}. KHONG chay integration "
            "test truc tiep; dung `pnpm test:python-integration` (tu docker compose up "
            "DB test truoc khi goi pytest)."
        )


@pytest.fixture
def conn(_guard_test_database_url: None):
    """Kết nối psycopg thật tới DB test — tái dùng `to_libpq_url()` đã có trong main.py để
    bỏ query param `schema` (chỉ Prisma hiểu), giống cách app/job khác kết nối."""
    database_url = main.to_libpq_url(os.environ["DATABASE_URL"])
    with psycopg.connect(database_url) as connection:
        yield connection


@pytest.fixture(autouse=True)
def clean_tables(conn: psycopg.Connection):
    """DB ephemeral chỉ sạch giữa các lần `docker compose up`, không sạch giữa các test
    trong cùng 1 lần chạy — TRUNCATE trước mỗi test để test này không phụ thuộc dữ liệu
    test trước đó (và ngược lại)."""
    with conn.cursor() as cur:
        cur.execute('TRUNCATE TABLE "PriceQuote", "Holding", "User" CASCADE')
    conn.commit()
    yield


# ---------------------------------------------------------------------------
# Helper insert — chỉ set đúng cột bắt buộc theo prisma/schema.prisma. `updatedAt` không có
# DB-level default (Prisma @updatedAt chỉ set ở tầng Client, không phải trigger Postgres)
# nên phải set tay khi insert bằng SQL thuần.
# ---------------------------------------------------------------------------


def _insert_user(conn: psycopg.Connection, *, user_id: str, email: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "User" ("id", "email", "updatedAt")
            VALUES (%s, %s, now())
            """,
            (user_id, email),
        )
    conn.commit()
    return user_id


def _insert_holding(
    conn: psycopg.Connection,
    *,
    holding_id: str,
    user_id: str,
    symbol: str,
    quantity: Decimal,
    asset_type: str = "STOCK",
    unit: str = "co phan",
) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Holding"
                ("id", "userId", "type", "symbol", "unit", "quantity", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, now())
            """,
            (holding_id, user_id, asset_type, symbol, unit, quantity),
        )
    conn.commit()
    return holding_id


def _price_quote_count_and_max_price(
    conn: psycopg.Connection, *, symbol: str, quote_date: date
) -> tuple[int, Decimal | None]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*), MAX(price) FROM "PriceQuote" WHERE symbol = %s AND date = %s',
            (symbol, quote_date),
        )
        count, price = cur.fetchone()
        return count, price


# ---------------------------------------------------------------------------
# save_price — upsert idempotent trên constraint thật
# ---------------------------------------------------------------------------


def test_save_price_upsert_is_idempotent_on_real_db(conn: psycopg.Connection):
    """Chạy `save_price()` 2 lần trên cùng `(symbol, date)` với giá KHÁC nhau — đích upsert
    idempotent dựa vào `@@unique([symbol, date])` thật (`PriceQuote_symbol_date_key`), không
    phải giả định câu SQL `ON CONFLICT` như test_main.py."""
    quote_date = date(2026, 7, 10)

    main.save_price(conn, "VNM", quote_date, Decimal("50000"))
    conn.commit()
    main.save_price(conn, "VNM", quote_date, Decimal("55000"))
    conn.commit()

    count, price = _price_quote_count_and_max_price(conn, symbol="VNM", quote_date=quote_date)
    assert count == 1
    assert Decimal(price) == Decimal("55000")


# ---------------------------------------------------------------------------
# get_symbols_to_fetch — đọc Holding thật, lọc đúng STOCK/FUND đang mở
# ---------------------------------------------------------------------------


def test_get_symbols_to_fetch_reads_real_holdings(conn: psycopg.Connection):
    """GOLD/BOND (mặc định nhập tay qua NavOverride) và vị thế đã đóng (quantity = 0) không
    được xuất hiện — chỉ STOCK/FUND đang có vị thế mở."""
    user_id = _insert_user(conn, user_id=uuid.uuid4().hex, email=f"{uuid.uuid4().hex}@example.com")
    _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="VNM",
        quantity=Decimal("10"),
        asset_type="STOCK",
    )
    _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="VESAF",
        quantity=Decimal("5"),
        asset_type="FUND",
    )
    _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="SJC",
        quantity=Decimal("2"),
        asset_type="GOLD",
        unit="chi",
    )
    _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="FPT",
        quantity=Decimal("0"),
        asset_type="STOCK",
    )

    result = main.get_symbols_to_fetch(conn)

    assert set(result) == {("VNM", "STOCK"), ("VESAF", "FUND")}


# ---------------------------------------------------------------------------
# main() — cô lập lỗi và idempotent qua toàn bộ đường đi thật
# ---------------------------------------------------------------------------


def test_main_isolates_one_symbol_failure_and_persists_the_rest_on_real_db(
    conn: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
):
    """`fetch_price` (mock, không gọi mạng thật) trả None cho 1 mã — mã đó không được có
    dòng PriceQuote nào, các mã còn lại vẫn ghi đúng, qua đúng đường đi thật `main()` ->
    `get_symbols_to_fetch()` -> `fetch_price()` -> `save_price()` trên Postgres thật."""
    user_id = _insert_user(conn, user_id=uuid.uuid4().hex, email=f"{uuid.uuid4().hex}@example.com")
    for symbol in ("VNM", "BAD", "FPT"):
        _insert_holding(
            conn,
            holding_id=uuid.uuid4().hex,
            user_id=user_id,
            symbol=symbol,
            quantity=Decimal("10"),
            asset_type="STOCK",
        )

    quote_date = date(2026, 7, 10)

    def fake_fetch_price(symbol: str, asset_type: str):
        if symbol == "BAD":
            return None
        return quote_date, Decimal("56600")

    monkeypatch.setattr(main, "fetch_price", fake_fetch_price)

    main.main()

    for symbol in ("VNM", "FPT"):
        count, price = _price_quote_count_and_max_price(conn, symbol=symbol, quote_date=quote_date)
        assert count == 1
        assert Decimal(price) == Decimal("56600")

    bad_count, _ = _price_quote_count_and_max_price(conn, symbol="BAD", quote_date=quote_date)
    assert bad_count == 0


def test_main_run_twice_does_not_duplicate_price_quote_rows(
    conn: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
):
    """Gọi `main()` 2 lần liên tiếp trên cùng dữ liệu (vd retry `workflow_dispatch`) không
    được sinh dòng `PriceQuote` trùng — verify idempotent qua toàn bộ đường đi `main()` ->
    `save_price()` -> constraint `@@unique([symbol, date])` thật, không chỉ riêng
    `save_price()`."""
    user_id = _insert_user(conn, user_id=uuid.uuid4().hex, email=f"{uuid.uuid4().hex}@example.com")
    _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="VNM",
        quantity=Decimal("10"),
        asset_type="STOCK",
    )

    quote_date = date(2026, 7, 10)
    monkeypatch.setattr(
        main, "fetch_price", lambda symbol, asset_type: (quote_date, Decimal("56600"))
    )

    main.main()
    main.main()

    count, price = _price_quote_count_and_max_price(conn, symbol="VNM", quote_date=quote_date)
    assert count == 1
    assert Decimal(price) == Decimal("56600")
