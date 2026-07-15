"""Unit test cho logic của main.py — mock hết psycopg (không gọi DB/mạng thật).
Chỉ test logic thuần: xác định mốc chốt (tháng/cuối năm), resolve_price (mirror
src/lib/valuation.ts), câu SQL đọc/upsert, và orchestration cô lập lỗi. Xem
docs/rules/testing.md + docs/rules/python-job.md.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

import main

# ---------------------------------------------------------------------------
# last_day_of_previous_month / year_end_date / get_snapshot_targets
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "today,expected",
    [
        (date(2026, 3, 1), date(2026, 2, 28)),  # tháng thường
        (date(2024, 3, 1), date(2024, 2, 29)),  # tháng 2 năm nhuận
        (date(2026, 1, 1), date(2025, 12, 31)),  # sang năm mới
        (date(2026, 5, 15), date(2026, 4, 30)),  # chạy tay giữa tháng vẫn lấy đúng tháng trước
    ],
)
def test_last_day_of_previous_month(today: date, expected: date):
    assert main.last_day_of_previous_month(today) == expected


def test_year_end_date_returns_dec_31_previous_year_in_january():
    assert main.year_end_date(date(2026, 1, 1)) == date(2025, 12, 31)


@pytest.mark.parametrize("month", [2, 3, 6, 12])
def test_year_end_date_returns_none_outside_january(month: int):
    assert main.year_end_date(date(2026, month, 15)) is None


def test_get_snapshot_targets_only_periodic_outside_january():
    targets = main.get_snapshot_targets(date(2026, 3, 1))
    assert targets == [("PERIODIC", date(2026, 2, 28))]


def test_get_snapshot_targets_includes_year_end_in_january():
    """Cron 01/01 -> ghi cả PERIODIC (31/12 năm trước) lẫn YEAR_END (cùng
    ngày, khác period) — docs/domain/06-snapshots.md."""
    targets = main.get_snapshot_targets(date(2026, 1, 1))
    assert targets == [
        ("PERIODIC", date(2025, 12, 31)),
        ("YEAR_END", date(2025, 12, 31)),
    ]


# ---------------------------------------------------------------------------
# resolve_price — mirror src/lib/valuation.test.ts
# ---------------------------------------------------------------------------


def test_resolve_price_uses_price_quote_when_newer():
    nav_override = (date(2026, 1, 5), Decimal("10000"))
    price_quote = (date(2026, 1, 10), Decimal("11000"))

    result = main.resolve_price(nav_override, price_quote)

    assert result == (Decimal("11000"), "AUTO", date(2026, 1, 10))


def test_resolve_price_uses_nav_override_when_newer():
    nav_override = (date(2026, 1, 10), Decimal("10000"))
    price_quote = (date(2026, 1, 5), Decimal("11000"))

    result = main.resolve_price(nav_override, price_quote)

    assert result == (Decimal("10000"), "MANUAL", date(2026, 1, 10))


def test_resolve_price_prefers_nav_override_on_same_date():
    """Cùng ngày -> NavOverride thắng (issue #40)."""
    same_date = date(2026, 1, 10)
    nav_override = (same_date, Decimal("10000"))
    price_quote = (same_date, Decimal("11000"))

    result = main.resolve_price(nav_override, price_quote)

    assert result == (Decimal("10000"), "MANUAL", same_date)


def test_resolve_price_uses_nav_override_only_when_no_price_quote():
    nav_override = (date(2026, 1, 10), Decimal("10000"))

    result = main.resolve_price(nav_override, None)

    assert result == (Decimal("10000"), "MANUAL", date(2026, 1, 10))


def test_resolve_price_uses_price_quote_only_when_no_nav_override():
    price_quote = (date(2026, 1, 10), Decimal("11000"))

    result = main.resolve_price(None, price_quote)

    assert result == (Decimal("11000"), "AUTO", date(2026, 1, 10))


def test_resolve_price_returns_none_when_no_source_available():
    assert main.resolve_price(None, None) is None


# ---------------------------------------------------------------------------
# get_open_holdings / get_all_holding_user_ids
# ---------------------------------------------------------------------------


def _fake_cursor(fetchall_result: list[tuple]) -> MagicMock:
    cursor = MagicMock()
    cursor.__enter__.return_value = cursor
    cursor.__exit__.return_value = False
    cursor.fetchall.return_value = fetchall_result
    return cursor


def test_get_open_holdings_returns_all_asset_types():
    """Snapshot cần chốt MỌI loại tài sản (kể cả GOLD/BOND chỉ có
    NavOverride) — khác get_symbols_to_fetch của price-fetcher (chỉ STOCK/FUND)."""
    cursor = _fake_cursor([("h1", "u1", "VNM", Decimal("10")), ("h2", "u1", "SJC", Decimal("2"))])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_open_holdings(conn)

    assert result == [
        {"id": "h1", "userId": "u1", "symbol": "VNM", "quantity": Decimal("10")},
        {"id": "h2", "userId": "u1", "symbol": "SJC", "quantity": Decimal("2")},
    ]
    sql = cursor.execute.call_args[0][0]
    assert '"Holding"' in sql
    assert "quantity > 0" in sql
    # Không lọc theo type — không giống price-fetcher (chỉ STOCK/FUND).
    assert "STOCK" not in sql
    assert "FUND" not in sql
    assert "GOLD" not in sql
    assert "BOND" not in sql


def test_get_all_holding_user_ids_queries_distinct_user_id():
    cursor = _fake_cursor([("u1",), ("u2",)])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_all_holding_user_ids(conn)

    assert result == {"u1", "u2"}
    sql = cursor.execute.call_args[0][0]
    assert "DISTINCT" in sql
    assert '"userId"' in sql
    assert '"Holding"' in sql


# ---------------------------------------------------------------------------
# get_latest_nav_overrides / get_latest_price_quotes
# ---------------------------------------------------------------------------


def test_get_latest_nav_overrides_uses_distinct_on_and_cutoff():
    cursor = _fake_cursor([("h1", date(2026, 1, 31), Decimal("12000000"))])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_latest_nav_overrides(conn, ["h1"], date(2026, 1, 31))

    assert result == {"h1": (date(2026, 1, 31), Decimal("12000000"))}
    sql, params = cursor.execute.call_args[0]
    assert "DISTINCT ON" in sql
    assert '"holdingId"' in sql
    assert '"NavOverride"' in sql
    assert params == (["h1"], date(2026, 1, 31))


def test_get_latest_nav_overrides_returns_empty_without_querying_when_no_ids():
    conn = MagicMock()

    result = main.get_latest_nav_overrides(conn, [], date(2026, 1, 31))

    assert result == {}
    conn.cursor.assert_not_called()


def test_get_latest_price_quotes_uses_distinct_on_and_cutoff():
    cursor = _fake_cursor([("VNM", date(2026, 1, 30), Decimal("56600"))])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    result = main.get_latest_price_quotes(conn, ["VNM"], date(2026, 1, 31))

    assert result == {"VNM": (date(2026, 1, 30), Decimal("56600"))}
    sql, params = cursor.execute.call_args[0]
    assert "DISTINCT ON" in sql
    assert '"PriceQuote"' in sql
    assert params == (["VNM"], date(2026, 1, 31))


def test_get_latest_price_quotes_returns_empty_without_querying_when_no_symbols():
    conn = MagicMock()

    result = main.get_latest_price_quotes(conn, [], date(2026, 1, 31))

    assert result == {}
    conn.cursor.assert_not_called()


# ---------------------------------------------------------------------------
# upsert_holding_snapshot / upsert_portfolio_snapshot
# ---------------------------------------------------------------------------


def test_upsert_holding_snapshot_matches_holding_partial_unique_index():
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.upsert_holding_snapshot(
        conn, "u1", "h1", date(2026, 1, 31), Decimal("500000"), "AUTO", "PERIODIC"
    )

    sql, params = cursor.execute.call_args[0]
    assert 'ON CONFLICT ("holdingId", "date", "period") WHERE "holdingId" IS NOT NULL' in sql
    assert "DO UPDATE SET" in sql
    assert params[1:] == ("u1", "h1", date(2026, 1, 31), Decimal("500000"), "AUTO", "PERIODIC")


def test_upsert_portfolio_snapshot_matches_portfolio_partial_unique_index_and_source_auto():
    cursor = _fake_cursor([])
    conn = MagicMock()
    conn.cursor.return_value = cursor

    main.upsert_portfolio_snapshot(conn, "u1", date(2026, 1, 31), Decimal("500000"), "PERIODIC")

    sql, params = cursor.execute.call_args[0]
    assert 'ON CONFLICT ("userId", "date", "period") WHERE "holdingId" IS NULL' in sql
    assert "DO UPDATE SET" in sql
    # source luôn "AUTO" — không nhận tham số source (process/DECISION.md 2026-07-14).
    assert params[1:] == ("u1", date(2026, 1, 31), Decimal("500000"), "AUTO", "PERIODIC")


# ---------------------------------------------------------------------------
# run_snapshot — orchestration & ca biên
# ---------------------------------------------------------------------------


def _patch_run_snapshot_infra(
    monkeypatch: pytest.MonkeyPatch,
    *,
    user_ids: set[str],
    holdings: list[dict],
    nav_overrides: dict | None = None,
    price_quotes: dict | None = None,
) -> tuple[MagicMock, MagicMock]:
    monkeypatch.setattr(main, "get_all_holding_user_ids", MagicMock(return_value=user_ids))
    monkeypatch.setattr(main, "get_open_holdings", MagicMock(return_value=holdings))
    monkeypatch.setattr(
        main, "get_latest_nav_overrides", MagicMock(return_value=nav_overrides or {})
    )
    monkeypatch.setattr(main, "get_latest_price_quotes", MagicMock(return_value=price_quotes or {}))
    holding_snap = MagicMock()
    portfolio_snap = MagicMock()
    monkeypatch.setattr(main, "upsert_holding_snapshot", holding_snap)
    monkeypatch.setattr(main, "upsert_portfolio_snapshot", portfolio_snap)
    return holding_snap, portfolio_snap


def test_run_snapshot_isolates_holding_with_missing_price(monkeypatch: pytest.MonkeyPatch):
    """1 Holding thiếu giá không chặn Holding khác — Holding thiếu giá bị
    loại khỏi tổng và không có dòng Snapshot riêng."""
    conn = MagicMock()
    holdings = [
        {"id": "h1", "userId": "u1", "symbol": "VNM", "quantity": Decimal("10")},
        {"id": "h2", "userId": "u1", "symbol": "MISSING", "quantity": Decimal("5")},
    ]
    holding_snap, portfolio_snap = _patch_run_snapshot_infra(
        monkeypatch,
        user_ids={"u1"},
        holdings=holdings,
        price_quotes={"VNM": (date(2026, 1, 31), Decimal("50000"))},
    )

    main.run_snapshot(conn, "PERIODIC", date(2026, 1, 31))

    holding_snap.assert_called_once_with(
        conn, "u1", "h1", date(2026, 1, 31), Decimal("500000"), "AUTO", "PERIODIC"
    )
    portfolio_snap.assert_called_once_with(
        conn, "u1", date(2026, 1, 31), Decimal("500000"), "PERIODIC"
    )


def test_run_snapshot_skips_portfolio_row_when_all_open_holdings_missing_price(
    monkeypatch: pytest.MonkeyPatch,
):
    """Toàn bộ Holding đang mở của user đều thiếu giá -> bỏ qua hẳn dòng
    tổng (0 sẽ sai) — không được ghi Decimal(0)."""
    conn = MagicMock()
    holdings = [{"id": "h1", "userId": "u1", "symbol": "MISSING", "quantity": Decimal("5")}]
    holding_snap, portfolio_snap = _patch_run_snapshot_infra(
        monkeypatch, user_ids={"u1"}, holdings=holdings
    )

    main.run_snapshot(conn, "PERIODIC", date(2026, 1, 31))

    holding_snap.assert_not_called()
    portfolio_snap.assert_not_called()


def test_run_snapshot_writes_zero_for_user_without_open_holdings(monkeypatch: pytest.MonkeyPatch):
    """User đã bán hết (không có Holding nào đang mở, nhưng đã từng tạo) ->
    NAV = 0 là số thật, vẫn ghi."""
    conn = MagicMock()
    holding_snap, portfolio_snap = _patch_run_snapshot_infra(
        monkeypatch, user_ids={"u1"}, holdings=[]
    )

    main.run_snapshot(conn, "PERIODIC", date(2026, 1, 31))

    holding_snap.assert_not_called()
    portfolio_snap.assert_called_once_with(conn, "u1", date(2026, 1, 31), Decimal(0), "PERIODIC")


def test_run_snapshot_computes_partial_total_when_some_holdings_missing_price(
    monkeypatch: pytest.MonkeyPatch,
):
    """Còn ít nhất 1 Holding resolve được giá -> tổng = tổng các Holding đã
    biết (PARTIAL), không phải bị bỏ qua hoàn toàn."""
    conn = MagicMock()
    holdings = [
        {"id": "h1", "userId": "u1", "symbol": "VNM", "quantity": Decimal("10")},
        {"id": "h2", "userId": "u1", "symbol": "SJC", "quantity": Decimal("2")},
    ]
    holding_snap, portfolio_snap = _patch_run_snapshot_infra(
        monkeypatch,
        user_ids={"u1"},
        holdings=holdings,
        price_quotes={"VNM": (date(2026, 1, 31), Decimal("50000"))},
        # SJC (GOLD) không có NavOverride lẫn PriceQuote -> MISSING_PRICE.
    )

    main.run_snapshot(conn, "PERIODIC", date(2026, 1, 31))

    assert holding_snap.call_count == 1  # chỉ VNM
    portfolio_snap.assert_called_once_with(
        conn, "u1", date(2026, 1, 31), Decimal("500000"), "PERIODIC"
    )


def test_run_snapshot_isolates_unexpected_error_per_holding(monkeypatch: pytest.MonkeyPatch):
    """Lỗi bất ngờ khi ghi 1 Holding (vd deadlock) không được chặn Holding
    còn lại — connection phải rollback để dùng lại được."""
    conn = MagicMock()
    holdings = [
        {"id": "h1", "userId": "u1", "symbol": "VNM", "quantity": Decimal("10")},
        {"id": "h2", "userId": "u1", "symbol": "FPT", "quantity": Decimal("5")},
    ]
    monkeypatch.setattr(main, "get_all_holding_user_ids", MagicMock(return_value={"u1"}))
    monkeypatch.setattr(main, "get_open_holdings", MagicMock(return_value=holdings))
    monkeypatch.setattr(main, "get_latest_nav_overrides", MagicMock(return_value={}))
    monkeypatch.setattr(
        main,
        "get_latest_price_quotes",
        MagicMock(
            return_value={
                "VNM": (date(2026, 1, 31), Decimal("50000")),
                "FPT": (date(2026, 1, 31), Decimal("80000")),
            }
        ),
    )

    def fake_upsert_holding(conn, user_id, holding_id, snapshot_date, value, source, period):
        if holding_id == "h1":
            raise RuntimeError("db write error")

    monkeypatch.setattr(main, "upsert_holding_snapshot", MagicMock(side_effect=fake_upsert_holding))
    portfolio_snap = MagicMock()
    monkeypatch.setattr(main, "upsert_portfolio_snapshot", portfolio_snap)

    main.run_snapshot(conn, "PERIODIC", date(2026, 1, 31))  # không được raise ra ngoài

    assert conn.rollback.call_count == 1
    # h1 lỗi -> loại khỏi tổng; chỉ h2 (FPT, 5 * 80000 = 400000) đóng góp.
    portfolio_snap.assert_called_once_with(
        conn, "u1", date(2026, 1, 31), Decimal("400000"), "PERIODIC"
    )


# ---------------------------------------------------------------------------
# main() — chạy tháng 1 ghi cả PERIODIC lẫn YEAR_END
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_conn() -> MagicMock:
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    return conn


def test_main_runs_periodic_and_year_end_in_january(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setattr(main, "load_dotenv", MagicMock())
    monkeypatch.setattr(main.psycopg, "connect", MagicMock(return_value=fake_conn))
    monkeypatch.setattr(main, "_today", MagicMock(return_value=date(2026, 1, 1)))
    run_snapshot_mock = MagicMock()
    monkeypatch.setattr(main, "run_snapshot", run_snapshot_mock)

    main.main()

    assert run_snapshot_mock.call_args_list == [
        ((fake_conn, "PERIODIC", date(2025, 12, 31)),),
        ((fake_conn, "YEAR_END", date(2025, 12, 31)),),
    ]


def test_main_runs_only_periodic_outside_january(
    monkeypatch: pytest.MonkeyPatch, fake_conn: MagicMock
):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setattr(main, "load_dotenv", MagicMock())
    monkeypatch.setattr(main.psycopg, "connect", MagicMock(return_value=fake_conn))
    monkeypatch.setattr(main, "_today", MagicMock(return_value=date(2026, 3, 1)))
    run_snapshot_mock = MagicMock()
    monkeypatch.setattr(main, "run_snapshot", run_snapshot_mock)

    main.main()

    assert run_snapshot_mock.call_args_list == [
        ((fake_conn, "PERIODIC", date(2026, 2, 28)),),
    ]


def test_main_exits_when_database_url_missing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(main, "load_dotenv", MagicMock())

    with pytest.raises(SystemExit):
        main.main()
