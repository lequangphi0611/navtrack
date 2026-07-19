# Dividends

## Mục đích
Định nghĩa cách ghi nhận cổ tức tiền mặt và cổ tức cổ phiếu, gồm khấu trừ thuế và ảnh hưởng tới XIRR.

## Entity / field
- `Dividend`: `holdingId`, `type` (`CASH`/`STOCK`), `date`, `paymentDate?`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`, `note?`.
- Tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền.
- `paymentDate` (issue #61) — ngày tiền/CP **thực về** tài khoản, có thể trễ vài tuần so với `date` (ngày chia) ngoài thực tế. Optional, user có thể bỏ trống. **Từ 2026-07-19 (issue #65): là mốc dòng tiền XIRR của cổ tức `CASH`** — `buildXirrCashflows` (`lib/xirr-cashflow.ts`) ghép điểm dòng tiền tại `paymentDate ?? date` (fallback `date` khi bỏ trống), vì XIRR quy đổi lợi suất theo thời gian nên phải đặt đúng lúc tiền thực về tay thay vì ngày chia. **KHÔNG** dùng cho `buildQuantityTimeline()` (số lượng nắm giữ) và **KHÔNG** phải mốc ghi `NavOverride` bù pha loãng bên dưới — hai chỗ đó vẫn luôn dùng `date`.

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

## Bù pha loãng NAV khi ghi cổ tức
- **Vấn đề:** `STOCK` dividend tăng `Holding.quantity` **ngay** khi ghi (`recordDividend`), nhưng giá (`PriceQuote`/`NavOverride`, xem `04-pricing-and-valuation.md`) chưa kịp đổi — NAV của vị thế bị **thổi phồng tạm thời** cho tới khi có giá mới (job giá tự động chạy lại, hoặc user tự cập nhật). `CASH` dividend cũng vậy theo hướng ngược lại: tiền rời khỏi vốn công ty (ex-dividend) thường khiến giá cổ phiếu điều chỉnh giảm tương ứng ngay ngày chia trên thị trường thật, nhưng giá lưu trong hệ thống chưa phản ánh kịp.
- **Giải pháp (issue #61):** `recordDividend` **tự tạo/ghi đè** một `NavOverride` bù pha loãng, ghi **tại `date`** (ngày chia — KHÔNG phải `paymentDate`), trừ khi user tick xác nhận giá hiện có đã đúng (`priceAlreadyReflectsMarket`, xem dưới).
  - `STOCK`: giữ nguyên **tổng giá trị** trước/sau — `giá_mới = giá_cũ × SL_trước / SL_sau` (`SL_trước`/`SL_sau` = SL **tại `date`**, trước/sau khi cộng `stockQuantity` vừa ghi — không phải cache `Holding.quantity` hiện tại, có thể lệch nhau khi ghi lùi ngày).
  - `CASH`: trừ cổ tức **gộp** (`grossAmount`, TRƯỚC thuế — tiền rời khỏi vốn công ty, không liên quan thuế TNCN cá nhân của người nắm giữ, KHÔNG dùng `netAmount`) trên mỗi cổ phần khỏi giá cũ — `giá_mới = giá_cũ − grossAmount / SL_tại_ngày_chia`.
  - "Giá cũ" lấy theo đúng rule ưu tiên `NavOverride`/`PriceQuote` gần nhất ≤ `date` đã có (`resolvePrice()`, `04-pricing-and-valuation.md`). Không có giá cũ nào (`MISSING_PRICE`) → bỏ qua, không tạo `NavOverride` (không có gì để điều chỉnh).
- **`priceAlreadyReflectsMarket`** (cờ nhập khi ghi, không lưu vào `Dividend`): user tick khi biết giá hiện có (vd job giá đã chạy lại sau chia tách, hoặc vừa tự cập nhật giá tay) đã đúng thị trường — bỏ qua hoàn toàn bước tự điều chỉnh phía trên.
- **Giá điều chỉnh ra âm/0 (chỉ ca `CASH`):** cổ tức gộp/CP có thể vượt giá cũ khi CP giao dịch dưới mệnh giá kết hợp %cổ tức cao, hoặc nhiều đợt cổ tức liên tiếp cùng holding dồn giá xuống. **Đã chốt** (`process/DECISION.md`, mục 2026-07-17 (3)): xử lý giống `MISSING_PRICE` — `computeCashDividendPriceAdjustment()` trả `null`, bỏ qua tạo `NavOverride`, dividend vẫn ghi thành công. Nhánh `STOCK` không có ca biên này — `computeStockDividendPriceAdjustment()` là phép nhân với tỷ lệ SL_trước/SL_sau luôn dương nên giá_mới luôn dương (trừ khi giá_cũ vốn đã hỏng sẵn, ngoài phạm vi).
- Ghi cổ tức **không** tự trigger `Snapshot` (khác mua/bán, luôn tự đóng `Snapshot{period: MANUAL}` — `06-snapshots.md`). **Đã chốt** (`process/DECISION.md`, mục 2026-07-17 (2)): cơ chế bù pha loãng NAV ở trên vốn được thiết kế để giữ NAV gần như liên tục qua sự kiện chia cổ tức (không như mua/bán — nơi NAV thực sự đổi vì tiền vào/ra) → một Snapshot đóng ngay sau ghi cổ tức gần như trùng số với mốc gần nhất, không thêm thông tin, chỉ gây nhiễu lịch sử "Các mốc đã chốt".

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
