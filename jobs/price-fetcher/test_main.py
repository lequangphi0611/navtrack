"""Unit test cho logic của main.py — mock toàn bộ thư viện ngoài (vnstock,
psycopg, time.sleep), KHÔNG gọi mạng/DB thật. Chỉ test logic thuần: cách gọi
SQL, quy tắc chuyển đổi giá, retry/backoff, cô lập lỗi từng mã. Xem
docs/rules/testing.md + docs/rules/python-job.md ("tách fetch_*/save_* để
test được logic riêng").
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, call

import pandas as pd
import pytest

import main

# ---------------------------------------------------------------------------
# get_symbols_to_fetch
# ---------------------------------------------------------------------------


def _fake_cursor(fetchall_result: list[tuple]) -> MagicMock:
    cursor = MagicMock()
    cursor.__enter__.return_value = cursor
    cursor.__exit__.return_value = False
    cursor.fetchall.return_value = fetchall_result
    return cursor


def test_get_symbols_to_fetch_returns_distinct_symbols():
    cursor = _fake_cursor([("VNM",), ("FPT",)])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_symbols_to_fetch(conn)

    assert result == ["VNM", "FPT"]


def test_get_symbols_to_fetch_only_queries_open_stock_and_fund_positions():
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.get_symbols_to_fetch(conn)

    sql = cursor.execute.call_args[0][0]
    assert '"Holding"' in sql
    assert "STOCK" in sql
    assert "FUND" in sql
    assert "quantity > 0" in sql
    # GOLD/BOND mặc định nhập tay — không được xuất hiện trong filter tự động.
    assert "GOLD" not in sql
    assert "BOND" not in sql


# ---------------------------------------------------------------------------
# fetch_price
# ---------------------------------------------------------------------------


def _fake_history(rows: list[tuple[str, float]]) -> pd.DataFrame:
    """rows: (ngày, close) tăng dần theo ngày, đúng shape vnstock trả về."""
    return pd.DataFrame(
        {
            "time": pd.to_datetime([r[0] for r in rows]),
            "open": [r[1] for r in rows],
            "high": [r[1] for r in rows],
            "low": [r[1] for r in rows],
            "close": [r[1] for r in rows],
            "volume": [100] * len(rows),
        }
    )


def _patch_quote(monkeypatch: pytest.MonkeyPatch, quote_instance: MagicMock) -> MagicMock:
    quote_cls = MagicMock(return_value=quote_instance)
    monkeypatch.setattr(main, "Quote", quote_cls)
    monkeypatch.setattr(main.time, "sleep", MagicMock())
    return quote_cls


def test_fetch_price_scales_close_by_1000_into_raw_vnd(monkeypatch: pytest.MonkeyPatch):
    """vnstock (nguồn VCI) trả close theo NGHÌN đồng — PriceQuote phải lưu VND
    thô để khớp đơn vị với Cashflow.pricePerUnit (xem docs/domain/04)."""
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history(
        [("2026-07-09", 55.5), ("2026-07-10", 56.6)]
    )
    quote_cls = _patch_quote(monkeypatch, quote_instance)

    result = main.fetch_price("VNM")

    assert result == (date(2026, 7, 10), Decimal("56600.0"))
    quote_cls.assert_called_once_with(symbol="VNM", source="VCI")


def test_fetch_price_uses_latest_data_date_not_todays_date(monkeypatch: pytest.MonkeyPatch):
    """Ngày trả về phải lấy từ dữ liệu thật (KHÔNG tự suy date.today()) — an
    toàn quanh ngày nghỉ lễ khi phiên gần nhất không phải hôm nay."""
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history([("2026-01-28", 80.0)])
    _patch_quote(monkeypatch, quote_instance)

    quote_date, _price = main.fetch_price("VNM")

    assert quote_date == date(2026, 1, 28)
    assert quote_date != date.today()


def test_fetch_price_retries_with_backoff_then_succeeds(monkeypatch: pytest.MonkeyPatch):
    quote_instance = MagicMock()
    quote_instance.history.side_effect = [
        ConnectionError("network blip"),
        TimeoutError("still down"),
        _fake_history([("2026-07-10", 56.6)]),
    ]
    _patch_quote(monkeypatch, quote_instance)

    result = main.fetch_price("VNM")

    assert result == (date(2026, 7, 10), Decimal("56600.0"))
    assert main.time.sleep.call_args_list == [call(2), call(4)]


def test_fetch_price_returns_none_without_raising_after_max_retries(
    monkeypatch: pytest.MonkeyPatch,
):
    """Hết retry vẫn lỗi -> trả None, KHÔNG raise ra ngoài (một mã lỗi không
    được làm sập cả job)."""
    quote_instance = MagicMock()
    quote_instance.history.side_effect = ConnectionError("down")
    _patch_quote(monkeypatch, quote_instance)

    result = main.fetch_price("VNM")

    assert result is None
    assert main.time.sleep.call_args_list == [call(2), call(4), call(8)]
    assert main.time.sleep.call_count == main.MAX_RETRIES


def test_fetch_price_treats_empty_dataframe_as_failure(monkeypatch: pytest.MonkeyPatch):
    quote_instance = MagicMock()
    quote_instance.history.return_value = pd.DataFrame()
    _patch_quote(monkeypatch, quote_instance)

    result = main.fetch_price("ZZZ")

    assert result is None


def test_fetch_price_never_raises_even_on_constructor_error(monkeypatch: pytest.MonkeyPatch):
    """Mã sai định dạng -> Quote() raise ValueError ngay khi khởi tạo — vẫn
    phải bị nuốt lại thành None, không văng ra ngoài vòng lặp ở main()."""
    monkeypatch.setattr(main, "Quote", MagicMock(side_effect=ValueError("bad symbol")))
    monkeypatch.setattr(main.time, "sleep", MagicMock())

    result = main.fetch_price("X")

    assert result is None


# ---------------------------------------------------------------------------
# save_price
# ---------------------------------------------------------------------------


def test_save_price_upserts_with_correct_sql_and_params(monkeypatch: pytest.MonkeyPatch):
    fixed_id = main.uuid.UUID(int=1)
    monkeypatch.setattr(main.uuid, "uuid4", lambda: fixed_id)
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.save_price(conn, "VNM", date(2026, 7, 10), Decimal("56600.0000"))

    cursor.execute.assert_called_once()
    sql, params = cursor.execute.call_args[0]
    assert '"PriceQuote"' in sql
    assert "ON CONFLICT (symbol, date) DO UPDATE" in sql
    assert params == (fixed_id.hex, "VNM", date(2026, 7, 10), Decimal("56600.0000"), "vnstock")


def test_save_price_accepts_custom_source(monkeypatch: pytest.MonkeyPatch):
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.save_price(conn, "SJC", date(2026, 7, 10), Decimal("12000000"), source="manual")

    params = cursor.execute.call_args[0][1]
    assert params[-1] == "manual"


# ---------------------------------------------------------------------------
# main() — orchestration & cô lập lỗi
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_conn() -> MagicMock:
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    return conn


def _patch_main_infra(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock, symbols: list[str]
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setattr(main, "load_dotenv", MagicMock())
    monkeypatch.setattr(main.psycopg, "connect", MagicMock(return_value=fake_conn))
    monkeypatch.setattr(main, "get_symbols_to_fetch", MagicMock(return_value=symbols))


def test_main_isolates_one_symbol_failure_and_saves_the_rest(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    """Một mã không lấy được giá (fetch_price -> None) không được chặn các mã
    còn lại — xem docs/rules/python-job.md 'Cô lập lỗi'."""
    _patch_main_infra(monkeypatch, fake_conn, ["VNM", "BAD", "FPT"])

    def fake_fetch(symbol: str):
        if symbol == "BAD":
            return None
        return date(2026, 7, 10), Decimal("56600.0")

    save_mock = MagicMock()
    monkeypatch.setattr(main, "fetch_price", MagicMock(side_effect=fake_fetch))
    monkeypatch.setattr(main, "save_price", save_mock)

    main.main()

    saved_symbols = [c.args[1] for c in save_mock.call_args_list]
    assert saved_symbols == ["VNM", "FPT"]
    assert fake_conn.commit.call_count == 2


def test_main_rolls_back_and_continues_when_save_price_raises(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    """Lỗi bất ngờ khi ghi DB cho một mã (vd deadlock) không được làm mất mã
    tiếp theo — connection phải rollback để dùng lại được."""
    _patch_main_infra(monkeypatch, fake_conn, ["VNM", "FPT"])
    monkeypatch.setattr(
        main, "fetch_price", MagicMock(return_value=(date(2026, 7, 10), Decimal("1")))
    )

    def fake_save(conn, symbol, quote_date, price):
        if symbol == "VNM":
            raise RuntimeError("db write error")

    monkeypatch.setattr(main, "save_price", MagicMock(side_effect=fake_save))

    main.main()  # không được raise ra ngoài

    assert fake_conn.rollback.call_count == 1
    assert fake_conn.commit.call_count == 1  # chỉ FPT commit thành công


def test_main_exits_when_database_url_missing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(main, "load_dotenv", MagicMock())

    with pytest.raises(SystemExit):
        main.main()
