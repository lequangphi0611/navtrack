# Transactions & Cost basis

## Mục đích
Định nghĩa giao dịch mua/bán (`Cashflow`), quy ước dấu dòng tiền, cách tính giá vốn bình quân gia quyền, và cách khai báo vị thế mở ban đầu.

## Entity / field
- `Cashflow`: `holdingId`, `type` (`BUY`/`SELL`), `date`, `quantity`, `pricePerUnit`, `amount`, `taxAmount`, `feeAmount`, `note?`.
- `amount` **mang dấu sẵn**: âm khi mua, dương khi bán → dùng trực tiếp cho XIRR.

## Quy tắc & bất biến
- **Quy ước dấu:** BUY → `amount < 0` (tiền ra), SELL → `amount > 0` (tiền vào).
- `amount` của một giao dịch = (số lượng × giá) ± phí/thuế theo hướng dòng tiền thực:
  - BUY: `amount = -(quantity × pricePerUnit) - feeAmount` (tiền bỏ ra gồm cả phí). **Không có `taxAmount` cho BUY** — VN không đánh thuế khi mua chứng khoán, form ghi BUY không có field thuế (`taxAmount` luôn `0`, xem `07-tax.md`).
  - SELL: `amount = (quantity × pricePerUnit) - feeAmount - taxAmount` (tiền nhận sau phí, thuế). `taxAmount` **tự tính** từ `SALE_TAX_<loại>` tại ngày bán nhưng **prefill, cho sửa tay** (xem `07-tax.md` mục "Quy tắc & bất biến").
  - `feeAmount` (cả BUY lẫn SELL) **tự tính** từ `TRANSACTION_FEE_BUY_<loại>`/`TRANSACTION_FEE_SELL_<loại>` tại ngày giao dịch, cũng chỉ **prefill, cho sửa tay** — xem `07-tax.md` mục "Phí giao dịch (mua & bán)".
- **Không sửa giao dịch đã xảy ra thành dạng "ẩn"** — mọi thay đổi là sửa/xóa bản ghi rõ ràng, giữ lịch sử trung thực.
- **Bán không vượt quá số lượng đang giữ** tại thời điểm bán (validate ở biên server) — số lượng đang giữ **gồm cả cổ tức cổ phiếu đã nhận trước đó** (issue #59, xem `01-assets-and-holdings.md` mục "Cách tính"), không chỉ tổng mua/bán.

## Gắn giao dịch vào Holding (find-or-create)
- Khi ghi giao dịch cho một mã, hệ thống tìm `Holding` theo `(userId, symbol, type)`: **có thì gắn vào, chưa có thì tạo mới** (`@@unique([userId, symbol, type])`). Mua trùng mã đang giữ **không** tạo Holding thứ hai — xem `01-assets-and-holdings.md`.

## Cách tính — giá vốn bình quân gia quyền
- **Khi MUA thêm**, giá vốn bình quân được tính lại theo trọng số, **gồm cả phí mua** (đóng issue #66, xem `process/DECISION.md`):
  ```
  giá vốn mới = (SL cũ × giá vốn cũ + (SL mua × giá mua + phí mua)) / (SL cũ + SL mua)
  ```
  Giá vốn bình quân nhờ vậy phản ánh đúng **tổng tiền thực đã bỏ ra** cho mỗi đơn vị đang giữ, không chỉ giá khớp lệnh — khớp với `amount` của BUY (`-(quantity × pricePerUnit) - feeAmount`, xem trên).
- **Khi BÁN một phần**, giá vốn bình quân **giữ nguyên**; chỉ giảm số lượng (phương pháp bình quân di động).
- **Lãi/lỗ đã thực hiện** khi bán = `(giá bán − giá vốn bình quân) × SL bán − phí bán − thuế bán`. **Chỉ trừ phí/thuế của lần BÁN** — phí của lần MUA đã nằm sẵn trong giá vốn bình quân ở trên, trừ lại ở đây sẽ tính trùng.
- Giá vốn bình quân **dẫn xuất từ chuỗi `Cashflow` VÀ cổ tức cổ phiếu** (replay `derivePosition()`, `lib/cost-basis.ts` — hàm DUY NHẤT tính cả `quantity`/`avgCost`/`wentNegative`, replay CẢ `Cashflow` lẫn `Dividend{STOCK}`, issue #59, xem `01-assets-and-holdings.md` mục "Cách tính") — **nguồn sự thật là `Cashflow`** (+ `Dividend{STOCK}` cho phần số lượng), không phải cột lưu; cổ tức cổ phiếu không đổi `avgCost` (xem `03-dividends.md`). Để tránh replay toàn bộ lịch sử mỗi lần đọc màn Danh mục, giá trị này được **materialize** vào cột `Holding.avgCost` (kèm `Holding.quantity`) dưới dạng **cache dẫn xuất**, với bất biến: chỉ ghi lại trong **cùng transaction** với mọi thay đổi cashflow (không cộng/trừ tay) → cache luôn khớp nguồn, không tự lệch. Xem `docs/rules/data-prisma.md` (mục "Materialized cache…") và `process/DECISION.md` (2026-07-11) cho lý do đảo hướng "không lưu cứng" ban đầu. Giá vốn **tách khỏi XIRR** — XIRR dùng chuỗi dòng tiền thật theo ngày, không dùng giá vốn.

## Vị thế mở ban đầu
- Khi khai báo vị thế đang giữ (không import lịch sử), tạo `Holding` + **một `Cashflow` BUY tại ngày mốc**: `quantity` = SL đang giữ, `pricePerUnit` = giá vốn bình quân đã biết, `amount` = số âm tương ứng.
- XIRR và lãi/lỗ tính **từ mốc này trở đi** (không gồm quá khứ trước mốc).
- Đây **không phải entity riêng** — dùng lại `Cashflow` kiểu BUY.

## Ca biên
- **Bán hết rồi mua lại:** dùng lại **chính `Holding` đó** (ràng buộc unique buộc vậy); số lượng về 0 rồi tăng lại, giá vốn bình quân bắt đầu lại từ lần mua mới khi SL đang là 0.
- **Phí/thuế bằng 0:** mặc định `feeAmount = 0`, `taxAmount = 0`.
- **Giao dịch cùng ngày:** XIRR chấp nhận nhiều dòng tiền cùng ngày; thứ tự trong ngày không ảnh hưởng XIRR.

## Ví dụ
- Mua 100 FPT giá 100k, phí `0` → `BUY qty=100, price=100k, amount=-10.000.000`. Giá vốn bình quân = 100k.
- Mua thêm 100 FPT giá 120k, phí `0` → giá vốn bình quân = (100×100k + 100×120k)/200 = **110k**.
- Bán 50 FPT giá 130k → SL còn 150, **giá vốn bình quân vẫn 110k**; lãi thực hiện = (130k−110k)×50 = 1.000.000 (trước phí/thuế bán).
- **Có phí mua (mới):** mua 100 FPT giá 100k, phí mua 30.000 (0.3%) → giá vốn bình quân = (100×100k + 30.000)/100 = **100.300** (không phải 100k trần trụi) — xem thêm ví dụ đầy đủ ở `07-tax.md` mục "Ví dụ".
