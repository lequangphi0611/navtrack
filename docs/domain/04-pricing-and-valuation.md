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

## Ca biên
- **Nguồn vàng lỗi (SJC 403):** cần phương án dự phòng (Backlog); trước mắt nhập tay.
- **Trái phiếu không có giá realtime:** nhập tay giá ước tính, hoặc dùng mệnh giá + lãi dồn tích (để sau).
- **Thiếu giá:** nếu không có cả giá tự động lẫn `NavOverride` cho một mã, NAV mã đó không xác định — UI phải báo rõ, không mặc định 0 (0 làm sai tổng NAV và XIRR).
- **Giá cũ (staleness):** khi lấy `PriceQuote` gần nhất ≤ D, nếu giá quá cũ (vd mã ngừng cập nhật nhiều ngày/tuần) thì **đánh dấu "giá cũ"** để cảnh báo, không coi như giá hiện tại đáng tin. Ngưỡng cụ thể (số ngày) quyết định khi code Phase 2.
- **Giá cuối kỳ đã chốt** không tính lại theo giá mới sau này (xem `06-snapshots.md`).
- **Vị thế đóng (SL = 0):** NAV = 0 dù có giá hay không → không đóng góp vào tổng NAV (xem `01-assets-and-holdings.md`).

## Ví dụ
- 150 FPT, giá vnstock hôm nay 130k → NAV = 19.500.000, nguồn "Tự động".
- 2 lượng SJC, nhập tay 80.000.000/lượng → NAV = 160.000.000, nguồn "Nhập tay".
- FPT: nhập tay 130.000/CP ngày 01/07, sau đó vnstock ghi giá tự động ngày 20/07 → từ 20/07 trở đi, NAV dùng giá vnstock (mới hơn), không còn dùng giá nhập tay 01/07 nữa.
