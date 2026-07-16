# Phase 4 — Cổ tức

## Mục tiêu
Ghi nhận cổ tức tiền mặt (ảnh hưởng XIRR, tự khấu trừ thuế) và cổ tức cổ phiếu (tăng số lượng nắm giữ).

## Công việc cần làm
- [ ] Model `Dividend` (`type`, `date`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`) + enum `DividendType` + migration
- [ ] Cổ tức **tiền mặt**: nhập gộp → tự khấu trừ thuế (`DIVIDEND_TAX_RATE`) → lưu gross/tax/net; **net** là dòng tiền dương vào XIRR
- [ ] Cổ tức **cổ phiếu**: tăng `stockQuantity` nắm giữ, không phát sinh tiền
- [x] UI ghi nhận cổ tức gắn với từng `Holding` — Presentational xong (issue #51, sample data): `DividendForm`/`HoldingSwitcher`/`DividendHistoryScreen` + CTA "Ghi cổ tức"/"Lịch sử cổ tức" trên `HoldingDetailScreen` + entry point Dashboard. Chi tiết + điểm lệch so với plan: [`UI_phase_4.md`](./UI_phase_4.md). Server Action/query thật vẫn chờ #52.

## Tiêu chí hoàn thành
- [ ] Cổ tức tiền mặt: net (sau thuế 5%) cộng vào chuỗi XIRR đúng
- [ ] Cổ tức cổ phiếu: số lượng nắm giữ tăng đúng, không tạo dòng tiền
- [ ] XIRR/lãi-lỗ phản ánh cổ tức chính xác

## Phụ thuộc / ghi chú
- Thuế cổ tức `DIVIDEND_TAX_RATE` lấy từ bảng `Setting` — **đã có sẵn từ Phase 1** (không còn phụ thuộc chờ Phase 5). Dùng `resolveSetting("DIVIDEND_TAX_RATE", ngày chia)`.
