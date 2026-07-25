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
- **Mẫu số phải là NAV ĐẦY ĐỦ khi mã thiếu giá là trọng yếu (điểm A2, thu hẹp phạm vi ở quyết định 2026-07-21 — xem mục "Materiality" dưới):** `NAV(danh mục)` dùng làm mẫu số khi có mã `MISSING_PRICE` chính là **NAV một phần** (`navValueIsPartial = true`, đã có trên dashboard — xem `docs/domain/05-` / `getPortfolioValuation`). Chia cho mẫu số khuyết làm `concentrationPercent` của các mã *có giá* **bị thổi phồng** → báo động giả. Ví dụ: FPT 180tr có giá + một trái phiếu 300tr chưa nhập giá → NAV danh mục hiển thị = 180tr → FPT "chiếm 100%" (sai). Nguyên tắc gốc: khi `navValueIsPartial`, **không kết luận cảnh báo tập trung trên mẫu số khuyết**. Từ 2026-07-21, quy tắc này chỉ áp dụng **toàn danh mục** khi phần thiếu giá đủ trọng yếu (`missingPriceShare > 5%`) — xem mục "Materiality" ngay dưới để biết cách xử lý khi không trọng yếu.
- **Vị thế thiếu giá (`MISSING_PRICE`) — tử số:** bản thân mã thiếu giá cũng không tính được `concentrationPercent` cho chính nó (không mặc định 0%, không mặc định cảnh báo).
- **Vị thế đóng (`quantity = 0`):** NAV = 0 → không bao giờ bị cảnh báo.
- **Danh mục chỉ có một mã (và mã đó có giá):** `concentrationPercent` = 100% > mọi ngưỡng hợp lý → luôn bị cảnh báo. Đây là kết quả đúng bản chất (rủi ro tập trung thật), không phải lỗi hiển thị.

### Materiality khi có `MISSING_PRICE` (quyết định 2026-07-21, thu hẹp phạm vi rule A2 ở trên)
- **Vấn đề với rule A2 gốc:** treo cảnh báo cho *toàn danh mục* chỉ vì một mã bất kỳ thiếu giá là quá bảo thủ — một mã thiếu giá chiếm 0.5% NAV không nên làm mất cảnh báo của một mã khác đang thật sự chiếm 45%.
- **Đo mức ảnh hưởng (materiality) bằng cost basis, không phải NAV:** mã `MISSING_PRICE` không có giá thị trường nên không thể ước lượng NAV của chính nó — dùng `totalCostBasis` (vốn đã bỏ vào, luôn xác định từ lịch sử giao dịch bất kể có giá hay không) làm proxy ước lượng mức ảnh hưởng. **Chỉ dùng cho mục đích quyết định ẩn/hiện cảnh báo — không hiển thị như một NAV chính thức ở bất kỳ đâu khác** (không vi phạm nguyên tắc "thiếu giá không mặc định 0/không suy diễn NAV").
- **Công thức:** `missingPriceShare = Σ totalCostBasis(Holding MISSING_PRICE) / (Σ NAV(Holding có giá) + Σ totalCostBasis(Holding MISSING_PRICE))`.
  - `missingPriceShare ≤ 5%` → **không treo toàn danh mục**: vẫn tính & hiện badge cảnh báo bình thường cho các `Holding` có giá, dùng mẫu số `NAV(danh mục)` = tổng NAV các `Holding` có giá (loại phần thiếu giá ra khỏi mẫu số); kèm ghi chú nhỏ dạng "NAV danh mục đang thiếu dữ liệu ước tính ~X% (N mã chưa có giá)" ở gần khu vực cảnh báo.
  - `missingPriceShare > 5%` → **treo cảnh báo toàn danh mục** (áp dụng rule A2 gốc — mẫu số khuyết quá nhiều để kết luận).
  - `5%` là hằng số cố định trong code, **không phải `Setting`** — đây là tham số chống nhiễu hiển thị, không phải lựa chọn khẩu vị rủi ro của user (khác `CONCENTRATION_WARNING_THRESHOLD`).

### Ghi chú "tập trung tự nhiên do ít mã" (quyết định 2026-07-21)
- **Vấn đề:** với danh mục có `n` `Holding` đang mở, nếu chia đều tuyệt đối thì mỗi mã đã chiếm `100/n`%. Khi `100/n > threshold` (vd `n = 3` và `threshold = 30%` → sàn 33.3% > 30%), **bất kỳ** cách phân bổ nào — kể cả chia đều hoàn hảo — cũng kích badge cảnh báo. Badge trần trụi trong ca này dễ khiến user hiểu nhầm "chọn lệch" trong khi thực chất chỉ là hệ quả toán học của việc có ít mã.
- **Cách nhận biết (tự tính, không hard-code số mã cố định):** gọi `n` = số `Holding` đang mở tham gia được vào mẫu số cảnh báo (có giá xác định). Nếu `100 / n > threshold` → mọi badge cảnh báo trong danh mục đó kèm thêm ghi chú ngữ cảnh, vd: "Danh mục có {n} mã — nếu chia đều mỗi mã cũng đã chiếm {100/n}%, cao hơn ngưỡng {threshold}%. Một phần cảnh báo dưới đây là tập trung tự nhiên do ít mã." Nếu `100/n ≤ threshold`, mã nào vượt ngưỡng là do phân bổ lệch thật — hiện badge bình thường, không kèm ghi chú.

### Hysteresis chống nhấp nháy quanh ngưỡng (quyết định 2026-07-21)
- **Vấn đề:** `concentrationPercent` dao động sát ngưỡng (vd 29.5% ↔ 30.5%) qua mỗi lần định giá lại sẽ làm badge bật/tắt liên tục, gây nhiễu hơn là cảnh báo hữu ích.
- **Quy tắc:** badge **bật** khi `concentrationPercent > threshold`. Một khi đã bật, badge **giữ nguyên bật** (không tắt ngay) miễn là `concentrationPercent > threshold − 3` (buffer 3 điểm %); chỉ **tắt** khi `concentrationPercent ≤ threshold − 3`.
- **Cần trạng thái trước đó:** khác các quy tắc khác trong mục này (tính thuần từ dữ liệu hiện tại mỗi lần render), hysteresis đòi hỏi biết badge có đang bật ở lần tính gần nhất hay không — cần một cơ chế lưu trạng thái cảnh báo per-`Holding` giữa các lần tính. Cách lưu cụ thể (field mới trên `Holding`, hay nguồn khác) là quyết định kỹ thuật của `business-implementer` lúc code — không chốt schema ở đây.

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
