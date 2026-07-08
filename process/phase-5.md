# Phase 5 — Thuế bán (áp dụng)

## Mục tiêu
Áp dụng thuế khi bán và hiển thị lãi/lỗ **sau thuế**. Bảng `Setting` và `resolveSetting` **đã tạo ở Phase 1** — phase này chỉ dùng, không tạo bảng.

## Công việc cần làm
- [ ] Đảm bảo đã seed `SALE_TAX_STOCK/FUND/BOND/GOLD` trong `Setting` (mức % — xác nhận trước)
- [ ] Thuế khi **bán** tự áp theo `SALE_TAX_<loại>` tra tại **ngày giao dịch** (`resolveSetting`); `Cashflow.amount` đã trừ thuế
- [ ] Hiển thị lãi/lỗ **sau thuế** trên dashboard
- [ ] Kiểm tra effective dating: giao dịch lùi ngày + đổi thuế suất áp đúng suất thời điểm

## Tiêu chí hoàn thành
- [ ] Thuế tra đúng theo **ngày giao dịch** (kiểm với giao dịch lùi ngày + đổi thuế suất)
- [ ] Lãi/lỗ hiển thị là số sau thuế
- [ ] Sửa `Setting` trực tiếp trên DB → app resolve giá trị mới (không có UI admin)
- [ ] Thiếu cấu hình → báo lỗi, không âm thầm dùng 0

## Phụ thuộc / ghi chú
- Bảng `Setting` + `resolveSetting` đến từ **Phase 1**. Phase này thuần về **logic áp thuế bán** + hiển thị sau thuế.
