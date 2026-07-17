# Phase 6 — Biểu đồ + hoàn thiện dashboard

## Mục tiêu
Trực quan hóa danh mục bằng hai biểu đồ và bổ sung chế độ ẩn số tiền.

## Công việc cần làm
- [ ] Biểu đồ **NAV theo thời gian** (Recharts) dựa trên snapshot tổng danh mục đã lưu
- [ ] Biểu đồ **phân bổ tài sản** (% theo `AssetType` tại hiện tại) — CCQ tính là nhóm "Quỹ"
- [ ] **Chế độ ẩn số tiền:** nút mắt bật/tắt nhanh + mặc định `User.hideAmountsByDefault`; che giá trị VND tuyệt đối, **giữ** phần trăm
- [ ] Format tập trung ở `lib/format.ts` (VND, ngày `dd/MM/yyyy`, %); tôn trọng privacy mode
- [ ] Tab **"Đã đóng"**: liệt kê vị thế đã bán hết (SL=0) với lãi/lỗ đã chốt + XIRR chốt; ẩn khỏi dashboard chính nhưng vẫn tính vào tổng hiệu quả
- [ ] **Cảnh báo tập trung (mới, quyết định 2026-07-17):** seed `Setting{CONCENTRATION_WARNING_THRESHOLD}` = 30; tính `concentrationPercent` cho từng `Holding` đang mở (NAV Holding / NAV danh mục) và gắn badge cảnh báo khi vượt ngưỡng — công thức đầy đủ ở `docs/domain/04-pricing-and-valuation.md` mục "Cảnh báo tập trung"
- [ ] Skeleton per-route + Suspense tách nhỏ cho từng vùng data

## Tiêu chí hoàn thành
- [ ] Hai biểu đồ hiển thị đúng dữ liệu
- [ ] Bật ẩn số tiền: NAV/lãi-lỗ thành `••••••`, XIRR và tỷ trọng vẫn hiện
- [ ] Mặc định ẩn số tiền lưu theo từng user
- [ ] Holding vượt `CONCENTRATION_WARNING_THRESHOLD` hiện badge cảnh báo; vị thế thiếu giá không bị tính nhầm 0%/không cảnh báo sai; vị thế đóng không bao giờ bị cảnh báo

## Phụ thuộc / ghi chú
- Biểu đồ NAV cần snapshot (Phase 3). Biểu đồ phân bổ cần định giá (Phase 2). Cảnh báo tập trung tái dùng dữ liệu định giá per-holding đã có (Phase 2), không phụ thuộc thêm.
