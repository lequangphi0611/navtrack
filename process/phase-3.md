# Phase 3 — Snapshot tự động

## Mục tiêu
Chụp và **đóng băng** giá trị danh mục tại các mốc (tháng/năm) để báo cáo lịch sử nhất quán và làm dữ liệu cho biểu đồ NAV.

## Công việc cần làm
- [ ] Model `Snapshot` (`holdingId?`, `date`, `value`, `source`, `period`, `frozen`) + enum `SnapshotSource`, `SnapshotPeriod` + migration
- [ ] Cron (GitHub Actions) chạy hằng ngày: đọc `Setting` (`NAV_SNAPSHOT_FREQUENCY`, `_DAY_OF_MONTH`, `_DAY_OF_WEEK`), chốt snapshot định kỳ (`PERIODIC`) khi hôm nay khớp ngày cấu hình (ngày tháng vượt → co về cuối tháng) + **cuối năm** (`YEAR_END`), `frozen = true`
- [ ] Snapshot thủ công: khi có giao dịch mua/bán; nút **"Chốt số liệu hôm nay"** (`MANUAL`)
- [ ] Snapshot **tổng danh mục** (`holdingId = null`) theo từng user
- [ ] Mốc "hôm nay" tính động, **không lưu**

## Tiêu chí hoàn thành
- [ ] Snapshot định kỳ chạy đúng theo tần suất/ngày cấu hình (đổi setting → đổi lịch chốt); cuối năm vẫn chốt
- [ ] Số liệu đã đóng băng **không đổi** khi giá cập nhật sau này
- [ ] Có chuỗi snapshot tổng danh mục đủ để vẽ biểu đồ NAV (Phase 6)

## Phụ thuộc / ghi chú
- Cần Phase 2 (định giá NAV) xong.
