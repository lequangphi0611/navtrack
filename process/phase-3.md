# Phase 3 — Snapshot tự động

## Mục tiêu
Chụp và **đóng băng** giá trị danh mục tại các mốc (tháng/năm) để báo cáo lịch sử nhất quán và làm dữ liệu cho biểu đồ NAV.

## Công việc cần làm
- [x] Model `Snapshot` (`holdingId?`, `date`, `value`, `source`, `period`, `frozen`) + enum `SnapshotSource`, `SnapshotPeriod` + migration
- [x] Cron **GitHub Actions workflow** (không chạy hằng ngày): lịch nằm trong cron expression. Tháng → fire ngày 01, ghi snapshot `PERIODIC` cho **cuối tháng liền trước**; cuối năm → `YEAR_END` (01/01 ghi cho 31/12 trước). `frozen = true`. *(Nhánh tuần chưa implement — ngoài phạm vi issue #36, xem `jobs/snapshot-cron/README.md`.)*
- [x] Snapshot thủ công: khi có giao dịch mua/bán; nút **"Chốt số liệu hôm nay"** (`MANUAL`)
- [x] Snapshot **tổng danh mục** (`holdingId = null`) theo từng user
- [x] Mốc "hôm nay" tính động, **không lưu**

## Tiêu chí hoàn thành
- [x] Snapshot định kỳ chạy đúng theo tần suất/ngày cấu hình (đổi setting → đổi lịch chốt); cuối năm vẫn chốt — `.github/workflows/snapshot-cron.yml` (cron committed, đổi cadence = sửa cron expression rồi commit — xem `process/DECISION.md` 2026-07-14 "không qua Setting"), `jobs/snapshot-cron/main.py` (PERIODIC = cuối tháng liền trước, YEAR_END = 31/12 khi cron fire tháng 1), phủ bởi `test_main.py` (33 test) + `test_integration.py` (2 test, DB thật)
- [x] Số liệu đã đóng băng **không đổi** khi giá cập nhật sau này — `e2e/manual-snapshot.spec.ts` ("số liệu Snapshot đã đóng băng không đổi khi PriceQuote cập nhật giá mới sau đó"): cập nhật `PriceQuote` sau khi đã chốt MANUAL không làm đổi `Snapshot.value`/`updatedAt` đã lưu, trong khi NAV sống (Dashboard) phản ánh giá mới ngay; giữ bởi cấu trúc (không route nào re-derive `Snapshot.value` từ giá sống khi đọc) cho cả nhánh cron
- [x] Có chuỗi snapshot tổng danh mục đủ để vẽ biểu đồ NAV (Phase 6) — `Snapshot{holdingId: null}` ghi đều bởi cron `PERIODIC`/`YEAR_END` (#36) + `MANUAL` sau mỗi giao dịch/bấm "Chốt số liệu hôm nay" (#37); việc DỰNG biểu đồ thật (`getSnapshotHistory()`) để lại cho Phase 6/issue #46 đúng như chú thích trong ngoặc của tiêu chí này

## Phụ thuộc / ghi chú
- Cần Phase 2 (định giá NAV) xong.
