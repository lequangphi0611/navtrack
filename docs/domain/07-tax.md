# Tax

## Mục đích
Định nghĩa cách app tự tính và trừ thuế **+ phí giao dịch**, để lãi/lỗ hiển thị là số **thực nhận** chứ không phải số trên giấy.

## Entity / field
- **`Setting`** (bảng master cấu hình, effective dating) giữ mọi thuế suất: `SALE_TAX_<LOẠI>` (thuế bán theo loại), `DIVIDEND_TAX_RATE` (thuế cổ tức) — và mọi mức phí giao dịch: `TRANSACTION_FEE_BUY_<LOẠI>`/`TRANSACTION_FEE_SELL_<LOẠI>` (xem mục "Phí giao dịch" bên dưới). Thay cho `TaxRule` cũ.
- Thuế **đã tính** lưu trên chính giao dịch: `Cashflow.taxAmount` (khi bán), `Dividend.taxAmount` (cổ tức) — xem `02-` và `03-`.

## Quy tắc & bất biến
- **Thuế suất tra từ `Setting` theo NGÀY giao dịch** (effective dating): dùng dòng có `effectiveFrom` lớn nhất mà `<=` ngày giao dịch. Nhờ vậy giao dịch lùi ngày áp đúng thuế suất thời điểm đó.
- **Thuế khi bán** tự áp khi ghi SELL: `taxAmount = giá trị bán × (SALE_TAX_<loại> tại ngày bán)`. Cổ phiếu VN thường ~**0.1%** trên giá trị bán.
  - `amount` (dòng tiền vào) của SELL đã **trừ thuế**: `= (quantity × price) − fee − tax`.
  - **Form chỉ prefill, KHÔNG khoá field:** giá trị tự tính hiển thị làm mặc định trên form ghi SELL, nhưng người dùng **sửa tay được** — để khớp đúng số thực trừ trên sao kê công ty chứng khoán (làm tròn/quy ước riêng từng sàn có thể lệch vài đồng so với công thức chuẩn). Cùng tinh thần với `NavOverride` (`04-pricing-and-valuation.md`): giá trị tự động là gợi ý, không phải khoá cứng.
- **Thuế khi mua: KHÔNG có.** VN không đánh thuế TNCN khi mua chứng khoán/CCQ — form ghi BUY **không có field thuế**, `Cashflow.taxAmount` luôn `= 0` cho `type = BUY`.
- **Thuế cổ tức tiền mặt** = `DIVIDEND_TAX_RATE` (~**5%**) khấu trừ khi ghi cổ tức; dòng tiền dương vào XIRR = số thực nhận sau thuế.
- **Đóng băng tại thời điểm ghi:** thuế đã tính lưu trên giao dịch (`taxAmount`) nên đổi `Setting` sau này **không** hồi tố bản ghi cũ.
- **Cấu hình được, không hard-code:** mọi thuế suất trong `Setting`, **sửa trực tiếp trên DB** (không có UI admin — xem `09-settings.md`), có audit (`updatedBy`/`updatedAt`).
- Lãi/lỗ hiển thị là **sau thuế** — cụ thể là **sau cả thuế lẫn phí** (số thực nhận), nhãn UI nên nói rõ "thực nhận" để tránh hiểu nhầm phí chưa bị trừ.

## Cách tính
- **Lãi/lỗ sau thuế (một lần bán)** = `(giá bán − giá vốn bình quân) × SL bán − phí − thuế bán`.
- Vì thuế đã nằm trong `Cashflow.amount` và `Dividend.netAmount`, **XIRR tự phản ánh sau thuế** mà không cần xử lý thêm.

