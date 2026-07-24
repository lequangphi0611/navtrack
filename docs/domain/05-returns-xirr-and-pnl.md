# Returns: XIRR & P&L

## Mục đích
Định nghĩa hai chỉ số đo hiệu quả đầu tư: **XIRR (tỷ suất theo năm)** và **lãi/lỗ tuyệt đối**, cùng cách xử lý ca "chưa bán".

## Entity / field
- Không có bảng riêng — tính từ `Cashflow` (dòng tiền thật), `Dividend` (net cash), và NAV hiện tại (xem `04-pricing-and-valuation.md`).

## Quy tắc & bất biến
- **XIRR luôn là tỷ suất quy đổi theo năm (annualized)**, dù kỳ đầu tư dài hay ngắn. **Bắt buộc gắn nhãn "theo năm"** để tránh hiểu nhầm (vd 3 tháng lời 2% có thể annualize ra >8%).
- XIRR cần **ít nhất một dòng tiền âm và một dòng tiền dương** mới tính được.
- **Chưa bán vẫn tính được:** ghép thêm **một dòng tiền dương giả định = NAV hiện tại** vào cuối chuỗi khi tính.
  - Dòng tiền giả định **không lưu DB** — chỉ ghép runtime lúc tính, để không làm bẩn lịch sử giao dịch.
  - Mốc chốt chọn được: **hôm nay / cuối tháng / cuối năm / tùy chỉnh**; mỗi mốc → NAV khác → XIRR khác.
