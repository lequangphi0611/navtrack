"""Entry point cho job lấy giá (GitHub Actions, chạy theo lịch).

Đây là khung hạ tầng: chỉ xác nhận kết nối Postgres dùng chung với Prisma.
Logic lấy giá thật (vnstock) + upsert PriceQuote sẽ thêm ở Phase 2 — xem
docs/rules/python-job.md và process/phase-2.md.
"""

import logging
import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("price-fetcher")


def to_libpq_url(database_url: str) -> str:
    """Bỏ query param `schema` (chỉ Prisma hiểu) để psycopg parse được cùng
    một DATABASE_URL dùng chung với app Next — xem docs/rules/project-structure.md."""
    parsed = urlparse(database_url)
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"]
    return urlunparse(parsed._replace(query=urlencode(query)))


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
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    logger.info("connected to database OK")


if __name__ == "__main__":
    main()
