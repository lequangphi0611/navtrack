# Phase 5 — Thuế bán (áp dụng)

## Mục tiêu
Áp dụng thuế khi bán, hiển thị lãi/lỗ **sau thuế**, và hiển thị **chi phí ăn mòn luỹ kế** (tổng thuế + phí) để trả lời "chi phí giao dịch đã ăn bao nhiêu % vốn tôi bỏ ra". Bảng `Setting` và `resolveSetting` **đã tạo ở Phase 1** — phase này chỉ dùng, không tạo bảng.

## Công việc cần làm
- [ ] Seed `SALE_TAX_STOCK/FUND/BOND` (mức % — xác nhận trước khi seed) + `SALE_TAX_GOLD = 0` (**đã chốt 2026-07-17**, xem `process/DECISION.md`)
- [ ] Thuế khi **bán** tự áp theo `SALE_TAX_<loại>` tra tại **ngày giao dịch** (`resolveSetting`); `Cashflow.amount` đã trừ thuế
- [ ] Sửa `TransactionForm.tsx`: field "Thuế" **bỏ hẳn khỏi form khi loại giao dịch là BUY** (VN không có thuế mua); với SELL, field **tự prefill** giá trị tính từ `SALE_TAX_<loại>` nhưng **vẫn cho sửa tay** (giống cơ chế `NavOverride`, không khoá field) — xem `docs/domain/07-tax.md`
- [ ] Hiển thị lãi/lỗ **sau thuế** trên dashboard — nhãn **"Lãi/lỗ (thực nhận)"** (đã chốt 2026-07-18, khớp mockup 5a-5d nhất quán dùng "thực nhận", vì đã trừ cả phí, không chỉ thuế)
- [ ] **Chi phí ăn mòn (mới, quyết định 2026-07-17):** thêm dòng phụ nhỏ dưới card lãi/lỗ (`ReturnMetrics`, `DashboardScreen.tsx`) hiển thị `costDragAmount` (Σ `Cashflow.taxAmount` + Σ `Cashflow.feeAmount` + Σ `Dividend.taxAmount`, tính tới `cutoffDate`) và `costDragPercent` (trên `grossInvested` = `Σ|BUY.amount|` vốn gộp đã triển khai, **không** phải `totalInvested` vốn ròng — xem `process/DECISION.md` 2026-07-17 (6)) — công thức đầy đủ ở `docs/domain/07-tax.md` mục "Chi phí ăn mòn"
- [ ] Kiểm tra effective dating: giao dịch lùi ngày + đổi thuế suất áp đúng suất thời điểm
- [ ] **Sửa một SELL đã ghi (đã chốt 2026-07-18):** đổi **ngày** → tự tính lại `taxAmount` theo `SALE_TAX_<loại>` tại ngày mới, hiển thị giá trị cũ (gạch ngang) cạnh giá trị mới + tên `Setting`/ngày hiệu lực áp dụng; vẫn cho sửa tay sau khi tính lại (không khoá field) — xem `docs/domain/07-tax.md` mục "Ca biên", mockup 5f (`process/UI_phase_5.md`)
- [ ] **Chi phí ăn mòn — sheet chi tiết (mở rộng phạm vi, đã chốt 2026-07-18):** dòng phụ dưới card lãi/lỗ **bấm được**, mở sheet breakdown theo 3 nguồn (phí giao dịch / thuế bán / thuế cổ tức) kèm % đóng góp mỗi nguồn trong tổng `costDragAmount` — mockup 5e (`process/UI_phase_5.md`)
- [ ] **Cấu trúc lại `ReturnMetrics`/card lãi-lỗ trên Dashboard (đã chốt 2026-07-18, bám đúng mockup 5d):** tách card lãi/lỗ (thực nhận) đứng riêng full-width (có footer "Chi phí ăn mòn" tappable, xem trên) khỏi hàng 2 cột XIRR; hàng 2 cột mới ghép "XIRR (sau thuế)" với chỉ số **mới** "Vốn đã bỏ ra mua" (hiển thị trực tiếp `grossInvested`, không chỉ dùng ngầm làm mẫu số %) — khác cấu trúc `ReturnMetrics` hiện tại (2 cột XIRR + PnL cạnh nhau, xem `src/components/ReturnMetrics/ReturnMetrics.tsx`)

## Tiêu chí hoàn thành
- [ ] Thuế tra đúng theo **ngày giao dịch** (kiểm với giao dịch lùi ngày + đổi thuế suất)
- [ ] BUY không có `taxAmount` (luôn 0, không có field trên form); SELL prefill tự động + sửa tay được
- [ ] Lãi/lỗ hiển thị là số sau thuế
- [ ] Dòng "chi phí ăn mòn" hiển thị đúng tổng thuế + phí và đúng % trên `grossInvested` (vốn gộp đã triển khai), cập nhật theo `cutoffDate` đang chọn; `grossInvested = 0` → hiển thị 0%, không lỗi chia 0; kiểm ca đã-bán-nhiều: % không phình bất thường
- [ ] Sửa `Setting` trực tiếp trên DB → app resolve giá trị mới (không có UI admin)
- [ ] Thiếu cấu hình → báo lỗi, không âm thầm dùng 0 (kể cả `GOLD` — vẫn phải seed dòng `0` tường minh)
- [ ] Sửa ngày một SELL đã ghi → `taxAmount` tự tính lại theo `SALE_TAX_<loại>` tại ngày mới, hiển thị rõ giá trị cũ vs mới, vẫn sửa tay được sau đó
- [ ] Sheet chi tiết "chi phí ăn mòn" mở từ dòng phụ → breakdown đúng 3 nguồn (phí/thuế bán/thuế cổ tức) + % đóng góp từng nguồn khớp tổng `costDragAmount`

## Phụ thuộc / ghi chú
- Bảng `Setting` + `resolveSetting` đến từ **Phase 1**. Phase này thuần về **logic áp thuế bán** + hiển thị sau thuế + chi phí ăn mòn.
- **Đáo hạn trái phiếu vs bán trước hạn:** cố ý chưa xử lý riêng ở Phase 5 (áp `SALE_TAX_BOND` chung cho mọi SELL) — bàn kỹ khi làm Phase 7, xem `docs/domain/07-tax.md` mục "Ca biên" và `process/phase-7.md`.
- **Chi phí ăn mòn dùng lại dữ liệu có sẵn** (`Cashflow.feeAmount` từ Phase 1, `Dividend.taxAmount` từ Phase 4, `Cashflow.taxAmount` mới của Phase 5) — không cần field/model mới, chỉ cần một hàm tổng hợp + một dòng UI. Mẫu số `grossInvested` = `Σ|BUY.amount|` tính thêm từ chuỗi `Cashflow` (không tái dùng `totalInvested` vốn ròng — xem A1/`process/DECISION.md` 2026-07-17 (6)).
