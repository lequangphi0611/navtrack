# Phase 4 — Cổ tức

## Mục tiêu
Ghi nhận cổ tức tiền mặt (ảnh hưởng XIRR, tự khấu trừ thuế) và cổ tức cổ phiếu (tăng số lượng nắm giữ).

## Công việc cần làm
- [ ] Model `Dividend` (`type`, `date`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`) + enum `DividendType` + migration
- [ ] Cổ tức **tiền mặt**: nhập gộp → tự khấu trừ thuế (`DIVIDEND_TAX_RATE`) → lưu gross/tax/net; **net** là dòng tiền dương vào XIRR
- [ ] Cổ tức **cổ phiếu**: tăng `stockQuantity` nắm giữ, không phát sinh tiền
- [ ] UI ghi nhận cổ tức gắn với từng `Holding`

## Tiêu chí hoàn thành
- [ ] Cổ tức tiền mặt: net (sau thuế 5%) cộng vào chuỗi XIRR đúng
- [ ] Cổ tức cổ phiếu: số lượng nắm giữ tăng đúng, không tạo dòng tiền
- [ ] XIRR/lãi-lỗ phản ánh cổ tức chính xác

## Phụ thuộc / ghi chú
- Thuế cổ tức `DIVIDEND_TAX_RATE` lấy từ bảng `Setting` (Phase 5). Nếu làm Phase 4 trước Phase 5, cần đưa `Setting` lên sớm hoặc tạm dùng hằng số 5% rồi thay bằng `Setting` sau.
