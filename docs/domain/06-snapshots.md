# Snapshots

## Mục đích
Định nghĩa cách "chụp" và **đóng băng** giá trị danh mục tại các mốc thời gian để báo cáo lịch sử nhất quán và vẽ biểu đồ NAV.

## Entity / field
- `Snapshot`: `holdingId?` (null = tổng danh mục), `date`, `value`, `source` (`AUTO`/`MANUAL`), `period` (`PERIODIC`/`YEAR_END`/`MANUAL`/`TODAY`), `frozen`.
- Tần suất chốt định kỳ **cấu hình trong `Setting`** (xem `09-settings.md`): `NAV_SNAPSHOT_FREQUENCY`, `NAV_SNAPSHOT_DAY_OF_MONTH`, `NAV_SNAPSHOT_DAY_OF_WEEK`.
- *(Model `Snapshot` được thêm ở Phase 3 — không có trong Phase 1.)*

## Quy tắc & bất biến
- **Mốc đã qua thì "đóng băng"** (`frozen = true`): số liệu đã lưu **không tính lại** theo giá mới sau này — để báo cáo lịch sử nhất quán.
- **Mốc "hôm nay" là động, KHÔNG lưu** (`period = TODAY`): tính runtime mỗi lần xem, không tạo bản ghi thừa mỗi ngày.
- **`holdingId = null`** = snapshot **tổng danh mục** của một user tại một mốc (cần cho biểu đồ NAV). Snapshot theo từng `Holding` cũng có thể lưu.
- **`source`** ghi rõ giá trị đến từ nguồn tự động hay nhập tay tại thời điểm chốt.

## Khi nào lưu snapshot
- **Tự động (cron) — định kỳ (`PERIODIC`), tần suất cấu hình:**
  - `NAV_SNAPSHOT_FREQUENCY = MONTHLY` → chốt vào ngày `NAV_SNAPSHOT_DAY_OF_MONTH` (1-31; nếu vượt số ngày trong tháng thì **co về ngày cuối tháng** — vd 31 = luôn cuối tháng).
  - `NAV_SNAPSHOT_FREQUENCY = WEEKLY` → chốt vào thứ `NAV_SNAPSHOT_DAY_OF_WEEK` (1=Thứ Hai … 7=Chủ Nhật).
  - Cron chạy hằng ngày, đọc setting (resolve `atDate = hôm nay`) và chỉ chốt nếu hôm nay khớp ngày cấu hình.
- **Tự động (cron) — cuối năm (`YEAR_END`):** vẫn chốt cuối mỗi năm cho báo cáo năm.
- **Thủ công:** mỗi khi có giao dịch mua/bán; khi người dùng bấm **"Chốt số liệu hôm nay"** (`MANUAL`).
- **Không lưu:** mốc "hôm nay" khi chỉ xem dashboard.
- **Tần suất định kỳ cấu hình được:** tháng (ngày tùy chọn) hoặc tuần (thứ tùy chọn), qua `Setting`. Không snapshot theo ngày.

## Cách tính
- Giá trị snapshot = NAV tại mốc (xem `04-pricing-and-valuation.md`) — với snapshot tổng danh mục là Σ NAV mọi `Holding` của user.
- Biểu đồ NAV theo thời gian dựng từ chuỗi snapshot tổng danh mục đã lưu.

## Ca biên
- **Thiếu giá tại mốc cron:** nếu một mã không có giá lúc chốt, ghi rõ (không mặc định 0). Cân nhắc dùng giá gần nhất + đánh dấu.
- **Chốt lại một mốc đã đóng băng:** mặc định không cho ghi đè; nếu cần sửa (dữ liệu sai) phải là hành động rõ ràng, có ghi vết.
- **Nhiều lần "chốt hôm nay" trong ngày:** cân nhắc gộp về một bản ghi/ngày để tránh trùng.

## Ví dụ
- `FREQUENCY=MONTHLY, DAY_OF_MONTH=31` → tháng 2/2025 chốt ngày **28** (co về cuối tháng); tháng 3 chốt ngày 31.
- `FREQUENCY=WEEKLY, DAY_OF_WEEK=7` → chốt mỗi Chủ Nhật, `period: PERIODIC`.
- 2024-12-31, cron chạy → lưu `Snapshot{ holdingId: null, date: 2024-12-31, value: <NAV tổng>, period: YEAR_END, frozen: true }`.
- Xem dashboard hôm nay → tính NAV động, **không** tạo snapshot.
