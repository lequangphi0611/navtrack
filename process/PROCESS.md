# PROCESS — theo dõi tiến trình triển khai

File này theo dõi tiến độ implement Navtrack theo phase. **Mỗi khi hoàn thành một phase, Claude cập nhật bảng trạng thái dưới đây** và tick tiêu chí hoàn thành trong file `phase-x.md` tương ứng.

Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Hoàn thành

| Phase | Tên | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | Nền tảng + đăng nhập + nhập vị thế | ✅ | [phase-1.md](./phase-1.md) |
| 2 | Lõi XIRR + giá tự động | ✅ | [phase-2.md](./phase-2.md) |
| 3 | Snapshot tự động | 🟨 | [phase-3.md](./phase-3.md) |
| 4 | Cổ tức | ⬜ | [phase-4.md](./phase-4.md) |
| 5 | Thuế bán (áp dụng) | ⬜ | [phase-5.md](./phase-5.md) |
| 6 | Biểu đồ + hoàn thiện dashboard | ⬜ | [phase-6.md](./phase-6.md) |

## Cách dùng
- Bắt đầu một phase → đổi trạng thái sang 🟨, đọc `phase-x.md` **và [`DECISION.md`](./DECISION.md)** (quyết định quan trọng đã chốt ở phase trước).
- Hoàn thành → đổi ✅, tick hết tiêu chí trong `phase-x.md`, ghi ngày hoàn thành.
- Nếu phạm vi phase thay đổi, cập nhật cả `docs/03-roadmap.md` lẫn `phase-x.md` cho nhất quán.

## Nhật ký

Ghi ngắn gọn **đã làm gì** — 1 dòng/lần. Quyết định quan trọng kèm lý do ghi ở [`DECISION.md`](./DECISION.md), không lặp lại chi tiết ở đây.

- 2026-07-09: Phase 1 — Auth.js + Google OAuth + allowlist + `resolveSetting` + mời thành viên; nhập vị thế + CRUD giao dịch mua/bán xong; kiểm chứng unit test + e2e + cách ly 2 tài khoản.
- 2026-07-10: Phase 1 — UI mockup (6 màn), loading/skeleton/animation, schema `User` fix, tách route `/settings/*`, constants `ROUTES`/`SETTING_KEYS` — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Phase 1 — PWA (manifest, icon, sw, offline); gom danh sách theo `AssetType` — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Điều tra nghi vấn session regression → không phải bug thật — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Phase 1 — issue #18: tách route `/holdings` ↔ `/holdings/closed`, materialize `Holding.quantity`/`avgCost`, backfill — xem [DECISION.md](./DECISION.md).
- 2026-07-11: Phase 1 — issue #12: Suspense cho 2 route transactions, giữ async page cho `settings/members/*` — xem [DECISION.md](./DECISION.md).
- 2026-07-11: **Phase 1 hoàn thành** — toàn bộ tiêu chí ở [phase-1.md](./phase-1.md) đạt.
- 2026-07-12: Phase 2 — thêm `lib/valuation.ts` + `lib/portfolio-valuation.ts` (định giá Holding tại ngày D, batched); `NavOverride` nhập tay + wire cutoff selection qua cookie — xem [DECISION.md](./DECISION.md).
- 2026-07-13: Phase 2 — wire NAV/XIRR/PnL thật vào chi tiết vị thế (`/holdings/[id]`) và danh sách vị thế (`/holdings`, theo nhóm loại tài sản) + thay `TotalInvestedSection` bằng `HoldingsSummaryCard` toàn danh mục — xem [DECISION.md](./DECISION.md).
- 2026-07-13: **Phase 2 hoàn thành** — job Python price-fetcher đã deploy lên GitHub Actions chạy theo lịch; toàn bộ tiêu chí ở [phase-2.md](./phase-2.md) đạt.
- 2026-07-14: Phase 3 — issue #34: thêm dedup constraint cho `Snapshot` đã đóng băng (2 partial unique index, migration `add_snapshot_unique_constraint`) — xem [DECISION.md](./DECISION.md).
