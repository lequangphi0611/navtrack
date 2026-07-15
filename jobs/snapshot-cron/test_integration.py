"""Integration test cho main.py — chạy trên Postgres THẬT (ephemeral, tái dùng
docker-compose.test.yml + .env.test, cổng 5434), khác `test_main.py` (mock hoàn toàn
psycopg). Chứng minh 2 điều unit test mock KHÔNG chứng minh được:

1. `run_snapshot()` gọi 2 lần liên tiếp trên cùng dữ liệu KHÔNG sinh dòng `Snapshot` trùng
   — dựa vào 2 partial unique index thật từ migration
   `20260714075356_add_snapshot_unique_constraint`, không phải giả định về câu SQL.
2. Giá trị NAV ghi thật đúng bằng `quantity * price` đọc từ `PriceQuote` thật.

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
        cur.execute(
            'TRUNCATE TABLE "Snapshot", "NavOverride", "PriceQuote", "Holding", "User" CASCADE'
        )
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


def _insert_price_quote(
    conn: psycopg.Connection,
    *,
    symbol: str,
    quote_date: date,
    price: Decimal,
    source: str = "vnstock",
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "PriceQuote" ("id", "symbol", "date", "price", "source", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, now())
            """,
            (uuid.uuid4().hex, symbol, quote_date, price, source),
        )
    conn.commit()


def _holding_snapshot_count(
    conn: psycopg.Connection, *, holding_id: str, snapshot_date: date, period: str
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM "Snapshot"
            WHERE "holdingId" = %s AND "date" = %s AND "period" = %s
            """,
            (holding_id, snapshot_date, period),
        )
        return cur.fetchone()[0]


def _portfolio_snapshot_count(
    conn: psycopg.Connection, *, user_id: str, snapshot_date: date, period: str
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM "Snapshot"
            WHERE "userId" = %s AND "holdingId" IS NULL AND "date" = %s AND "period" = %s
            """,
            (user_id, snapshot_date, period),
        )
        return cur.fetchone()[0]


# ---------------------------------------------------------------------------
# Test trọng tâm — idempotent trên DB thật (2 partial unique index)
# ---------------------------------------------------------------------------


def test_run_snapshot_twice_does_not_create_duplicate_rows(conn: psycopg.Connection):
    """Gọi run_snapshot() 2 lần liên tiếp trên cùng dữ liệu — chạy lại (vd retry
    workflow_dispatch) phải ghi đè, không tạo dòng Snapshot mới. Chứng minh bằng COUNT(*)
    thật trên Postgres có 2 partial unique index của migration
    `add_snapshot_unique_constraint`, không phải giả định câu SQL như test_main.py."""
    user_id = _insert_user(conn, user_id=uuid.uuid4().hex, email=f"{uuid.uuid4().hex}@example.com")
    holding_id = _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="VNM",
        quantity=Decimal("10"),
    )
    cutoff = date(2026, 6, 30)
    _insert_price_quote(conn, symbol="VNM", quote_date=cutoff, price=Decimal("50000"))

    main.run_snapshot(conn, "PERIODIC", cutoff)
    main.run_snapshot(conn, "PERIODIC", cutoff)

    assert (
        _holding_snapshot_count(
            conn, holding_id=holding_id, snapshot_date=cutoff, period="PERIODIC"
        )
        == 1
    )
    assert (
        _portfolio_snapshot_count(conn, user_id=user_id, snapshot_date=cutoff, period="PERIODIC")
        == 1
    )


def test_run_snapshot_writes_nav_equal_to_quantity_times_price(conn: psycopg.Connection):
    """Giá trị Snapshot ghi thật = quantity * price đọc từ PriceQuote thật (không mock) —
    cả dòng Holding lẫn dòng tổng danh mục (chỉ 1 Holding nên tổng = giá trị Holding đó)."""
    user_id = _insert_user(conn, user_id=uuid.uuid4().hex, email=f"{uuid.uuid4().hex}@example.com")
    holding_id = _insert_holding(
        conn,
        holding_id=uuid.uuid4().hex,
        user_id=user_id,
        symbol="VNM",
        quantity=Decimal("10"),
    )
    cutoff = date(2026, 6, 30)
    _insert_price_quote(conn, symbol="VNM", quote_date=cutoff, price=Decimal("50000"))

    main.run_snapshot(conn, "PERIODIC", cutoff)

    with conn.cursor() as cur:
        cur.execute(
            'SELECT "value" FROM "Snapshot" WHERE "holdingId" = %s AND "date" = %s AND "period" = %s',
            (holding_id, cutoff, "PERIODIC"),
        )
        holding_value = cur.fetchone()[0]
        cur.execute(
            """
            SELECT "value" FROM "Snapshot"
            WHERE "userId" = %s AND "holdingId" IS NULL AND "date" = %s AND "period" = %s
            """,
            (user_id, cutoff, "PERIODIC"),
        )
        portfolio_value = cur.fetchone()[0]

    assert Decimal(holding_value) == Decimal("10") * Decimal("50000")
    assert Decimal(portfolio_value) == Decimal("500000")
