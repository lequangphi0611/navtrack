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
- **Dedup ở tầng DB:** tối đa **một** dòng snapshot đã đóng băng cho mỗi `(userId, holdingId-hoặc-null, date, period)` — ràng buộc bằng 2 partial unique index (không phải `@@unique` thường, vì `holdingId` nullable). Chi tiết đầy đủ ở `docs/02-data-model.md` (mục "Ghi chú thiết kế").

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
- **`source` của snapshot tổng danh mục (`holdingId = null`) luôn là `AUTO`**, bất kể các Holding đóng góp dùng giá `MANUAL` hay `AUTO` — tổng danh mục là một con số **tính toán** (sum), không phải giá trị lấy thẳng từ 1 dòng `NavOverride`. `MANUAL` chỉ dành cho giá trị đúng bằng 1 giá nhập tay (cấp Holding).
- Biểu đồ NAV theo thời gian dựng từ chuỗi snapshot tổng danh mục đã lưu.

## Ca biên
- **Thiếu giá tại mốc cron (issue #36, `jobs/snapshot-cron/`):**
  - Một `Holding` đang mở nhưng không resolve được giá tại mốc chốt (không có `NavOverride`/`PriceQuote` nào ≤ ngày chốt) → **không ghi dòng Snapshot cho Holding đó** (không mặc định 0); log rõ `holdingId`/`userId`/`symbol`/ngày/`period`.
  - Snapshot tổng danh mục của user đó: còn **ít nhất 1** Holding resolve được giá → vẫn ghi tổng = tổng các Holding đã biết (PARTIAL), kèm log liệt kê mã còn thiếu giá. **Toàn bộ** Holding đang mở của user đều thiếu giá → **bỏ qua hẳn** dòng tổng ở mốc đó (0 sẽ sai). User không có `Holding` nào đang mở (đã bán hết/chưa từng mua) → NAV = 0 là số thật, vẫn ghi.
  - **Giới hạn đã biết:** schema `Snapshot` (khóa ở #34) không có cờ boolean đánh dấu một dòng tổng đã lưu là "PARTIAL" — bằng chứng duy nhất là log GitHub Actions tại thời điểm job chạy. Không mở rộng schema cho việc này ở issue #36 (xem `process/DECISION.md`, mục 2026-07-14).
- **Chốt lại một mốc đã đóng băng / chốt "hôm nay" nhiều lần trong ngày — đã chốt:** đúng **một** dòng frozen cho mỗi mốc theo khóa `(userId, holdingId-hoặc-null, date, period)` (ràng buộc DB, xem mục "Quy tắc & bất biến"). Chốt lại cùng một mốc (vd bấm "Chốt số liệu hôm nay" nhiều lần trong ngày, hoặc cron chạy lại) **phải** là **upsert idempotent** theo đúng khóa này — ghi đè giá trị dòng đã có, không tạo dòng mới. *(Cron `PERIODIC`/`YEAR_END` đã implement upsert idempotent ở issue #36; Server Action "Chốt số liệu hôm nay" — `period = MANUAL` — vẫn là issue Phase 3 riêng sau.)*

## Ví dụ
- Cron `0 0 1 * *` fire 01/03/2025 → ghi `Snapshot{ date: 28/02/2025, period: PERIODIC, frozen: true }` (cuối tháng 2, giá EOD 28/02).
- Cron `0 0 * * 0` → chốt mỗi Chủ Nhật, `period: PERIODIC`.
- Cron 01/01/2025 → ghi `Snapshot{ date: 31/12/2024, period: YEAR_END, frozen: true }`.
- Xem dashboard hôm nay → tính NAV động, **không** tạo snapshot.
