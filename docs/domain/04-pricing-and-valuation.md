# Pricing & Valuation

## Mục đích
Định nghĩa cách xác định giá trị thị trường hiện tại (NAV) của từng vị thế và cả danh mục, từ nguồn tự động hoặc nhập tay.

## Entity / field
- `NavOverride`: `holdingId`, `date`, `price`, `note?` — giá nhập tay theo ngày.
- Giá tự động: lấy từ `vnstock`, **ghi vào DB bởi job Python** (app chỉ đọc; xem `04-tech-stack.md`).

## Quy tắc & bất biến
- **NAV của một vị thế** = `số lượng hiện tại × giá tại thời điểm cần định giá`.
- **Nguồn giá theo loại tài sản:**
  - STOCK, FUND: **tự động** (vnstock), vẫn cho sửa tay khi cần.
  - GOLD, BOND: **mặc định nhập tay** (nguồn tự động kém ổn định).
- **Ưu tiên giá:** nếu có `NavOverride` cho ngày cần → dùng giá nhập tay; nếu không → dùng giá tự động. UI ghi rõ nguồn ("Tự động (vnstock)" / "Nhập tay").
- **Vàng:** dùng **giá mua vào** (giá bạn bán ra được), lưu ý đơn vị chỉ/lượng khớp với `Holding.unit`.
- App TypeScript **chỉ đọc** giá; **không** gọi vnstock trực tiếp.

## Cách tính
- **NAV danh mục** tại một mốc = Σ NAV của mọi `Holding` của user tại mốc đó.
- Giá dùng cho mốc "hôm nay" là giá mới nhất; giá cho mốc quá khứ là giá tại ngày đó (tự động đã lưu hoặc `NavOverride`).

## Ca biên
- **Nguồn vàng lỗi (SJC 403):** cần phương án dự phòng (Backlog); trước mắt nhập tay.
- **Trái phiếu không có giá realtime:** nhập tay giá ước tính, hoặc dùng mệnh giá + lãi dồn tích (để sau).
- **Thiếu giá:** nếu không có cả giá tự động lẫn `NavOverride` cho một mã, NAV mã đó không xác định — UI phải báo rõ, không mặc định 0 (0 làm sai tổng NAV và XIRR).
- **Giá cuối kỳ đã chốt** không tính lại theo giá mới sau này (xem `06-snapshots.md`).

## Ví dụ
- 150 FPT, giá vnstock hôm nay 130k → NAV = 19.500.000, nguồn "Tự động".
- 2 lượng SJC, nhập tay 80.000.000/lượng → NAV = 160.000.000, nguồn "Nhập tay".
