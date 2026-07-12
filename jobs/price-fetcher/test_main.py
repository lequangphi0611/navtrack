"""Unit test cho logic của main.py — mock toàn bộ thư viện ngoài (vnstock,
psycopg), KHÔNG gọi mạng/DB thật. Chỉ test logic thuần: cách gọi SQL, quy tắc
chuyển đổi/validate giá, fallback VCI -> fmarket, cô lập lỗi từng mã. Xem
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


def test_get_symbols_to_fetch_returns_distinct_symbols_with_type():
    cursor = _fake_cursor([("VNM", "STOCK"), ("VESAF", "FUND")])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_symbols_to_fetch(conn)

    assert result == [("VNM", "STOCK"), ("VESAF", "FUND")]


def test_get_symbols_to_fetch_only_queries_open_stock_and_fund_positions():
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.get_symbols_to_fetch(conn)

    sql = cursor.execute.call_args[0][0]
    assert '"Holding"' in sql
    assert "symbol, type" in sql
    assert "STOCK" in sql
    assert "FUND" in sql
    assert "quantity > 0" in sql
    # GOLD/BOND mặc định nhập tay — không được xuất hiện trong filter tự động.
    assert "GOLD" not in sql
    assert "BOND" not in sql


# ---------------------------------------------------------------------------
# _is_valid_price
# ---------------------------------------------------------------------------


def test_is_valid_price_accepts_positive_finite_decimal():
    assert main._is_valid_price(Decimal("56600.0")) is True


@pytest.mark.parametrize(
    "price",
    [Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity"), Decimal("0"), Decimal("-1")],
)
def test_is_valid_price_rejects_nan_infinite_zero_and_negative(price: Decimal):
    assert main._is_valid_price(price) is False


# ---------------------------------------------------------------------------
# _fetch_price_vci
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
    return quote_cls


def test_fetch_price_vci_scales_close_by_1000_into_raw_vnd(monkeypatch: pytest.MonkeyPatch):
    """vnstock (nguồn VCI) trả close theo NGHÌN đồng — PriceQuote phải lưu VND
    thô để khớp đơn vị với Cashflow.pricePerUnit (xem docs/domain/04)."""
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history(
        [("2026-07-09", 55.5), ("2026-07-10", 56.6)]
    )
    quote_cls = _patch_quote(monkeypatch, quote_instance)

    result = main._fetch_price_vci("VNM")

    assert result == (date(2026, 7, 10), Decimal("56600.0"))
    quote_cls.assert_called_once_with(symbol="VNM", source="VCI")


def test_fetch_price_vci_uses_latest_data_date_not_todays_date(monkeypatch: pytest.MonkeyPatch):
    """Ngày trả về phải lấy từ dữ liệu thật (KHÔNG tự suy date.today()) — an
    toàn quanh ngày nghỉ lễ khi phiên gần nhất không phải hôm nay."""
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history([("2026-01-28", 80.0)])
    _patch_quote(monkeypatch, quote_instance)

    quote_date, _price = main._fetch_price_vci("VNM")

    assert quote_date == date(2026, 1, 28)
    assert quote_date != date.today()


def test_fetch_price_vci_returns_none_without_raising_on_error(monkeypatch: pytest.MonkeyPatch):
    """`Quote.history()` đã tự retry nội bộ (tenacity) — ở tầng này chỉ bắt
    exception cuối cùng và trả `None`, KHÔNG raise ra ngoài, KHÔNG tự retry
    thêm (double retry đã bị bỏ, xem docs code)."""
    quote_instance = MagicMock()
    quote_instance.history.side_effect = ConnectionError("down")
    _patch_quote(monkeypatch, quote_instance)

    result = main._fetch_price_vci("VNM")

    assert result is None


def test_fetch_price_vci_treats_empty_dataframe_as_failure(monkeypatch: pytest.MonkeyPatch):
    quote_instance = MagicMock()
    quote_instance.history.return_value = pd.DataFrame()
    _patch_quote(monkeypatch, quote_instance)

    result = main._fetch_price_vci("ZZZ")

    assert result is None


def test_fetch_price_vci_never_raises_even_on_constructor_error(monkeypatch: pytest.MonkeyPatch):
    """Mã sai định dạng -> Quote() raise ValueError ngay khi khởi tạo — vẫn
    phải bị nuốt lại thành None, không văng ra ngoài vòng lặp ở main()."""
    monkeypatch.setattr(main, "Quote", MagicMock(side_effect=ValueError("bad symbol")))

    result = main._fetch_price_vci("X")

    assert result is None


def test_fetch_price_vci_rejects_nan_close_price(monkeypatch: pytest.MonkeyPatch):
    """Mã bị halt có thể trả close = NaN — không được lưu vào DB."""
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history([("2026-07-10", float("nan"))])
    _patch_quote(monkeypatch, quote_instance)

    result = main._fetch_price_vci("HALTED")

    assert result is None


def test_fetch_price_vci_rejects_zero_close_price(monkeypatch: pytest.MonkeyPatch):
    quote_instance = MagicMock()
    quote_instance.history.return_value = _fake_history([("2026-07-10", 0.0)])
    _patch_quote(monkeypatch, quote_instance)

    result = main._fetch_price_vci("ZERO")

    assert result is None


# ---------------------------------------------------------------------------
# _fetch_price_fmarket
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_fund_client_cache():
    """`_fund_client()` cache 1 instance `Fund()` ở module scope — reset giữa
    các test để không rò instance mock của test này sang test khác."""
    main._fund_client_instance = None
    yield
    main._fund_client_instance = None


def _fake_fmarket_client(filter_result: pd.DataFrame, nav_result: pd.DataFrame) -> MagicMock:
    client = MagicMock()
    client.filter.return_value = filter_result
    client.nav_report.return_value = nav_result
    return client


def _patch_fund(monkeypatch: pytest.MonkeyPatch, client: MagicMock) -> MagicMock:
    fund_cls = MagicMock(return_value=client)
    monkeypatch.setattr(main, "Fund", fund_cls)
    return fund_cls


def test_fetch_price_fmarket_returns_latest_nav_as_raw_vnd_no_scale(
    monkeypatch: pytest.MonkeyPatch,
):
    """fmarket NAV/chứng chỉ quỹ đã là VND thô — KHÔNG nhân PRICE_SCALE (khác
    VCI trả nghìn đồng), xem process/DECISION.md."""
    filter_df = pd.DataFrame({"id": [23], "shortName": ["VESAF"]})
    nav_df = pd.DataFrame(
        {"date": ["2026-07-09", "2026-07-10"], "nav_per_unit": [32648.37, 32455.33]}
    )
    client = _fake_fmarket_client(filter_df, nav_df)
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("VESAF")

    assert result == (date(2026, 7, 10), Decimal("32455.33"))
    client.nav_report.assert_called_once_with(fundId=23)


def test_fetch_price_fmarket_sorts_by_date_before_taking_latest(monkeypatch: pytest.MonkeyPatch):
    """`nav_report()` không đảm bảo thứ tự — phải tự sort theo date, không
    tin tưởng dòng cuối của response."""
    filter_df = pd.DataFrame({"id": [23], "shortName": ["VESAF"]})
    nav_df = pd.DataFrame(
        {"date": ["2026-07-10", "2026-07-08", "2026-07-09"], "nav_per_unit": [3.0, 1.0, 2.0]}
    )
    client = _fake_fmarket_client(filter_df, nav_df)
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("VESAF")

    assert result == (date(2026, 7, 10), Decimal("3.0"))


def test_fetch_price_fmarket_matches_exact_short_name_not_first_substring_hit(
    monkeypatch: pytest.MonkeyPatch,
):
    """`filter()` search substring phía server (vd "VCBF" trả về cả
    VCBF-BCF/VCBF-MGF/...) — phải tự lọc khớp CHÍNH XÁC shortName."""
    filter_df = pd.DataFrame(
        {
            "id": [82, 46, 32, 33, 31],
            "shortName": ["VCBF-AIF", "VCBF-MGF", "VCBF-BCF", "VCBF-FIF", "VCBF-TBF"],
        }
    )
    nav_df = pd.DataFrame({"date": ["2026-07-10"], "nav_per_unit": [42810.18]})
    client = _fake_fmarket_client(filter_df, nav_df)
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("VCBF-BCF")

    assert result == (date(2026, 7, 10), Decimal("42810.18"))
    client.nav_report.assert_called_once_with(fundId=32)


def test_fetch_price_fmarket_returns_none_when_no_exact_match(monkeypatch: pytest.MonkeyPatch):
    """Chỉ có match theo substring, không có match CHÍNH XÁC -> coi như fail
    (không đoán đại 1 quỹ khác)."""
    filter_df = pd.DataFrame({"id": [82, 46], "shortName": ["VCBF-AIF", "VCBF-MGF"]})
    client = _fake_fmarket_client(filter_df, pd.DataFrame())
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("VCBF")

    assert result is None
    client.nav_report.assert_not_called()


def test_fetch_price_fmarket_returns_none_when_fund_not_found_at_all(
    monkeypatch: pytest.MonkeyPatch,
):
    """Quỹ không phân phối qua fmarket (vd TCBF, phân phối riêng qua kênh
    ngân hàng) -> `filter()` raise ValueError -> bị nuốt lại thành None."""
    client = MagicMock()
    client.filter.side_effect = ValueError("no fund found with this symbol TCBF")
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("TCBF")

    assert result is None


def test_fetch_price_fmarket_rejects_invalid_nav(monkeypatch: pytest.MonkeyPatch):
    filter_df = pd.DataFrame({"id": [23], "shortName": ["VESAF"]})
    nav_df = pd.DataFrame({"date": ["2026-07-10"], "nav_per_unit": [0.0]})
    client = _fake_fmarket_client(filter_df, nav_df)
    _patch_fund(monkeypatch, client)

    result = main._fetch_price_fmarket("VESAF")

    assert result is None


def test_fund_client_is_cached_across_multiple_fetch_calls(monkeypatch: pytest.MonkeyPatch):
    """`Fund()` tải toàn bộ listing khi khởi tạo — chỉ tạo 1 lần dùng chung
    cho mọi mã fallback trong cùng lần chạy job (tôn trọng rate limit)."""
    filter_df = pd.DataFrame({"id": [23], "shortName": ["VESAF"]})
    nav_df = pd.DataFrame({"date": ["2026-07-10"], "nav_per_unit": [32455.33]})
    client = _fake_fmarket_client(filter_df, nav_df)
    fund_cls = _patch_fund(monkeypatch, client)

    main._fetch_price_fmarket("VESAF")
    main._fetch_price_fmarket("VESAF")

    fund_cls.assert_called_once()


# ---------------------------------------------------------------------------
# fetch_price (orchestration: VCI trước, fallback fmarket)
# ---------------------------------------------------------------------------


def test_fetch_price_returns_vci_result_without_trying_fmarket(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main, "_fetch_price_vci", MagicMock(return_value=(date(2026, 7, 10), Decimal("56600.0")))
    )
    fmarket_mock = MagicMock()
    monkeypatch.setattr(main, "_fetch_price_fmarket", fmarket_mock)

    result = main.fetch_price("VNM", "STOCK")

    assert result == (date(2026, 7, 10), Decimal("56600.0"))
    fmarket_mock.assert_not_called()


def test_fetch_price_falls_back_to_fmarket_when_vci_fails_for_fund(
    monkeypatch: pytest.MonkeyPatch,
):
    """Quỹ mở không niêm yết (vd VESAF) -> VCI không có dữ liệu -> fallback
    fmarket lấy NAV."""
    monkeypatch.setattr(main, "_fetch_price_vci", MagicMock(return_value=None))
    monkeypatch.setattr(
        main,
        "_fetch_price_fmarket",
        MagicMock(return_value=(date(2026, 7, 10), Decimal("32455.33"))),
    )

    result = main.fetch_price("VESAF", "FUND")

    assert result == (date(2026, 7, 10), Decimal("32455.33"))


def test_fetch_price_does_not_fall_back_to_fmarket_for_stock(monkeypatch: pytest.MonkeyPatch):
    """STOCK luôn ở sàn — VCI fail thì fail hẳn, không thử fmarket (vô ích +
    rủi ro trùng shortName với 1 quỹ mở nào đó)."""
    monkeypatch.setattr(main, "_fetch_price_vci", MagicMock(return_value=None))
    fmarket_mock = MagicMock()
    monkeypatch.setattr(main, "_fetch_price_fmarket", fmarket_mock)

    result = main.fetch_price("VNM", "STOCK")

    assert result is None
    fmarket_mock.assert_not_called()


def test_fetch_price_returns_none_when_both_vci_and_fmarket_fail_for_fund(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(main, "_fetch_price_vci", MagicMock(return_value=None))
    monkeypatch.setattr(main, "_fetch_price_fmarket", MagicMock(return_value=None))

    result = main.fetch_price("UNKNOWN", "FUND")

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
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock, symbols: list[tuple[str, str]]
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
    _patch_main_infra(
        monkeypatch, fake_conn, [("VNM", "STOCK"), ("BAD", "STOCK"), ("FPT", "STOCK")]
    )

    def fake_fetch(symbol: str, asset_type: str):
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


def test_main_passes_asset_type_through_to_fetch_price(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    """type từ get_symbols_to_fetch phải tới đúng fetch_price (STOCK không
    fallback fmarket, FUND mới fallback) — xem finding code-review."""
    _patch_main_infra(monkeypatch, fake_conn, [("VNM", "STOCK"), ("VESAF", "FUND")])
    fetch_mock = MagicMock(return_value=(date(2026, 7, 10), Decimal("1")))
    monkeypatch.setattr(main, "fetch_price", fetch_mock)
    monkeypatch.setattr(main, "save_price", MagicMock())

    main.main()

    assert fetch_mock.call_args_list == [call("VNM", "STOCK"), call("VESAF", "FUND")]


def test_main_rolls_back_and_continues_when_save_price_raises(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    """Lỗi bất ngờ khi ghi DB cho một mã (vd deadlock) không được làm mất mã
    tiếp theo — connection phải rollback để dùng lại được."""
    _patch_main_infra(monkeypatch, fake_conn, [("VNM", "STOCK"), ("FPT", "STOCK")])
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
