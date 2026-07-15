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
- **Thiếu giá tại mốc chốt (cron `PERIODIC`/`YEAR_END` — issue #36, `jobs/snapshot-cron/`; MANUAL — issue #37, `freezeManualSnapshot()` gọi `planManualSnapshot()` ở `src/lib/manual-snapshot.ts`), áp dụng chung cho MỌI trigger:**
  - Một `Holding` đang mở nhưng không resolve được giá tại mốc chốt (không có `NavOverride`/`PriceQuote` nào ≤ ngày chốt) → **không ghi dòng Snapshot cho Holding đó** (không mặc định 0); log rõ `holdingId`/`userId`/`symbol`/ngày/`period`.
  - Snapshot tổng danh mục của user đó: còn **ít nhất 1** Holding resolve được giá → vẫn ghi tổng = tổng các Holding đã biết (PARTIAL), kèm log liệt kê mã còn thiếu giá. **Toàn bộ** Holding đang mở của user đều thiếu giá → **bỏ qua hẳn** dòng tổng ở mốc đó (0 sẽ sai) — với MANUAL, Server Action trả lỗi rõ ràng cho user thay vì âm thầm bỏ qua ("Chưa có mã nào định giá được, không thể chốt số liệu"). User không có `Holding` nào đang mở (đã bán hết/chưa từng mua) → NAV = 0 là số thật, vẫn ghi.
  - **Giới hạn đã biết:** schema `Snapshot` (khóa ở #34) không có cờ boolean đánh dấu một dòng tổng đã lưu là "PARTIAL" — bằng chứng duy nhất là log (GitHub Actions cho cron, pino cho Server Action MANUAL) tại thời điểm chốt. Không mở rộng schema cho việc này (xem `process/DECISION.md`, mục 2026-07-14).
- **Chốt lại một mốc đã đóng băng / chốt "hôm nay" nhiều lần trong ngày — đã chốt:** đúng **một** dòng frozen cho mỗi mốc theo khóa `(userId, holdingId-hoặc-null, date, period)` (ràng buộc DB, xem mục "Quy tắc & bất biến"). Chốt lại cùng một mốc (vd bấm "Chốt số liệu hôm nay" nhiều lần trong ngày, hoặc cron chạy lại) **phải** là **upsert idempotent** theo đúng khóa này — ghi đè giá trị dòng đã có, không tạo dòng mới, **luôn trả `ok: true`** (không phải lỗi). Cron `PERIODIC`/`YEAR_END` implement upsert idempotent ở issue #36; Server Action "Chốt số liệu hôm nay" (`freezeManualSnapshot()`, `period = MANUAL`) implement ở issue #37 — check-before-insert trong 1 transaction Serializable (không dùng `.upsert()` vì khóa dedup là partial unique index viết tay, Prisma không sinh input `where` compound cho nó).

## Ví dụ
- Cron `0 0 1 * *` fire 01/03/2025 → ghi `Snapshot{ date: 28/02/2025, period: PERIODIC, frozen: true }` (cuối tháng 2, giá EOD 28/02).
- Cron `0 0 * * 0` → chốt mỗi Chủ Nhật, `period: PERIODIC`.
- Cron 01/01/2025 → ghi `Snapshot{ date: 31/12/2024, period: YEAR_END, frozen: true }`.
- Xem dashboard hôm nay → tính NAV động, **không** tạo snapshot.

## Đọc lịch sử / chi tiết (issue #46)
- **Badge/label ở danh sách "Các mốc đã chốt" (`/snapshots`) suy TRỰC TIẾP từ `period`** — không thêm field schema mới cho việc này (đúng tinh thần đã chốt ở #34/#36/#37: không mở rộng schema chỉ để phục vụ hiển thị). `PERIODIC` → "ĐỊNH KỲ"/badge mặc định, `YEAR_END` → "CUỐI NĂM"/badge accent, `MANUAL` → "THỦ CÔNG"/badge warning — model không phân biệt được "MANUAL do giao dịch" với "MANUAL do user tự bấm nút", cả hai trigger gộp chung 1 badge.
- **Liên kết breakdown per-holding với dòng tổng ở `/snapshots/[id]`:** cùng `(userId, date, period)`, khác `holdingId` — đúng khóa dedup đã có từ #34, không cần thêm FK/index mới. `@@index([userId, date])` sẵn có đủ dùng cho cả truy vấn danh sách lẫn truy vấn chi tiết.
- **`recomputedComparison` (mockup 3f — "giá đã đổi từ khi chốt"):** với mỗi holding trong breakdown, suy ngược `quantity = frozenValue / historicalPrice` (giá đã resolve tại `snapshot.date`, đúng công thức `nav = quantity * price` đã dùng lúc chốt — không replay lại `Cashflow`), rồi `recomputedValue = quantity * currentPrice` (giá đã resolve tại hôm nay). Kết quả chỉ phản ánh ảnh hưởng của **giá**, không phản ánh thay đổi vị thế (mua/bán thêm) từ lúc chốt tới nay. Thiếu giá lịch sử/hiện tại, hoặc giá lịch sử = 0 → giữ nguyên `frozenValue` cho holding đó (fallback an toàn).
- **Ngưỡng hiện khối so sánh: `|Σrecomputed − frozenAggregateValue| ≥ 1 VND`** (dưới ngưỡng → coi như không đổi, chỉ hiện biến thể 3c). VND không có đơn vị lẻ dưới đồng nên ngưỡng này đủ nhạy để bắt mọi lệch giá thật, đồng thời tránh 3f giả do sai số làm tròn khi suy ngược `quantity`.
