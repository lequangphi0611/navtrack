# Phase 5 — Thuế bán (áp dụng)

## Mục tiêu
Áp dụng thuế khi bán và hiển thị lãi/lỗ **sau thuế**. Bảng `Setting` và `resolveSetting` **đã tạo ở Phase 1** — phase này chỉ dùng, không tạo bảng.

## Công việc cần làm
- [ ] Seed `SALE_TAX_STOCK/FUND/BOND` (mức % — xác nhận trước khi seed) + `SALE_TAX_GOLD = 0` (**đã chốt 2026-07-17**, xem `process/DECISION.md`)
- [ ] Thuế khi **bán** tự áp theo `SALE_TAX_<loại>` tra tại **ngày giao dịch** (`resolveSetting`); `Cashflow.amount` đã trừ thuế
- [ ] Sửa `TransactionForm.tsx`: field "Thuế" **bỏ hẳn khỏi form khi loại giao dịch là BUY** (VN không có thuế mua); với SELL, field **tự prefill** giá trị tính từ `SALE_TAX_<loại>` nhưng **vẫn cho sửa tay** (giống cơ chế `NavOverride`, không khoá field) — xem `docs/domain/07-tax.md`
- [ ] Hiển thị lãi/lỗ **sau thuế** trên dashboard (cân nhắc đổi nhãn rõ hơn thành "thực nhận" vì đã trừ cả phí, không chỉ thuế)
- [ ] Kiểm tra effective dating: giao dịch lùi ngày + đổi thuế suất áp đúng suất thời điểm
- [ ] Chốt hành vi khi **sửa** một SELL đã ghi (đổi ngày/giá): tính lại `taxAmount` theo ngày mới hay giữ nguyên giá trị cũ — điểm còn mở, xem `docs/domain/07-tax.md` mục "Ca biên"

## Tiêu chí hoàn thành
- [ ] Thuế tra đúng theo **ngày giao dịch** (kiểm với giao dịch lùi ngày + đổi thuế suất)
- [ ] BUY không có `taxAmount` (luôn 0, không có field trên form); SELL prefill tự động + sửa tay được
- [ ] Lãi/lỗ hiển thị là số sau thuế
- [ ] Sửa `Setting` trực tiếp trên DB → app resolve giá trị mới (không có UI admin)
- [ ] Thiếu cấu hình → báo lỗi, không âm thầm dùng 0 (kể cả `GOLD` — vẫn phải seed dòng `0` tường minh)

## Phụ thuộc / ghi chú
- Bảng `Setting` + `resolveSetting` đến từ **Phase 1**. Phase này thuần về **logic áp thuế bán** + hiển thị sau thuế.
- **Đáo hạn trái phiếu vs bán trước hạn:** cố ý chưa xử lý riêng ở Phase 5 (áp `SALE_TAX_BOND` chung cho mọi SELL) — bàn kỹ khi làm Phase 7, xem `docs/domain/07-tax.md` mục "Ca biên" và `process/phase-7.md`.
