# Phase 5 — Thuế bán (áp dụng)

## Mục tiêu
Áp dụng thuế khi bán, hiển thị lãi/lỗ **sau thuế**, và hiển thị **chi phí ăn mòn luỹ kế** (tổng thuế + phí) để trả lời "chi phí giao dịch đã ăn bao nhiêu % vốn tôi bỏ ra". Bảng `Setting` và `resolveSetting` **đã tạo ở Phase 1** — phase này chỉ dùng, không tạo bảng.

## Công việc cần làm
- [ ] Seed `SALE_TAX_STOCK/FUND/BOND` (mức % — xác nhận trước khi seed) + `SALE_TAX_GOLD = 0` (**đã chốt 2026-07-17**, xem `process/DECISION.md`)
- [ ] Thuế khi **bán** tự áp theo `SALE_TAX_<loại>` tra tại **ngày giao dịch** (`resolveSetting`); `Cashflow.amount` đã trừ thuế
- [ ] Sửa `TransactionForm.tsx`: field "Thuế" **bỏ hẳn khỏi form khi loại giao dịch là BUY** (VN không có thuế mua); với SELL, field **tự prefill** giá trị tính từ `SALE_TAX_<loại>` nhưng **vẫn cho sửa tay** (giống cơ chế `NavOverride`, không khoá field) — xem `docs/domain/07-tax.md`
- [ ] Hiển thị lãi/lỗ **sau thuế** trên dashboard (cân nhắc đổi nhãn rõ hơn thành "thực nhận" vì đã trừ cả phí, không chỉ thuế)
- [ ] **Chi phí ăn mòn (mới, quyết định 2026-07-17):** thêm dòng phụ nhỏ dưới card lãi/lỗ (`ReturnMetrics`, `DashboardScreen.tsx`) hiển thị `costDragAmount` (Σ `Cashflow.taxAmount` + Σ `Cashflow.feeAmount` + Σ `Dividend.taxAmount`, tính tới `cutoffDate`) và `costDragPercent` (trên `totalInvested` đã có sẵn ở `lib/portfolio-valuation.ts`) — công thức đầy đủ ở `docs/domain/07-tax.md` mục "Chi phí ăn mòn"
- [ ] Kiểm tra effective dating: giao dịch lùi ngày + đổi thuế suất áp đúng suất thời điểm
- [ ] Chốt hành vi khi **sửa** một SELL đã ghi (đổi ngày/giá): tính lại `taxAmount` theo ngày mới hay giữ nguyên giá trị cũ — điểm còn mở, xem `docs/domain/07-tax.md` mục "Ca biên"

## Tiêu chí hoàn thành
- [ ] Thuế tra đúng theo **ngày giao dịch** (kiểm với giao dịch lùi ngày + đổi thuế suất)
- [ ] BUY không có `taxAmount` (luôn 0, không có field trên form); SELL prefill tự động + sửa tay được
- [ ] Lãi/lỗ hiển thị là số sau thuế
- [ ] Dòng "chi phí ăn mòn" hiển thị đúng tổng thuế + phí và đúng % trên `totalInvested`, cập nhật theo `cutoffDate` đang chọn; `totalInvested = 0` → hiển thị 0%, không lỗi chia 0
- [ ] Sửa `Setting` trực tiếp trên DB → app resolve giá trị mới (không có UI admin)
- [ ] Thiếu cấu hình → báo lỗi, không âm thầm dùng 0 (kể cả `GOLD` — vẫn phải seed dòng `0` tường minh)

## Phụ thuộc / ghi chú
- Bảng `Setting` + `resolveSetting` đến từ **Phase 1**. Phase này thuần về **logic áp thuế bán** + hiển thị sau thuế + chi phí ăn mòn.
- **Đáo hạn trái phiếu vs bán trước hạn:** cố ý chưa xử lý riêng ở Phase 5 (áp `SALE_TAX_BOND` chung cho mọi SELL) — bàn kỹ khi làm Phase 7, xem `docs/domain/07-tax.md` mục "Ca biên" và `process/phase-7.md`.
- **Chi phí ăn mòn dùng lại dữ liệu có sẵn** (`Cashflow.feeAmount` từ Phase 1, `Dividend.taxAmount` từ Phase 4, `Cashflow.taxAmount` mới của Phase 5, `totalInvested` đã tính sẵn trong `lib/portfolio-valuation.ts`) — không cần field/model mới, chỉ cần một hàm tổng hợp + một dòng UI.
