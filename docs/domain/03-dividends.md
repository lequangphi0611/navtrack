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
- Người dùng nhập **tỷ lệ % cổ tức** (`percent`, so với mệnh giá) + ngày chia — Server Action tự tính số tiền/số lượng, `Dividend` **không lưu `percent` trực tiếp** (chỉ lưu kết quả đã tính). Khi hiển thị lịch sử, `percentLabel` được **suy ngược** từ dữ liệu đã lưu (xem "Hiển thị lịch sử" bên dưới).
- Với `CASH`:
  - `parValue` = mệnh giá tại ngày chia, resolve từ key `DIVIDEND_PAR_VALUE` trong `Setting` (effective-dated, xem `09-settings.md`).
  - `grossAmount = parValue × percent/100 × SL đang giữ tại ngày chia`.
  - `taxAmount = grossAmount × taxRateCổTức`; `netAmount = grossAmount − taxAmount = grossAmount × (1 − taxRateCổTức)`.
- Với `STOCK`: `stockQuantity = SL đang giữ tại ngày chia × percent/100`. `stockQuantity` làm tròn xuống (floor) — cổ phiếu không chia lẻ. Giá trị trước làm tròn giữ lại làm mốc so sánh khi user tự chỉnh.
- **"SL đang giữ tại ngày chia"** không phải `Holding.quantity` cache hiện tại (luôn phản ánh HÔM NAY) — phải phát lại lịch sử `Cashflow` (BUY/SELL) **và** `Dividend{type: STOCK}` đã ghi trước đó tính đến đúng ngày chia (`lib/position-trail.ts::buildQuantityTimeline`, chuyển từ `features/dividends/` ra dùng chung khi `features/holdings/` cũng cần — xem issue #59), vì ghi cổ tức có thể lùi ngày so với giao dịch gần nhất.
- **`avgCost` giữ nguyên khi nhận cổ tức cổ phiếu** — chỉ `Holding.quantity` tăng thêm `stockQuantity` (cộng thẳng vào cache hiện có trong cùng transaction, không replay lại toàn bộ lịch sử); giá vốn/CP giảm tương ứng một cách tự nhiên vì cùng tổng vốn chia cho nhiều CP hơn (không cần công thức riêng).
- Số lượng nắm giữ (xem `01-assets-and-holdings.md`) cộng thêm Σ(dividend STOCK.stockQuantity).

## Hiển thị lịch sử
- Vì `Dividend` không lưu `percent`, màn lịch sử suy ngược:
  - `CASH`: `percentLabel = round(grossAmount / (SL trước đó × parValue tại ngày đó) × 100)`.
  - `STOCK`: `percentLabel = round(stockQuantity / SL trước đó × 100)`.
- `SL trước đó`/`SL sau` của từng dòng lấy từ cùng `buildQuantityTimeline()` phát lại trên toàn bộ `Cashflow` + `Dividend` thật của Holding đó (không suy từ cache hiện tại).

## Ca biên
- **Thuế cổ tức khác thuế bán:** thuế cổ tức tiền mặt lấy từ key `DIVIDEND_TAX_RATE` trong bảng `Setting`, khác key thuế bán `SALE_TAX_<LOẠI>`. Tra theo ngày chia cổ tức (effective dating). Xem `07-tax.md`.
- **Mức 5% đã seed chính thức** (`prisma/seed.ts`, `DIVIDEND_TAX_RATE = "5"` từ 2020-01-01) — vẫn resolve qua `Setting` như mọi giá trị effective-dated khác (đổi mức thuế về sau chỉ cần thêm dòng `Setting` mới, không sửa code).
- **Mệnh giá cũng là `Setting`** (`DIVIDEND_PAR_VALUE`, mặc định `10000` đ/CP từ 2020-01-01) — không hard-code trong code, resolve theo ngày chia giống thuế.
- **Cổ tức của quỹ/vàng/trái phiếu:** mô hình vẫn áp dụng nếu có (vd lãi trái phiếu có thể coi như dòng tiền dương) — nhưng xử lý cụ thể để khi làm Phase liên quan.
- **Làm tròn cổ tức cổ phiếu:** hệ thống làm tròn xuống theo công thức tuyến tính, nhưng công ty phát hành có thể áp quy ước làm tròn khác (VD theo lô) → cho phép user tự sửa `stockQuantity` khi ghi, validate sai lệch tối đa **2 đơn vị** so với số tính từ % (`STOCK_DIVIDEND_ROUNDING_TOLERANCE`), để bắt lỗi gõ nhầm mà vẫn linh hoạt với sai số làm tròn thực tế.

## Ví dụ
- FPT trả cổ tức tiền mặt 2.000/cổ phần × 100 cổ phần = gộp 200.000 → thuế 5% = 10.000 → **net 190.000** ghi làm dòng tiền dương ngày chia.
- FPT trả cổ tức cổ phiếu 10% với 100 cổ phần → `stockQuantity = 10`, số lượng nắm giữ thành 110, không có tiền.
