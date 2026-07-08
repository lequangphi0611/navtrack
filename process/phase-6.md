# Phase 6 — Biểu đồ + hoàn thiện dashboard

## Mục tiêu
Trực quan hóa danh mục bằng hai biểu đồ và bổ sung chế độ ẩn số tiền.

## Công việc cần làm
- [ ] Biểu đồ **NAV theo thời gian** (Recharts) dựa trên snapshot tổng danh mục đã lưu
- [ ] Biểu đồ **phân bổ tài sản** (% theo `AssetType` tại hiện tại) — CCQ tính là nhóm "Quỹ"
- [ ] **Chế độ ẩn số tiền:** nút mắt bật/tắt nhanh + mặc định `User.hideAmountsByDefault`; che giá trị VND tuyệt đối, **giữ** phần trăm
- [ ] Format tập trung ở `lib/format.ts` (VND, ngày `dd/MM/yyyy`, %); tôn trọng privacy mode
- [ ] Skeleton per-route + Suspense tách nhỏ cho từng vùng data

## Tiêu chí hoàn thành
- [ ] Hai biểu đồ hiển thị đúng dữ liệu
- [ ] Bật ẩn số tiền: NAV/lãi-lỗ thành `••••••`, XIRR và tỷ trọng vẫn hiện
- [ ] Mặc định ẩn số tiền lưu theo từng user

## Phụ thuộc / ghi chú
- Biểu đồ NAV cần snapshot (Phase 3). Biểu đồ phân bổ cần định giá (Phase 2).
