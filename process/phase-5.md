# Phase 5 — Thuế + bảng Setting

## Mục tiêu
Bảng master `Setting` (cấu hình được, effective dating) làm nguồn cho mọi thuế suất; tự động trừ thuế khi bán và hiển thị lãi/lỗ sau thuế.

## Công việc cần làm
- [ ] Model `Setting` (`key`, `value`, `valueType`, `label`, `group`, `unit?`, `effectiveFrom`, `updatedBy?`, timestamps, `@@unique([key, effectiveFrom])`) + enum `SettingValueType` + migration
- [ ] `prisma/seed.ts`: seed `SALE_TAX_STOCK/FUND/BOND/GOLD`, `DIVIDEND_TAX_RATE`, `MAX_MEMBERS` với `effectiveFrom` mốc đầu (xác nhận mức % trước)
- [ ] `resolveSetting(key, atDate)`: lấy dòng `effectiveFrom` lớn nhất ≤ atDate; parse theo `valueType`; thiếu → lỗi rõ
- [ ] Thuế khi **bán** tự áp theo `SALE_TAX_<loại>` tại ngày giao dịch; `Cashflow.amount` đã trừ thuế
- [ ] Hiển thị lãi/lỗ **sau thuế**
- [ ] (Kích hoạt) `MAX_MEMBERS` cho giới hạn mời + `DIVIDEND_TAX_RATE` cho cổ tức (Phase 4)

## Tiêu chí hoàn thành
- [ ] Thuế tra đúng theo **ngày giao dịch** (kiểm với giao dịch lùi ngày + đổi thuế suất)
- [ ] Lãi/lỗ hiển thị là số sau thuế
- [ ] Sửa giá trị `Setting` trực tiếp trên DB → app resolve giá trị mới (không có UI admin)
- [ ] Thiếu cấu hình → báo lỗi, không âm thầm dùng 0

## Phụ thuộc / ghi chú
- `Setting` được nhiều phase dùng (thuế bán, thuế cổ tức, MAX_MEMBERS). Cân nhắc **đưa Phase này lên sớm** nếu Phase 4/tính năng mời cần trước.
