# PROCESS — theo dõi tiến trình triển khai

File này theo dõi tiến độ implement Navtrack theo phase. **Mỗi khi hoàn thành một phase, Claude cập nhật bảng trạng thái dưới đây** và tick tiêu chí hoàn thành trong file `phase-x.md` tương ứng.

Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Hoàn thành

| Phase | Tên | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | Nền tảng + đăng nhập + nhập vị thế | ✅ | [phase-1.md](./phase-1.md) |
| 2 | Lõi XIRR + giá tự động | ✅ | [phase-2.md](./phase-2.md) |
| 3 | Snapshot tự động | ✅ | [phase-3.md](./phase-3.md) |
| 4 | Cổ tức | ⬜ | [phase-4.md](./phase-4.md) |
| 5 | Thuế bán (áp dụng) | ⬜ | [phase-5.md](./phase-5.md) |
| 6 | Biểu đồ + hoàn thiện dashboard | ⬜ | [phase-6.md](./phase-6.md) |

## Cách dùng
- Bắt đầu một phase → đổi trạng thái sang 🟨, đọc `phase-x.md` **và [`DECISION.md`](./DECISION.md)** (quyết định quan trọng đã chốt ở phase trước).
- Hoàn thành → đổi ✅, tick hết tiêu chí trong `phase-x.md`, ghi ngày hoàn thành.
- Nếu phạm vi phase thay đổi, cập nhật cả `docs/03-roadmap.md` lẫn `phase-x.md` cho nhất quán.

## Nhật ký

Ghi ngắn gọn **đã làm gì** — 1 dòng/lần. Quyết định quan trọng kèm lý do ghi ở [`DECISION.md`](./DECISION.md), không lặp lại chi tiết ở đây.

- 2026-07-09: Phase 1 — nền tảng + Auth.js Google OAuth + allowlist + `resolveSetting`; nhập vị thế + CRUD mua/bán; PWA; unit test + e2e + cách ly dữ liệu 2 user.
- 2026-07-10: Phase 1 — UI mockup 6 màn + loading/skeleton; tách route `/holdings/closed` + materialize `quantity`/`avgCost`.
- 2026-07-11: Session regression — không phải bug, tránh tranh luận lại ở phase sau.
- 2026-07-11: **Phase 1 hoàn thành** — toàn bộ tiêu chí ở [phase-1.md](./phase-1.md) đạt.
- 2026-07-12: Phase 2 — `lib/valuation.ts` + batched pricing; `NavOverride` nhập tay; cutoff selection cookie.
- 2026-07-13: Phase 2 — wire NAV/XIRR/PnL thật vào holdings + danh sách; job Python price-fetcher deploy GitHub Actions.
- 2026-07-13: **Phase 2 hoàn thành** — toàn bộ tiêu chí ở [phase-2.md](./phase-2.md) đạt.
- 2026-07-14: Đổi rule ưu tiên giá: so `date` giữa NavOverride vs PriceQuote; e2e dùng DB riêng ephemeral (xem [DECISION.md](./DECISION.md)).
- 2026-07-14: Phase 3 — issue #34: thêm dedup constraint cho `Snapshot` (2 partial unique index, migration `add_snapshot_unique_constraint`).
- 2026-07-14: Phase 3 — issue #36: job Python `jobs/snapshot-cron/` + GitHub Actions workflow chốt `Snapshot{PERIODIC/YEAR_END}`.
- 2026-07-15: Phase 3 — thêm integration test cho `jobs/snapshot-cron/` và `jobs/price-fetcher/` (tái dùng DB ephemeral, tự quét `jobs/*/test_integration.py`).
- 2026-07-15: Phase 3 — issue #35: layer Presentational cho "Chốt số liệu hôm nay" (SnapshotTodayCard) + 6 màn Phase 3 Screens (3a/3c-3f).
- 2026-07-15: Phase 3 — issue #37: Snapshot thủ công (`MANUAL`) + Server Action `freezeManualSnapshot()` + trigger tự động sau giao dịch + thêm `Snapshot.updatedAt`.
- 2026-07-15: Phase 3 — issue #37 e2e verify: sửa 7 `waitForURL` lỗi thời; viết `e2e/manual-snapshot.spec.ts` (4 test snapshot banner + chốt lại nhiều lần).
- 2026-07-15: Phase 3 — issue #46: `getSnapshotHistory()`/`getSnapshotDetail(id)` đọc lịch sử thật + chart NAV + breakdown + so sánh giá (`recomputedComparison`).
- 2026-07-15: Phase 3 — issue #46 e2e verify: viết `e2e/snapshot-history.spec.ts` (4 test lịch sử + quyền user + giá so sánh); toàn bộ verify sạch.
- 2026-07-15: **Phase 3 hoàn thành** — toàn bộ tiêu chí ở [phase-3.md](./phase-3.md) đạt.
