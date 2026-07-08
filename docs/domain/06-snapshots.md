# Snapshots

## Mục đích
Định nghĩa cách "chụp" và **đóng băng** giá trị danh mục tại các mốc thời gian để báo cáo lịch sử nhất quán và vẽ biểu đồ NAV.

## Entity / field
- `Snapshot`: `holdingId?` (null = tổng danh mục), `date`, `value`, `source` (`AUTO`/`MANUAL`), `period` (`PERIODIC`/`YEAR_END`/`MANUAL`/`TODAY`), `frozen`.
- Tần suất chốt định kỳ **nằm trong cron của GitHub Actions workflow** (committed config), **không** trong `Setting` và **không** chạy hằng ngày — cron chỉ fire đúng ngày cần. Đổi tần suất = sửa cron trong workflow rồi commit.
- *(Model `Snapshot` được thêm ở Phase 3 — không có trong Phase 1.)*

## Quy tắc & bất biến
- **Mốc đã qua thì "đóng băng"** (`frozen = true`): số liệu đã lưu **không tính lại** theo giá mới sau này — để báo cáo lịch sử nhất quán.
- **Mốc "hôm nay" là động, KHÔNG lưu** (`period = TODAY`): tính runtime mỗi lần xem, không tạo bản ghi thừa mỗi ngày.
- **`holdingId = null`** = snapshot **tổng danh mục** của một user tại một mốc (cần cho biểu đồ NAV). Snapshot theo từng `Holding` cũng có thể lưu.
- **`source`** ghi rõ giá trị đến từ nguồn tự động hay nhập tay tại thời điểm chốt.

## Khi nào lưu snapshot
- **Tự động (`PERIODIC`) — lịch nằm trong cron workflow, không chạy hằng ngày:**
  - **Tháng:** cron fire **ngày 01** hằng tháng (`0 0 1 * *`); snapshot ghi cho **ngày cuối tháng liền trước** (dùng giá EOD cuối tháng đó). Tránh được chuyện cron không biểu diễn được "ngày cuối tháng".
  - **Tuần:** cron fire theo thứ trong tuần (cron hỗ trợ day-of-week trực tiếp, vd `0 0 * * 0` = Chủ Nhật).
  - Chọn tháng hay tuần = đặt cron expression tương ứng trong workflow.
- **Tự động — cuối năm (`YEAR_END`):** vẫn chốt cuối mỗi năm cho báo cáo năm (cron ngày 01/01 ghi cho 31/12 năm trước, tương tự).
- **Thủ công:** mỗi khi có giao dịch mua/bán; khi người dùng bấm **"Chốt số liệu hôm nay"** (`MANUAL`).
- **Không lưu:** mốc "hôm nay" khi chỉ xem dashboard.
- **Tần suất định kỳ:** tháng hoặc tuần, đặt qua **cron workflow** (không qua `Setting`, không chạy hằng ngày). Không snapshot theo ngày.

## Cách tính
- Giá trị snapshot = NAV tại mốc (xem `04-pricing-and-valuation.md`) — với snapshot tổng danh mục là Σ NAV mọi `Holding` của user.
- Biểu đồ NAV theo thời gian dựng từ chuỗi snapshot tổng danh mục đã lưu.

## Ca biên
- **Thiếu giá tại mốc cron:** nếu một mã không có giá lúc chốt, ghi rõ (không mặc định 0). Cân nhắc dùng giá gần nhất + đánh dấu.
- **Chốt lại một mốc đã đóng băng:** mặc định không cho ghi đè; nếu cần sửa (dữ liệu sai) phải là hành động rõ ràng, có ghi vết.
- **Nhiều lần "chốt hôm nay" trong ngày:** cân nhắc gộp về một bản ghi/ngày để tránh trùng.

## Ví dụ
- Cron `0 0 1 * *` fire 01/03/2025 → ghi `Snapshot{ date: 28/02/2025, period: PERIODIC, frozen: true }` (cuối tháng 2, giá EOD 28/02).
- Cron `0 0 * * 0` → chốt mỗi Chủ Nhật, `period: PERIODIC`.
- Cron 01/01/2025 → ghi `Snapshot{ date: 31/12/2024, period: YEAR_END, frozen: true }`.
- Xem dashboard hôm nay → tính NAV động, **không** tạo snapshot.
