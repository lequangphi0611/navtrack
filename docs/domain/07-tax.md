# Tax

## Mục đích
Định nghĩa cách app tự tính và trừ thuế, để lãi/lỗ hiển thị là số **thực nhận** chứ không phải số trên giấy.

## Entity / field
- **`Setting`** (bảng master cấu hình, effective dating) giữ mọi thuế suất: `SALE_TAX_<LOẠI>` (thuế bán theo loại), `DIVIDEND_TAX_RATE` (thuế cổ tức). Thay cho `TaxRule` cũ.
- Thuế **đã tính** lưu trên chính giao dịch: `Cashflow.taxAmount` (khi bán), `Dividend.taxAmount` (cổ tức) — xem `02-` và `03-`.

## Quy tắc & bất biến
- **Thuế suất tra từ `Setting` theo NGÀY giao dịch** (effective dating): dùng dòng có `effectiveFrom` lớn nhất mà `<=` ngày giao dịch. Nhờ vậy giao dịch lùi ngày áp đúng thuế suất thời điểm đó.
- **Thuế khi bán** tự áp khi ghi SELL: `taxAmount = giá trị bán × (SALE_TAX_<loại> tại ngày bán)`. Cổ phiếu VN thường ~**0.1%** trên giá trị bán.
  - `amount` (dòng tiền vào) của SELL đã **trừ thuế**: `= (quantity × price) − fee − tax`.
- **Thuế cổ tức tiền mặt** = `DIVIDEND_TAX_RATE` (~**5%**) khấu trừ khi ghi cổ tức; dòng tiền dương vào XIRR = số thực nhận sau thuế.
- **Đóng băng tại thời điểm ghi:** thuế đã tính lưu trên giao dịch (`taxAmount`) nên đổi `Setting` sau này **không** hồi tố bản ghi cũ.
- **Cấu hình được, không hard-code:** mọi thuế suất trong `Setting`, sửa qua UI settings, có audit (`updatedBy`/`updatedAt`).
- Lãi/lỗ hiển thị là **sau thuế**.

## Cách tính
- **Lãi/lỗ sau thuế (một lần bán)** = `(giá bán − giá vốn bình quân) × SL bán − phí − thuế bán`.
- Vì thuế đã nằm trong `Cashflow.amount` và `Dividend.netAmount`, **XIRR tự phản ánh sau thuế** mà không cần xử lý thêm.

## Ca biên
- **Mức thuế cần xác nhận (điểm còn mở):** 0.1% (bán cổ phiếu) và 5% (cổ tức) là mức phổ biến VN nhưng chưa chốt; các loại khác (quỹ/trái phiếu/vàng) có thể khác — xác nhận trước khi seed `Setting`.
- **Thuế theo loại tài sản khác nhau:** mỗi loại một key `SALE_TAX_<LOẠI>` (đặt 0 nếu không áp).
- **Đổi chính sách giữa chừng:** thêm dòng `Setting` mới cùng `key`, `effectiveFrom` = ngày hiệu lực mới — không sửa dòng cũ (giữ lịch sử).
- **Giao dịch trước mọi mốc effectiveFrom:** nếu không có dòng nào `effectiveFrom <= ngày` → coi là thiếu cấu hình, báo rõ (không mặc định 0 âm thầm).
- **Lỗ khi bán:** vẫn có thể phát sinh thuế trên *giá trị bán* (không phải trên lãi) — mô hình `giá trị bán × ratePercent` phản ánh đúng cách VN đánh thuế cổ phiếu (trên giá trị giao dịch, không trên lãi).

## Ví dụ
- Bán 50 FPT giá 130k → giá trị bán 6.500.000 → thuế 0.1% = 6.500 → tiền nhận ≈ 6.493.500 (trước phí).
- Cổ tức tiền mặt gộp 200.000 → thuế 5% = 10.000 → thực nhận 190.000.