## Phí giao dịch (mua & bán) — mới, bổ sung requirement Phase 5
- **`Setting` giữ mọi mức phí theo CHIỀU và LOẠI tài sản:** `TRANSACTION_FEE_BUY_<LOẠI>` / `TRANSACTION_FEE_SELL_<LOẠI>` (4 loại `STOCK`/`FUND`/`BOND`/`GOLD` × 2 chiều = 8 key), group `FEE`, effective-dated theo **ngày giao dịch** — cùng cơ chế `resolveSetting()`/`resolveDecimalSetting()` đã dùng cho thuế (xem `09-settings.md`).
- **Khác thuế ở chỗ áp dụng cho CẢ BUY lẫn SELL** (thuế chỉ áp SELL, xem trên): `feeAmount` tự tính = `giá trị giao dịch (quantity × pricePerUnit) × (TRANSACTION_FEE_<chiều>_<loại> tại ngày giao dịch)`, prefill vào form ghi giao dịch. Lý do phí áp cả 2 chiều: đây là biểu phí công ty chứng khoán (CTCK) thu trên mỗi lệnh khớp, không phải thuế TNCN (chỉ luật mới miễn thuế mua).
- **Form chỉ prefill, KHÔNG khoá field** — cùng tinh thần với thuế: giá trị tự tính hiển thị làm mặc định, người dùng **sửa tay được** để khớp đúng phí thực trên sao kê CTCK (biểu phí thực tế có thể có mức tối thiểu/luỹ tiến mà công thức `% phẳng` đơn giản chưa mô phỏng hết).
- **Mức phí phụ thuộc CTCK người dùng chọn, không phải luật** (khác thuế — thuế do nhà nước quy định, phí do broker quy định) — vẫn tách riêng theo `AssetType` vì thực tế mỗi loại tài sản giao dịch qua kênh khác nhau: STOCK/FUND qua CTCK có biểu phí rõ (vd TPS ~0.3%); BOND/GOLD hiện người dùng không giao dịch qua kênh tính phí % (trái phiếu giữ tới đáo hạn, vàng mua vật lý) — seed `0` cho các loại chưa dùng, **không được để thiếu dòng** (nguyên tắc "thiếu cấu hình → báo lỗi" áp dụng như thuế, xem `09-settings.md`).
- **Đóng băng tại thời điểm ghi:** phí đã tính lưu trên `Cashflow.feeAmount` — đổi `Setting` sau này **không** hồi tố giao dịch cũ (giống thuế).
- **Giá vốn bình quân (`avgCost`) nay gồm cả phí mua** (đóng issue #66, điểm mở ghi ở `process/DECISION.md` 2026-07-17 (7)) — công thức đã cập nhật ở `02-transactions-and-cost-basis.md` mục "Cách tính". Phí bán **không** gộp vào giá vốn (chỉ trừ vào tiền nhận khi bán, xem `amount` của SELL ở trên) — tránh trừ phí bán 2 lần.

## Chi phí ăn mòn (cost drag) — tổng thuế + phí luỹ kế
- **Mục đích:** trả lời câu hỏi Sheet cũ không trả lời được — "tổng cộng tôi đã mất bao nhiêu tiền cho thuế/phí giao dịch, và con số đó chiếm bao nhiêu % số vốn tôi bỏ ra" (xem `docs/business-overview.md` mục "Bài toán"). Hiển thị như một dòng phụ nhỏ dưới card lãi/lỗ trên dashboard (`ReturnMetrics`), không phải một card riêng.
- **Phạm vi cộng dồn — gồm cả ba nguồn đã có sẵn dữ liệu**, tính tới cùng mốc chốt (`cutoffDate`) đang chọn trên dashboard:
  - `Σ Cashflow.taxAmount` — thuế bán (Phase 5; luôn `0` cho BUY).
  - `Σ Cashflow.feeAmount` — phí giao dịch (BUY + SELL, đã có từ Phase 1).
  - `Σ Dividend.taxAmount` — thuế cổ tức tiền mặt (Phase 4; `null`/không áp dụng cho cổ tức cổ phiếu, coi như `0`).
- **Công thức:**
  ```
  costDragAmount  = Σ Cashflow.taxAmount + Σ Cashflow.feeAmount + Σ Dividend.taxAmount
  costDragPercent = costDragAmount / grossInvested × 100
  ```
  - `grossInvested` = **vốn gộp đã triển khai** = `Σ |Cashflow.amount|` trên các dòng `type = BUY` (tổng tiền mặt đã chi ra để mua, đã gồm phí mua), tính tới `cutoffDate`. **KHÔNG dùng `totalInvested` (vốn ròng)** — vốn ròng đã bị phần đã bán/cổ tức rút bớt, nên khi bán nhiều mẫu số co lại (thậm chí âm khi bán sạch) làm `costDragPercent` phình vô lý, dù chi phí thật không đổi. Chi phí ăn mòn là chi phí tích luỹ trên **hoạt động giao dịch**, nên mẫu số phải là vốn đã *rót vào để mua* (chỉ đi lên), không phải vốn *còn lại*. Quyết định 2026-07-17 (6), sửa từ mẫu số `totalInvested` sai ban đầu — xem `process/DECISION.md`.
  - `grossInvested = 0` (chưa có lệnh mua nào) → `costDragPercent = 0`, không chia cho 0.
- **Không phải một chỉ số hiệu suất riêng** — chỉ là phần diễn giải thêm cho lãi/lỗ, không đưa vào XIRR (XIRR đã tự phản ánh chi phí này qua dòng tiền thực, xem trên).
- **UI (đã chốt 2026-07-18, theo mockup `Phase 5 Screens.dc.html` 5d/5e):** dòng phụ dưới card lãi/lỗ **bấm được** để mở một sheet chi tiết, breakdown đúng 3 nguồn đã liệt kê ở trên (phí giao dịch / thuế bán / thuế cổ tức) kèm % đóng góp của từng nguồn trong tổng `costDragAmount` (khác với `costDragPercent` — % trên `grossInvested`). Sheet chỉ là một cách trình bày khác của cùng 3 con số đã tính, không cần field/hàm tổng hợp mới ngoài phần đã có. Xem `process/DECISION.md` 2026-07-18, `process/UI_phase_5.md`.

## Ca biên
- **Mức thuế cổ phiếu/quỹ:** 0.1% (bán) và 5% (cổ tức) là mức phổ biến VN — dùng làm mặc định seed cho `SALE_TAX_STOCK`/`SALE_TAX_FUND`/`DIVIDEND_TAX_RATE`.
- **`SALE_TAX_GOLD` = 0 (đã chốt, 2026-07-17):** cá nhân bán vàng miếng/trang sức tại VN không chịu thuế TNCN chuyển nhượng (khác chứng khoán) — seed `Setting` với giá trị `0`, KHÔNG được để trống/thiếu dòng (vẫn phải seed tường minh, vì "thiếu cấu hình" báo lỗi cứng — xem `09-settings.md`).
- **`SALE_TAX_BOND` = 0.1% (đã chốt, 2026-07-18):** theo Nghị định 253/2026/NĐ-CP + Thông tư 87/2026/TT-BTC (hiệu lực 01/07/2026), chuyển nhượng trái phiếu chịu thuế TNCN 0.1% trên giá chuyển nhượng — cùng mức và công thức với cổ phiếu/chứng chỉ quỹ. Xem `process/DECISION.md` 2026-07-18 (5).
- **Việc bán/đáo hạn trái phiếu (điểm còn mở, cố ý để ngỏ tới Phase 7):** mô hình thuế-khi-bán hiện áp dụng chung cho mọi `Cashflow{type: SELL}` bất kể loại tài sản, dùng mức `SALE_TAX_BOND` ở trên. Về bản chất, **chuyển nhượng trái phiếu trước hạn** trên thị trường thứ cấp mới chịu thuế CK 0.1%; **đáo hạn nhận lại gốc** từ tổ chức phát hành không phải một giao dịch chuyển nhượng nên **không** thuộc diện chịu thuế này. Navtrack hiện chưa có cách ghi nhận riêng "đáo hạn" (chỉ có SELL chung) — nếu ghi đáo hạn bằng một dòng SELL bình thường, Phase 5 sẽ tính nhầm 0.1% trên toàn bộ mệnh giá hoàn trả. Quyết định (2026-07-17): **chưa xử lý ở Phase 5** — người dùng hiện tại chỉ giữ trái phiếu tới đáo hạn, không bán thứ cấp; bàn kỹ lại khi làm Phase 7 (trái tức), xem `docs/domain/03-dividends.md`/`process/phase-7.md`.
- **Thuế theo loại tài sản khác nhau:** mỗi loại một key `SALE_TAX_<LOẠI>` (đặt 0 nếu không áp, như `GOLD`).
- **Đổi chính sách giữa chừng:** thêm dòng `Setting` mới cùng `key`, `effectiveFrom` = ngày hiệu lực mới — không sửa dòng cũ (giữ lịch sử).
- **Giao dịch trước mọi mốc effectiveFrom:** nếu không có dòng nào `effectiveFrom <= ngày` → coi là thiếu cấu hình, báo rõ (không mặc định 0 âm thầm).
- **Lỗ khi bán:** vẫn có thể phát sinh thuế trên *giá trị bán* (không phải trên lãi) — mô hình `giá trị bán × ratePercent` phản ánh đúng cách VN đánh thuế cổ phiếu (trên giá trị giao dịch, không trên lãi). UI nên nói rõ điều này (vd chú thích khi lãi/lỗ âm mà vẫn có `taxAmount` > 0) để người dùng không tưởng nhầm là app tính sai.
- **Mức phí theo loại tài sản khác nhau (mới):** mỗi loại × mỗi chiều một key `TRANSACTION_FEE_<chiều>_<LOẠI>` — cùng nguyên tắc với `SALE_TAX_<LOẠI>` ở trên. `STOCK` = 0.3% (theo TPS); `FUND`/`BOND`/`GOLD` = `0%` cho cả 2 chiều **(đã chốt, 2026-07-18)** — chưa dùng kênh tính phí % cho 3 loại này, vẫn seed tường minh, không để thiếu dòng. Xem `process/DECISION.md` 2026-07-18 (5).
- **Sửa một giao dịch SELL đã ghi (đổi ngày/giá) — đã chốt 2026-07-18:** khi sửa đổi **ngày** của một SELL đã ghi, form **tự tính lại** `taxAmount` bằng cách resolve lại `SALE_TAX_<loại>` tại ngày mới (effective dating), hiển thị giá trị cũ (gạch ngang) cạnh giá trị mới tính lại + tên `Setting` áp dụng tại ngày mới. Giá trị tính lại **vẫn sửa tay được** sau đó (không khoá field, cùng tinh thần "gợi ý không phải nguồn sự thật duy nhất" ở trên) — nếu người dùng đã tự sửa tay để khớp sao kê thật trước đó, họ cần tự sửa lại sau khi form tính lại (không tự động khôi phục giá trị đã sửa tay cũ, vì không có cách phân biệt "giá trị cũ do tự tính" với "giá trị cũ do user tự sửa"). Xem `process/DECISION.md` 2026-07-18.

## Ví dụ
- Mua 100 FPT giá 100k qua TPS (`TRANSACTION_FEE_BUY_STOCK` = 0.3%) → giá trị mua 10.000.000 → phí tự tính = 30.000 → `amount = -10.030.000`, giá vốn bình quân (gồm phí) = 10.030.000/100 = **100.300**/CP.
- Bán 50 FPT giá 130k → giá trị bán 6.500.000 → thuế 0.1% = 6.500, phí bán (`TRANSACTION_FEE_SELL_STOCK` 0.3%) = 19.500 → tiền nhận ≈ 6.474.000.
- Cổ tức tiền mặt gộp 200.000 → thuế 5% = 10.000 → thực nhận 190.000.
- Bán 1 lượng vàng SJC → `SALE_TAX_GOLD` = 0% → `taxAmount = 0`, tiền nhận chỉ trừ phí (nếu có).
- **Chi phí ăn mòn:** danh mục có `grossInvested` (tổng tiền đã chi ra mua) = 500.000.000; lịch sử cộng dồn `Cashflow.taxAmount` = 1.200.000, `Cashflow.feeAmount` = 800.000, `Dividend.taxAmount` = 300.000 → `costDragAmount` = 2.300.000 → `costDragPercent` ≈ 0.46%. Dòng phụ dưới lãi/lỗ hiển thị: "Bao gồm 1.500.000 thuế + 800.000 phí (0.46% vốn đã bỏ ra mua)".
  - **Ca bán nhiều làm rõ vì sao không dùng vốn ròng:** mua 100.000.000, sau đó bán bớt thu về 80.000.000 → vốn ròng còn ~20.000.000; nếu chi phí luỹ kế 2.000.000 thì chia vốn ròng ra **10%** (hoảng), còn chia `grossInvested` = 100.000.000 ra **2%** (đúng cảm nhận "phí ăn 2% số tiền tôi từng rót vào").
