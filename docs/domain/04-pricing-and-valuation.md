# Pricing & Valuation

## Mục đích
Định nghĩa cách xác định giá trị thị trường hiện tại (NAV) của từng vị thế và cả danh mục, từ nguồn tự động hoặc nhập tay.

## Entity / field
- `NavOverride`: `holdingId`, `date`, `price`, `note?` — giá **nhập tay** theo ngày (gắn với một `Holding`).
- `PriceQuote`: `symbol`, `date`, `price`, `source` — giá **tự động** (EOD), job Python ghi từ `vnstock`, app **chỉ đọc**. Dùng chung theo `symbol` (không theo user).

## Quy tắc & bất biến
- **NAV của một vị thế** = `số lượng hiện tại × giá tại thời điểm cần định giá`.
- **Nguồn giá theo loại tài sản:**
  - STOCK, FUND: **tự động** (vnstock), vẫn cho sửa tay khi cần. `FUND` gồm cả ETF niêm yết sàn (nguồn VCI) lẫn quỹ mở không niêm yết (fallback nguồn fmarket khi VCI không có dữ liệu — không phủ hết mọi quỹ mở VN, xem `process/DECISION.md` 2026-07-12); job thử VCI trước rồi mới fallback fmarket, không đoán trước loại quỹ.
  - GOLD, BOND: **mặc định nhập tay** (nguồn tự động kém ổn định).
