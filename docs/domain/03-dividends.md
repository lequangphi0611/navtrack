# Dividends

## Mục đích
Định nghĩa cách ghi nhận cổ tức tiền mặt và cổ tức cổ phiếu, gồm khấu trừ thuế và ảnh hưởng tới XIRR.

## Entity / field
- `Dividend`: `holdingId`, `type` (`CASH`/`STOCK`), `date`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`, `note?`.
- Tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền.

## Quy tắc & bất biến
- **Cổ tức tiền mặt (`CASH`)** là tiền **nhận về** — dòng tiền **dương** trong XIRR (không phải khoản trừ).
  - App **tự khấu trừ thuế TNCN (~5%)**: lưu `grossAmount` (gộp), `taxAmount` (thuế), `netAmount` (thực nhận).
  - **`netAmount` là dòng tiền dương đưa vào XIRR** (số thực nhận sau thuế).
  - `netAmount = grossAmount − taxAmount`.
- **Cổ tức cổ phiếu (`STOCK`)** **tăng `stockQuantity`** nắm giữ, **không phát sinh tiền** → không phải dòng tiền XIRR. Ảnh hưởng gián tiếp qua NAV tăng do số lượng tăng. Thuế (nếu có) xử lý khi bán — để sau.
- Cổ tức gắn với đúng một `Holding`.

## Cách tính
- Với `CASH`: `netAmount = grossAmount × (1 − taxRateCổTức)`; `taxAmount = grossAmount × taxRateCổTức`.
- Số lượng nắm giữ (xem `01-assets-and-holdings.md`) cộng thêm Σ(dividend STOCK.stockQuantity).

## Ca biên
- **Thuế cổ tức khác thuế bán:** thuế cổ tức tiền mặt lấy từ key `DIVIDEND_TAX_RATE` trong bảng `Setting`, khác key thuế bán `SALE_TAX_<LOẠI>`. Tra theo ngày chia cổ tức (effective dating). Xem `07-tax.md`.
- **Mức 5% cần xác nhận** (điểm còn mở) — là mức phổ biến ở VN nhưng chưa chốt chính thức.
- **Cổ tức của quỹ/vàng/trái phiếu:** mô hình vẫn áp dụng nếu có (vd lãi trái phiếu có thể coi như dòng tiền dương) — nhưng xử lý cụ thể để khi làm Phase liên quan.

## Ví dụ
- FPT trả cổ tức tiền mặt 2.000/cổ phần × 100 cổ phần = gộp 200.000 → thuế 5% = 10.000 → **net 190.000** ghi làm dòng tiền dương ngày chia.
- FPT trả cổ tức cổ phiếu 10% với 100 cổ phần → `stockQuantity = 10`, số lượng nắm giữ thành 110, không có tiền.
