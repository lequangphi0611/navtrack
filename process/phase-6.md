# Phase 6 — Biểu đồ + hoàn thiện dashboard

## Mục tiêu
Trực quan hóa danh mục bằng hai biểu đồ và bổ sung chế độ ẩn số tiền.

## Công việc cần làm
- [x] Biểu đồ **NAV theo thời gian** (Recharts) dựa trên snapshot tổng danh mục đã lưu
- [x] Biểu đồ **phân bổ tài sản** (% theo `AssetType` tại hiện tại) — CCQ tính là nhóm "Quỹ"
- [x] **Chế độ ẩn số tiền:** nút mắt bật/tắt nhanh + mặc định `User.hideAmountsByDefault`; che giá trị VND tuyệt đối, **giữ** phần trăm
- [x] Format tập trung ở `lib/format.ts` (VND, ngày `dd/MM/yyyy`, %); tôn trọng privacy mode
- [x] Tab **"Đã đóng"**: liệt kê vị thế đã bán hết (SL=0) với lãi/lỗ đã chốt + XIRR chốt; ẩn khỏi dashboard chính nhưng vẫn tính vào tổng hiệu quả
- [x] **Cảnh báo tập trung (quyết định 2026-07-17, thu hẹp/bổ sung 2026-07-21):** seed `Setting{CONCENTRATION_WARNING_THRESHOLD}` = 30; tính `concentrationPercent` cho từng `Holding` đang mở (NAV Holding / NAV danh mục) và gắn badge cảnh báo khi vượt ngưỡng — công thức đầy đủ + 3 bổ sung dưới đây ở `docs/domain/04-pricing-and-valuation.md` mục "Cảnh báo tập trung":
  - **Materiality cho `MISSING_PRICE`:** chỉ treo cảnh báo *toàn danh mục* khi `missingPriceShare` (ước lượng bằng cost basis mã thiếu giá / tổng NAV+cost basis) `> 5%`; dưới ngưỡng đó vẫn cảnh báo bình thường trên các mã có giá + ghi chú "NAV đang thiếu ~X%"
  - **Ghi chú "tập trung tự nhiên do ít mã":** khi `100 / (số Holding mở có giá) > threshold`, mọi badge trong danh mục kèm thêm dòng giải thích ngắn (không hard-code số mã cố định, tự tính từ `n`)
  - **Hysteresis:** buffer 3 điểm % chống nhấp nháy quanh ngưỡng — bật ở `threshold`, chỉ tắt khi xuống dưới `threshold − 3`; cần cơ chế lưu trạng thái cảnh báo trước đó per-`Holding` (field cụ thể do implementer quyết định lúc code)
  - **Chú thích liên kết trên biểu đồ phân bổ:** khi có ≥1 `Holding` đang cảnh báo, hiện dòng chú thích nhỏ dưới biểu đồ phân bổ tài sản (theo nhóm `AssetType`) dạng "N mã đang vượt ngưỡng tập trung — xem bảng vị thế bên dưới", tránh user nhìn biểu đồ theo nhóm rồi tưởng đã đa dạng dù có 1 mã lệch hẳn trong nhóm
- [x] Skeleton per-route + Suspense tách nhỏ cho từng vùng data

## Tiêu chí hoàn thành
- [x] Hai biểu đồ hiển thị đúng dữ liệu
- [x] Bật ẩn số tiền: NAV/lãi-lỗ thành `••••••`, XIRR và tỷ trọng vẫn hiện
- [x] Mặc định ẩn số tiền lưu theo từng user
- [x] Holding vượt `CONCENTRATION_WARNING_THRESHOLD` hiện badge cảnh báo; vị thế đóng không bao giờ bị cảnh báo
- [x] **A2 (thu hẹp 2026-07-21):** khi danh mục còn mã thiếu giá VÀ `missingPriceShare > 5%`, **treo** cảnh báo tập trung toàn danh mục; khi `≤ 5%`, vẫn cảnh báo bình thường trên các mã có giá kèm ghi chú NAV thiếu một phần — không báo động giả, không mất tín hiệu quá mức vì một mã nhỏ thiếu giá
- [x] Danh mục có `100/n > threshold` (n = số Holding mở có giá): badge kèm ghi chú "tập trung tự nhiên do ít mã"
- [x] Badge không nhấp nháy khi `concentrationPercent` dao động sát ngưỡng (hysteresis buffer 3 điểm %)
- [x] Biểu đồ phân bổ tài sản có chú thích liên kết khi có Holding đang cảnh báo tập trung

## Ghi chú xác thực còn thiếu (Claude Cloud)
Đã tick đủ dựa trên bằng chứng code + unit test (lint/typecheck/test/build đều PASS, 241 test). Hai việc sau **chưa** verify thật vì cần hạ tầng chỉ có ở Claude Local, cần chạy lại trước khi hoàn toàn yên tâm:
- **E2E thật (Playwright + Docker):** chưa chạy được trên Claude Cloud, `e2e-verifier` báo SKIP.
- **`prisma migrate dev` thật:** migration `20260721090159_add_holding_concentration_warning_active` mới viết tay + `prisma validate`, chưa chạy `migrate dev` thật với Docker Postgres.

## Phụ thuộc / ghi chú
- Biểu đồ NAV cần snapshot (Phase 3). Biểu đồ phân bổ cần định giá (Phase 2). Cảnh báo tập trung tái dùng dữ liệu định giá per-holding đã có (Phase 2), không phụ thuộc thêm.