- **Đơn vị giá theo nguồn (job Python quy đổi về VND thô trước khi ghi `PriceQuote`):** VCI trả **nghìn đồng** (nhân 1000); fmarket trả **VND thô** (không nhân) — 2 nguồn khác đơn vị dù cùng nằm trong thư viện `vnstock`, xem `process/DECISION.md` 2026-07-12.
- **Ưu tiên giá tại ngày D:** lấy `NavOverride` gần nhất ≤ D và `PriceQuote` gần nhất ≤ D (mỗi nguồn lọc độc lập theo D, cho ngày nghỉ/lễ không có giá đúng ngày). Chỉ có 1 trong 2 nguồn → dùng nguồn đó. Có cả 2 → so `date`, nguồn nào **mới hơn** (gần D hơn) thắng; cùng ngày → ưu tiên **NavOverride**. (Đổi ngày 2026-07-14, issue #40 — trước đây NavOverride luôn thắng bất kể ngày, khiến giá nhập tay cũ shadow vĩnh viễn giá tự động mới hơn cho STOCK/FUND.) UI ghi rõ nguồn ("Tự động (vnstock)" / "Nhập tay").
- **Vàng:** dùng **giá mua vào** (giá bạn bán ra được), lưu ý đơn vị chỉ/lượng khớp với `Holding.unit`.
- App TypeScript **chỉ đọc** giá; **không** gọi vnstock trực tiếp.

## Cách tính
- **NAV danh mục** tại một mốc = Σ NAV của mọi `Holding` của user tại mốc đó.
- Giá dùng cho mốc "hôm nay" là giá mới nhất; giá cho mốc quá khứ là giá tại ngày đó (tự động đã lưu hoặc `NavOverride`).

## Cảnh báo tập trung (concentration)
- **Mục đích:** cho biết một mã đang chiếm bao nhiêu % danh mục, để tự nhận ra rủi ro tập trung — thuần hiển thị sự thật, **không phải lời khuyên nên bán bớt** (giữ đúng ranh giới "không tư vấn" của `business-overview.md`).
- **Ngưỡng cảnh báo** lấy từ `Setting{key: CONCENTRATION_WARNING_THRESHOLD}` (resolve `atDate = hôm nay`, không effective-dated theo giao dịch — giống cách resolve `MAX_MEMBERS`, xem `09-settings.md`); seed mặc định **30%**, sửa được trực tiếp trên DB.
- **Phạm vi: theo từng `Holding` riêng lẻ** (không theo `AssetType` nhóm) — sát với rủi ro thực tế nhất (một mã sụp giá ảnh hưởng bao nhiêu tới cả danh mục).
- **Cách tính:** với mỗi `Holding` đang mở (`quantity > 0`) có giá xác định (không `MISSING_PRICE`): `concentrationPercent = NAV(Holding) / NAV(danh mục) × 100`. `concentrationPercent > threshold` → gắn cờ cảnh báo hiển thị cạnh mã đó (badge, không phải modal chặn thao tác).
- **Mẫu số phải là NAV ĐẦY ĐỦ — nếu danh mục còn mã thiếu giá thì TREO cảnh báo (điểm A2):** `NAV(danh mục)` dùng làm mẫu số khi có mã `MISSING_PRICE` chính là **NAV một phần** (`navValueIsPartial = true`, đã có trên dashboard — xem `docs/domain/05-` / `getPortfolioValuation`). Chia cho mẫu số khuyết làm `concentrationPercent` của các mã *có giá* **bị thổi phồng** → báo động giả. Ví dụ: FPT 180tr có giá + một trái phiếu 300tr chưa nhập giá → NAV danh mục hiển thị = 180tr → FPT "chiếm 100%" (sai). **Quy tắc:** khi `navValueIsPartial` (còn ít nhất một mã thiếu giá), **không kết luận cảnh báo tập trung** — ẩn/treo badge kèm ghi chú "cần cập nhật giá các mã còn thiếu để đánh giá tỷ trọng" (giống cách NAV hiện gắn dấu `*`). Chỉ tính/hiển thị cảnh báo khi NAV danh mục đầy đủ (mọi mã đang mở đều có giá).
- **Vị thế thiếu giá (`MISSING_PRICE`) — tử số:** bản thân mã thiếu giá cũng không tính được `concentrationPercent` cho chính nó (không mặc định 0%, không mặc định cảnh báo). Nhưng vấn đề lớn hơn là **mẫu số** ở gạch đầu dòng trên — một mã thiếu giá làm hỏng phép tính cho *mọi* mã khác, nên xử lý ở mức toàn danh mục (treo cảnh báo) chứ không chỉ loại riêng mã đó.
- **Vị thế đóng (`quantity = 0`):** NAV = 0 → không bao giờ bị cảnh báo.
- **Danh mục chỉ có một mã (và mã đó có giá):** `concentrationPercent` = 100% > mọi ngưỡng hợp lý → luôn bị cảnh báo. Đây là kết quả đúng bản chất (rủi ro tập trung thật), không phải lỗi hiển thị.

## Ca biên
- **Nguồn vàng lỗi (SJC 403):** cần phương án dự phòng (Backlog); trước mắt nhập tay.
- **Trái phiếu không có giá realtime:** nhập tay giá ước tính, hoặc dùng mệnh giá + lãi dồn tích (để sau).
- **Thiếu giá:** nếu không có cả giá tự động lẫn `NavOverride` cho một mã, NAV mã đó không xác định — UI phải báo rõ, không mặc định 0 (0 làm sai tổng NAV và XIRR).
- **Giá cũ (staleness):** khi lấy `PriceQuote` gần nhất ≤ D, nếu giá quá cũ (vd mã ngừng cập nhật nhiều ngày/tuần) thì **đánh dấu "giá cũ"** để cảnh báo, không coi như giá hiện tại đáng tin. Ngưỡng cụ thể (số ngày) quyết định khi code Phase 2.
- **Giá cuối kỳ đã chốt** không tính lại theo giá mới sau này (xem `06-snapshots.md`).
- **Vị thế đóng (SL = 0):** NAV = 0 dù có giá hay không → không đóng góp vào tổng NAV (xem `01-assets-and-holdings.md`).
- **Ghi cổ tức tự tạo `NavOverride` bù pha loãng:** ghi cổ tức (cả `CASH` lẫn `STOCK`) có thể tự động ghi thêm một `NavOverride` tại ngày chia để tránh NAV bị thổi phồng/lệch tạm thời — xem `03-dividends.md` mục "Bù pha loãng NAV khi ghi cổ tức" (issue #61).

## Ví dụ
- 150 FPT, giá vnstock hôm nay 130k → NAV = 19.500.000, nguồn "Tự động".
- 2 lượng SJC, nhập tay 80.000.000/lượng → NAV = 160.000.000, nguồn "Nhập tay".
- FPT: nhập tay 130.000/CP ngày 01/07, sau đó vnstock ghi giá tự động ngày 20/07 → từ 20/07 trở đi, NAV dùng giá vnstock (mới hơn), không còn dùng giá nhập tay 01/07 nữa.
- NAV danh mục 500.000.000, riêng FPT NAV 180.000.000 → `concentrationPercent = 36%` > ngưỡng 30% → hiển thị cảnh báo cạnh FPT.
