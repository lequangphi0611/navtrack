# Domain specs — Navtrack

Đặc tả **luật nghiệp vụ chính xác** của Navtrack: entity, quy tắc, bất biến, công thức và ca biên. Khai triển chi tiết từ [`business-overview.md`](../business-overview.md); dùng chung mô hình dữ liệu ở [`02-data-model.md`](../02-data-model.md).

Mỗi file theo cùng bố cục: **Mục đích · Entity/field · Quy tắc & bất biến · Cách tính · Ca biên · Ví dụ.**

| # | Domain | Nội dung chính |
|---|---|---|
| 01 | [Assets & Holdings](./01-assets-and-holdings.md) | 4 loại tài sản, một bảng `Holding`, đơn vị, mã |
| 02 | [Transactions & Cost basis](./02-transactions-and-cost-basis.md) | Mua/bán, dấu dòng tiền, bình quân gia quyền, vị thế mở |
| 03 | [Dividends](./03-dividends.md) | Cổ tức tiền mặt (thuế 5%, net vào XIRR), cổ phiếu (tăng SL) |
| 04 | [Pricing & Valuation](./04-pricing-and-valuation.md) | NAV, nguồn giá tự động (vnstock) / nhập tay (`NavOverride`) |
| 05 | [Returns: XIRR & P&L](./05-returns-xirr-and-pnl.md) | XIRR theo năm, dòng tiền giả định, lãi/lỗ tuyệt đối |
| 06 | [Snapshots](./06-snapshots.md) | Đóng băng tháng/năm, thủ công, tổng danh mục |
| 07 | [Tax](./07-tax.md) | Thuế bán ~0.1%, thuế cổ tức ~5%, lãi/lỗ sau thuế |
| 08 | [Users, Access & Privacy](./08-users-access-and-privacy.md) | Chỉ người mời, tách dữ liệu, ẩn số tiền |
| 09 | [Settings (master config)](./09-settings.md) | Bảng cấu hình key-value, effective dating, cập nhật trực tiếp trên DB |

## Nguyên tắc xuyên suốt

- **Đúng về tiền:** mọi số tiền là `Decimal`, không dùng float (xem `rules/data-prisma.md`).
- **Tách dữ liệu theo user:** mọi entity dữ liệu thuộc về đúng một user; mọi truy vấn giới hạn theo user đăng nhập.
- **Hai chỉ số song song:** hiệu quả đo bằng **XIRR (theo năm)** và **lãi/lỗ tuyệt đối**; đừng lẫn hai cái.
- **Điểm còn mở:** mức thuế cụ thể (bán ~0.1%, cổ tức ~5%) và nguồn giá vàng dự phòng — cần xác nhận trước khi code phần liên quan.
