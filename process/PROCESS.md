# PROCESS — theo dõi tiến trình triển khai

File này theo dõi tiến độ implement Navtrack theo phase. **Mỗi khi hoàn thành một phase, Claude cập nhật bảng trạng thái dưới đây** và tick tiêu chí hoàn thành trong file `phase-x.md` tương ứng.

Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Hoàn thành

| Phase | Tên | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | Nền tảng + đăng nhập + nhập vị thế | ✅ | [phase-1.md](./phase-1.md) |
| 2 | Lõi XIRR + giá tự động | ✅ | [phase-2.md](./phase-2.md) |
| 3 | Snapshot tự động | ✅ | [phase-3.md](./phase-3.md) |
| 4 | Cổ tức | ✅ | [phase-4.md](./phase-4.md) |
| 5 | Thuế bán (áp dụng) | ⬜ | [phase-5.md](./phase-5.md) |
| 6 | Biểu đồ + hoàn thiện dashboard | ⬜ | [phase-6.md](./phase-6.md) |
| 7 | Trái tức (lãi trái phiếu) | ⬜ | [phase-7.md](./phase-7.md) |

## Cách dùng
- Bắt đầu một phase → đổi trạng thái sang 🟨, đọc `phase-x.md` **và [`DECISION.md`](./DECISION.md)** (quyết định quan trọng đã chốt ở phase trước).
- Hoàn thành → đổi ✅, tick hết tiêu chí trong `phase-x.md`, ghi ngày hoàn thành.
- Nếu phạm vi phase thay đổi, cập nhật cả `docs/03-roadmap.md` lẫn `phase-x.md` cho nhất quán.

## Nhật ký

Ghi ngắn gọn **đã làm gì** — 1 dòng/lần. Quyết định quan trọng kèm lý do ghi ở [`DECISION.md`](./DECISION.md), không lặp lại chi tiết ở đây.

- 2026-07-09: Phase 1 — nền tảng: Auth.js Google OAuth + allowlist + PWA + nhập vị thế + CRUD mua/bán + unit test + e2e.
- 2026-07-10: Phase 1 — UI mockup + tách route `/holdings/closed` + materialize `quantity`/`avgCost`.
- 2026-07-11: Session regression — không phải bug.
- 2026-07-11: **Phase 1 hoàn thành** ✅.
- 2026-07-12: Phase 2 — valuation lib + NavOverride + cutoff selection + batched pricing.
- 2026-07-13: Phase 2 — wire NAV/XIRR/PnL + job Python price-fetcher.
- 2026-07-13: **Phase 2 hoàn thành** ✅.
- 2026-07-14: Đổi rule ưu tiên giá: so date giữa NavOverride vs PriceQuote; e2e DB riêng ephemeral.
- 2026-07-14: Phase 3 — issue #34: dedup constraint cho Snapshot (2 partial unique index).
- 2026-07-14: Phase 3 — issue #36: job Python snapshot-cron + GitHub Actions.
- 2026-07-15: Phase 3 — integration test cho snapshot-cron + price-fetcher.
- 2026-07-15: Phase 3 — issue #35: Presentational "Chốt số liệu hôm nay" + 6 màn Phase 3.
- 2026-07-15: Phase 3 — issue #37: Snapshot thủ công + freezeManualSnapshot + trigger tự động + thêm updatedAt.
- 2026-07-15: Phase 3 — issue #37 e2e verify + issue #46: getSnapshotHistory/Detail + comparison + e2e verify.
- 2026-07-15: **Phase 3 hoàn thành** ✅.
- 2026-07-16: Phase 4 — issue #51 verify: Presentational cổ tức khớp domain + e2e sạch.
- 2026-07-16: Phase 4 — issue #52: Setting DIVIDEND_TAX_RATE/PAR_VALUE + recordDividend + getOpenHoldings + getDividendHistory.
- 2026-07-16: Phase 4 — issue #52 verify: công thức/cache/wiring khớp + test sạch. **Phase 4 hoàn thành** ✅.
- 2026-07-16: fix(dividends) issue #52: floor stockQuantity + override tolerance 2.
- 2026-07-16: Thêm **Phase 7 — Trái tức** vào roadmap + chia 3 issue.
- 2026-07-16: fix issue #59: `derivePositionIncludingStockDividends()` (lib/cost-basis.ts) thay `derivePosition()` ở 4 action mua/bán + `getHoldingDetail()` — cổ tức cổ phiếu không còn bị ghi đè mất khi có giao dịch sau đó, bán vượt cashflow-only nhưng hợp lệ nhờ cổ tức không còn bị chặn nhầm. `buildQuantityTimeline()` chuyển từ `features/dividends/` ra `lib/position-trail.ts` (dùng chung).
- 2026-07-16: fix(dashboard) issue #54: FAB "Mua/Bán" mở TransactionHoldingPicker thay vì trỏ /holdings.
- 2026-07-17: verify issue #61 (follow-up Phase 4): `recordDividend` tự bù pha loãng NAV qua `NavOverride` + `Dividend.paymentDate` — khớp spec, unit/lint/typecheck sạch; bổ sung e2e case STOCK-không-tick + chuyển case tick sang tương tác checkbox thật; `pnpm e2e` không tự chạy được trong sandbox này (không có Docker, tải Playwright browser bị egress policy chặn).
- 2026-07-17: review PR #62 (issue #61) — fix finding #2 (note trên NavOverride tự tạo), #3 (validate `paymentDate >= date`), #4 (e2e ghi cổ tức 2 lần cùng ngày), sửa mô tả PR khớp diff thật (finding #1).
- 2026-07-17: đóng quyết định treo từ #52 — ghi cổ tức KHÔNG tự trigger `Snapshot{period: MANUAL}` (lý do: cơ chế bù pha loãng NAV giữ NAV gần như liên tục qua sự kiện chia cổ tức, khác mua/bán).
- 2026-07-17: thảo luận nghiệp vụ Phase 5 (thuế bán) — chốt SELL prefill+sửa tay, BUY bỏ field thuế, `SALE_TAX_GOLD = 0`; để ngỏ đáo hạn trái phiếu (dời Phase 7) + hành vi sửa SELL đã ghi.