- **Vị thế đã đóng (bán hết, SL = 0):** XIRR là **"chốt" — KHÔNG ghép NAV giả định** (NAV = 0), vì dòng tiền bán cuối là dòng tiền dương thật đã đủ cho công thức. Kết quả không còn phụ thuộc giá thị trường. Vị thế đóng **vẫn tính vào XIRR & lãi/lỗ toàn danh mục**.
- **"Không tính được" là kết quả nghiệp vụ, KHÔNG phải lỗi** — trả status rõ ràng (`NO_POSITIVE_FLOW`, `NO_CONVERGE`), **không âm thầm trả -100%** hay `NaN` (xem `rules/error-handling.md`).
- Hiển thị **song song hai chỉ số**, không lẫn lộn.
- **Lãi/lỗ tuyệt đối đi kèm một dòng phụ "chi phí ăn mòn"** (tổng thuế + phí luỹ kế, % trên `grossInvested` = vốn gộp đã triển khai `Σ|BUY.amount|`, **không** phải `totalInvested` vốn ròng) — xem công thức và ví dụ ở `07-tax.md` mục "Chi phí ăn mòn".
- **Lãi/lỗ tuyệt đối tách thành "đã chốt" (realized) và "trên giấy" (unrealized)** (issue #67): `realizedPnl` = phần đã bán thật + cổ tức tiền mặt; `unrealizedPnl` = phần lãi/lỗ của vị thế đang mở nếu bán ngay bây giờ theo giá thị trường. **Bất biến toán học: `realizedPnl + unrealizedPnl = absolutePnl` ĐÚNG TUYỆT ĐỐI (không xấp xỉ)** khi mốc chốt = hôm nay và không có holding nào thiếu giá — phương pháp giá vốn bình quân di động (`avgCost`) đảm bảo tổng vốn gốc trừ ra ở mỗi lần bán cộng với vốn gốc còn lại trong vị thế đang giữ luôn bằng đúng tổng tiền đã bỏ ra mua (`Σ|BUY.amount|`). `unrealizedPnl` dùng `quantity`/`avgCost` HIỆN TẠI (không phải tại mốc chốt) — cùng giới hạn cutoff-accuracy có sẵn của NAV trong file này khi mốc chốt khác hôm nay.
- **`realizedPnl`/`avgCost` (write-path) track đúng số lượng thực nắm giữ kể cả khi có cổ tức cổ phiếu** (issue #83 code review #1, sửa lần 2 — `process/DECISION.md` sau `2026-07-24 (2)`): cổ tức cổ phiếu không tạo `Cashflow` (cộng thẳng vào `Holding.quantity`, xem `01-assets-and-holdings.md`), nên khi phát lại lịch sử để tính `avgCost`/lãi-lỗ chốt phải dùng **một bộ đếm `realQuantity` duy nhất** gồm CẢ `Cashflow` lẫn cổ tức cổ phiếu để biết đúng lúc một vị thế THỰC SỰ đóng hết (kể cả phần số lượng đến từ cổ tức). `avgCost` chỉ đổi ở sự kiện BUY, dùng `realQuantity` NGAY TRƯỚC sự kiện đó (không phải một bộ đếm chỉ-`Cashflow` riêng) làm cơ sở bình quân di động: `newAvgCost = (realQuantityTrước×avgCostCũ + tiềnMua) / (realQuantityTrước+SLMua)`. Khi vị thế đóng hết thật (`realQuantityTrước = 0`), số hạng `0×avgCostCũ = 0` **tự "quên" avgCost cũ — không cần bước reset tường minh nào nữa**, đúng cho CẢ ca đóng hết vị thế lẫn ca bán một phần (không đóng hết) rồi mua tiếp (thiết kế "2 bộ đếm song song + reset tường minh" trước đó chỉ đúng cho ca đóng hết, sai ở ca bán một phần). **`avgCost` vẫn CHỈ đổi bởi BUY, KHÔNG đổi bởi cổ tức cổ phiếu** — giữ nguyên quy tắc domain (xem `lib/cost-basis.ts::derivePosition`, `lib/realized-pnl.ts::computeRealizedGainForHolding`).
- **`pnlSplitIsApproximate`** (issue #83 code review #2): cờ `true` khi mốc chốt (cutoff) KHÁC "hôm nay" — vì `unrealizedPnl` luôn dùng `quantity`/`avgCost` HIỆN TẠI (không phải tại mốc chốt, giới hạn cutoff-accuracy đã biết ở trên), nên khi xem theo một mốc chốt khác hôm nay, hai số "đã chốt"/"chưa chốt" có thể không cộng khớp tuyệt đối với `absolutePnl` tại đúng mốc đó — UI dùng cờ này để hiện ghi chú "ước tính" thay vì coi là bug.

## Cách tính
- **Chuỗi dòng tiền cho XIRR** = các `Cashflow.amount` (đã mang dấu, tại `date`) + các `Dividend.netAmount` (dương, tại `paymentDate ?? date` — mốc tiền thực về tay, fallback `date` khi `paymentDate` bỏ trống; quyết định 2026-07-19 #65, đảo một phần quyết định #61 trước đó vốn coi `paymentDate` thuần hiển thị) + dòng tiền giả định NAV tại mốc chốt (dương). Đặt cổ tức tại `date` (ngày chia) thay vì `paymentDate` sẽ đưa dòng tiền dương vào chuỗi sớm hơn thực tế, thổi nhẹ XIRR — rõ nhất với coupon trái phiếu (Phase 7/8) khi khoảng trễ chia→trả có thể vài tuần.
- **XIRR** = nghiệm r của: Σ [ CFᵢ / (1+r)^((dateᵢ − date₀)/365) ] = 0. Giải bằng Newton-Raphson + bisection dự phòng (xem `rules/tooling.md` / lớp bọc XIRR).
- **Lãi/lỗ tuyệt đối trong kỳ** = giá trị cuối kỳ (NAV tại mốc) − tổng vốn ròng đã bỏ vào.
  - Tổng vốn ròng = Σ tiền ra (mua) − Σ tiền vào đã rút (bán + cổ tức) trước mốc.
- **`realizedPnl`** (issue #67) = Σ, qua từng holding, lãi/lỗ mỗi lần bán = `SELL.amount − quantity_bán × avgCost_tại_thời_điểm_bán` (avgCost phát lại theo bình quân di động, cùng công thức `derivePosition()`), cộng thêm Σ `Dividend{CASH}.netAmount`.
- **`unrealizedPnl`** (issue #67) = Σ, qua các vị thế đang mở định giá được, `(NAV hiện tại − vốn còn lại trong vị thế)`.

## Ca biên
- **Toàn dòng tiền âm** (chỉ mua, chưa có NAV/bán): không ghép NAV thì XIRR lỗi → phải có NAV giả định; nếu NAV không xác định (thiếu giá) thì trả "không tính được".
- **Kỳ rất ngắn:** annualize khuếch đại; vẫn hiển thị nhưng nhãn "theo năm" bắt buộc, cân nhắc chú thích kỳ ngắn.
- **Mốc đã qua (cuối tháng/năm):** dùng NAV **đã đóng băng** trong snapshot, không tính lại theo giá mới (xem `06-snapshots.md`).
- **Nhiều dòng tiền cùng ngày:** hợp lệ, không ảnh hưởng nghiệm.

## Ví dụ
- Bỏ 100tr ngày 2023-01-01, NAV hôm nay 112tr, chưa bán → chuỗi `[-100tr(2023-01-01), +112tr(hôm nay)]` → XIRR ≈ 12%/năm; lãi tuyệt đối = +12tr.
- Chỉ mới mua, chưa có giá thị trường → NAV không xác định → **"Chưa tính được XIRR"** (không phải −100%).
