# Phase 3 — Snapshot tự động

## Mục tiêu
Chụp và **đóng băng** giá trị danh mục tại các mốc (tháng/năm) để báo cáo lịch sử nhất quán và làm dữ liệu cho biểu đồ NAV.

## Công việc cần làm
- [ ] Model `Snapshot` (`holdingId?`, `date`, `value`, `source`, `period`, `frozen`) + enum `SnapshotSource`, `SnapshotPeriod` + migration
- [ ] Cron **GitHub Actions workflow** (không chạy hằng ngày): lịch nằm trong cron expression. Tháng → fire ngày 01, ghi snapshot `PERIODIC` cho **cuối tháng liền trước**; tuần → theo day-of-week; cuối năm → `YEAR_END` (01/01 ghi cho 31/12 trước). `frozen = true`
- [ ] Snapshot thủ công: khi có giao dịch mua/bán; nút **"Chốt số liệu hôm nay"** (`MANUAL`)
- [ ] Snapshot **tổng danh mục** (`holdingId = null`) theo từng user
- [ ] Mốc "hôm nay" tính động, **không lưu**

## Tiêu chí hoàn thành
- [ ] Snapshot định kỳ chạy đúng theo tần suất/ngày cấu hình (đổi setting → đổi lịch chốt); cuối năm vẫn chốt
- [ ] Số liệu đã đóng băng **không đổi** khi giá cập nhật sau này
- [ ] Có chuỗi snapshot tổng danh mục đủ để vẽ biểu đồ NAV (Phase 6)

## Phụ thuộc / ghi chú
- Cần Phase 2 (định giá NAV) xong.
