# Tax

## Mục đích
Định nghĩa cách app tự tính và trừ thuế, để lãi/lỗ hiển thị là số **thực nhận** chứ không phải số trên giấy.

## Entity / field
- `TaxRule`: `assetType` (unique), `ratePercent` — thuế **khi bán** theo loại tài sản.
- Thuế **cổ tức tiền mặt** lưu trên `Dividend` (`taxAmount`) — xem `03-dividends.md`.
- Thuế **khi bán** lưu trên `Cashflow` (`taxAmount`) — xem `02-transactions-and-cost-basis.md`.

## Quy tắc & bất biến
- **Thuế khi bán** tự áp khi ghi giao dịch SELL: `taxAmount = giá trị bán × ratePercent`. Với cổ phiếu VN thường ~**0.1%** trên giá trị bán.
  - `amount` (dòng tiền vào) của SELL đã **trừ thuế**: `= (quantity × price) − fee − tax`.
- **Thuế cổ tức tiền mặt** ~**5%** khấu trừ khi ghi cổ tức; dòng tiền dương vào XIRR = số thực nhận sau thuế.
- **Hai loại thuế tách biệt:** thuế bán (theo `TaxRule`/`AssetType`) ≠ thuế cổ tức (~5%, không nằm trong `TaxRule`).
- **Cấu hình được, không hard-code:** thuế suất bán để trong `TaxRule` (seed mặc định), sửa được khi quy định thay đổi.
- Lãi/lỗ hiển thị là **sau thuế**.

## Cách tính
- **Lãi/lỗ sau thuế (một lần bán)** = `(giá bán − giá vốn bình quân) × SL bán − phí − thuế bán`.
- Vì thuế đã nằm trong `Cashflow.amount` và `Dividend.netAmount`, **XIRR tự phản ánh sau thuế** mà không cần xử lý thêm.

## Ca biên
- **Mức thuế cần xác nhận (điểm còn mở):** 0.1% (bán cổ phiếu) và 5% (cổ tức) là mức phổ biến VN nhưng chưa chốt; các loại khác (quỹ/trái phiếu/vàng) có thể khác — xác nhận trước khi code Phase 5.
- **Thuế theo loại tài sản khác nhau:** `TaxRule` theo `AssetType` cho phép mỗi loại một mức (hoặc 0 nếu không áp).
- **Lỗ khi bán:** vẫn có thể phát sinh thuế trên *giá trị bán* (không phải trên lãi) — mô hình `giá trị bán × ratePercent` phản ánh đúng cách VN đánh thuế cổ phiếu (trên giá trị giao dịch, không trên lãi).

## Ví dụ
- Bán 50 FPT giá 130k → giá trị bán 6.500.000 → thuế 0.1% = 6.500 → tiền nhận ≈ 6.493.500 (trước phí).
- Cổ tức tiền mặt gộp 200.000 → thuế 5% = 10.000 → thực nhận 190.000.
