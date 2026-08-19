# Tax

## Mục đích
Định nghĩa cách app tự tính và trừ thuế **+ phí giao dịch**, để lãi/lỗ hiển thị là số **thực nhận** chứ không phải số trên giấy.

## Entity / field
- **`Setting`** (bảng master cấu hình, effective dating) giữ mọi thuế suất: `SALE_TAX_<LOẠI>` (thuế bán theo loại), `DIVIDEND_TAX_RATE` (thuế cổ tức), `BOND_INTEREST_TAX_RATE_CORPORATE`/`_GOVERNMENT` (thuế lãi trái phiếu, xem mục riêng bên dưới) — và mọi mức phí giao dịch: `TRANSACTION_FEE_BUY_<LOẠI>`/`TRANSACTION_FEE_SELL_<LOẠI>` (xem mục "Phí giao dịch" bên dưới). Thay cho `TaxRule` cũ.
- Thuế **đã tính** lưu trên chính giao dịch: `Cashflow.taxAmount` (khi bán hoặc đáo hạn), `Dividend.taxAmount` (cổ tức, trái tức) — xem `02-` và `03-`.
- **`BondTerms.issuerType`** (`CORPORATE`/`GOVERNMENT`) quyết định key thuế lãi áp dụng cho trái phiếu đó — xem `02-data-model.md`.

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
- **Tạo `Holding` mới ở nhánh "vừa mua mới thật" (`intent: "NEW_PURCHASE"`, issue #142) dùng CHUNG cơ chế phí này** với mọi giao dịch BUY khác: `feeAmount` tự tính từ `TRANSACTION_FEE_BUY_<LOẠI>` effective-dated theo ngày giao dịch, form chỉ **prefill, không khoá field** (cùng tinh thần ở trên). Nhánh "khai báo vị thế đã có sẵn" (`intent: "HISTORICAL"`) thì **không có phí** — `feeAmount = 0` trên `Cashflow` mốc, vì phí quá khứ (nếu có) đã nằm sẵn trong giá vốn bình quân user tự nhập, không tách lại được. Xem `02-transactions-and-cost-basis.md` mục "Vị thế mở ban đầu".

## Thuế lãi trái phiếu & đáo hạn (Phase 7)

**Căn cứ pháp lý đã tra cứu (2026-07-25), không suy diễn:**
- **Lãi trái phiếu doanh nghiệp** là thu nhập từ **đầu tư vốn** (không phải cổ tức, không phải chuyển nhượng) — chịu thuế TNCN **5%** trên số lãi nhận được, khấu trừ tại nguồn bởi tổ chức phát hành/đại lý.
- **Lãi trái phiếu Chính phủ và trái phiếu chính quyền địa phương được MIỄN thuế TNCN** — khoản 7 trong 22 trường hợp miễn thuế tại **Nghị định 253/2026/NĐ-CP** (hiệu lực 01/07/2026, cùng nghị định làm căn cứ cho `SALE_TAX_BOND`). Nguyên văn: *"Thu nhập từ lãi trái phiếu chính phủ, lãi trái phiếu chính quyền địa phương, lãi tiền gửi tại tổ chức tín dụng, lãi từ hợp đồng bảo hiểm nhân thọ."*
- **Miễn thuế chỉ áp cho phần LÃI, không áp cho chuyển nhượng:** bán trái phiếu Chính phủ trước hạn vẫn là chuyển nhượng chứng khoán → vẫn chịu `SALE_TAX_BOND` 0.1% trên giá chuyển nhượng như trái phiếu doanh nghiệp. Không được suy rộng khoản miễn thuế sang `SELL`.

**Hai key riêng, KHÔNG dùng chung `DIVIDEND_TAX_RATE`:**

| key | seed | lý do |
|---|---|---|
| `BOND_INTEREST_TAX_RATE_CORPORATE` | `5` | trái phiếu doanh nghiệp |
| `BOND_INTEREST_TAX_RATE_GOVERNMENT` | `0` | miễn theo NĐ 253/2026 — vẫn seed **tường minh**, không để thiếu dòng (cùng tiền lệ `SALE_TAX_GOLD = 0`) |

Dùng chung `DIVIDEND_TAX_RATE` là bế tắc: cổ tức và lãi trái phiếu tuy cùng mức 5% nhưng khác căn cứ pháp lý, và mức lãi trái phiếu còn **phụ thuộc tổ chức phát hành** — không có cách nào biểu diễn "5% doanh nghiệp / 0% Chính phủ" bằng một key duy nhất. Resolve theo `BondTerms.issuerType`, effective-dated theo **ngày trả lãi** (`Dividend.date`).

**Thuế khi đáo hạn (`Cashflow{type: MATURITY}`) — không phải 0 cứng:**
- **Không** áp `SALE_TAX_BOND` 0.1%: đáo hạn là nhận lại gốc từ chính tổ chức phát hành, không phải chuyển nhượng chứng khoán.
- Nhưng **phần chênh giữa số nhận về và giá vốn là lãi**, không phải capital gain — với trái phiếu **mua chiết khấu / zero-coupon**, toàn bộ lợi tức nằm ở đây và chịu đúng thuế lãi ở trên:
  ```
  taxAmount = max(0, (pricePerUnit − avgCost) × quantity) × BOND_INTEREST_TAX_RATE_<issuerType>%
  ```
- Mua đúng mệnh giá thì `avgCost ≥ parValue` (đã gồm phí mua, xem "Phí giao dịch") → chênh lệch ≤ 0 → thuế ra **0** một cách tự nhiên. Công thức tổng quát này phủ cả hai ca, không cần nhánh riêng.
- **Giả định phải nói rõ:** dùng `avgCost` (đã gồm phí mua) làm căn cứ trừ là **rộng hơn** luật một chút — phí mua không phải khoản được trừ khỏi thu nhập lãi chịu thuế. Sai lệch nhỏ và lệch về phía thấp; vì form **chỉ prefill, không khoá** (nguyên tắc chung ở trên), user sửa lại theo sao kê khi cần.
- **`feeAmount` khi đáo hạn mặc định `0`, KHÔNG prefill từ `TRANSACTION_FEE_SELL_BOND`** (sửa 2026-07-29, xem `process/DECISION.md`). Đáo hạn là nhận lại gốc từ tổ chức phát hành, không qua lệnh khớp CTCK nên không phát sinh phí giao dịch. Bản đầu của #101 có prefill "cho nhất quán" với các giao dịch khác, nhưng màn tất toán **không hiển thị và không cho sửa ô phí nào** — nên một `Setting` khác `0` sẽ trừ vào `Cashflow.amount` một khoản người dùng không hề thấy, lệch hẳn với dòng "Thực nhận" vừa xác nhận trên form. Quy tắc rút ra: **chỉ được prefill con số nào form có hiển thị ra** — prefill vô hình là khoản trừ lén, không phải "nhất quán". `settleMaturitySchema.feeAmount` vẫn nhận giá trị nếu về sau màn có ô phí.
- **Hàm thuần:** `computeMaturitySettlement()` (`lib/maturity-settlement.ts`) — MỘT cài đặt dùng chung cho Server Action `settleMaturity` (`features/holdings/actions.ts`) và preview client-side của màn tất toán, không giữ 2 bản song song.
- **Thiếu `BondTerms` → chặn tất toán** (implement #101): không có `issuerType` thì không biết áp 5% hay 0%, không có `parValue` thì không prefill được giá nhận về. Cùng nguyên tắc "app không đoán" với ghi trái tức (`03-dividends.md` mục "Ca biên") — khác chỗ đó ở chỗ đây chặn ngay từ tầng query của màn (route trả `notFound`), vì không có gì hợp lý để hiển thị.
- **Loại giao dịch KHÔNG phải input của client.** `settleMaturitySchema` không nhận `cashflowType` (khác `addTransactionSchema`) — `MATURITY` là hằng số của chính luồng này. Cho client chọn loại sẽ mở đúng đường ghi nhầm một dòng `SELL` (chịu 0,1% trên toàn bộ mệnh giá hoàn trả) vào màn đáo hạn.
- **`MATURITY` cũng không đi ngược lại được vào form giao dịch thường** (sửa 2026-07-29, xem `process/DECISION.md`). Ba ràng buộc, đều ở **server**, vì `TransactionForm` chỉ khoá được ở UI còn `<input type="hidden">` thì sửa được:
  1. **Tạo mới:** `newHoldingSchema`/`addTransactionSchema` chỉ nhận `BUY`/`SELL` (`manualCashflowTypeEnum`, KHÔNG phải `z.enum(CASHFLOW_TYPES)`). Cho tạo `MATURITY` ở đây là ghi thẳng một dòng đáo hạn lên vị thế bất kỳ — kể cả vàng — bỏ qua kiểm tra `holding.type = BOND` + `BondTerms` tồn tại của `settleMaturity`.
  2. **Sửa:** `updateTransactionSchema` **vẫn** nhận `MATURITY` (form gửi lên nguyên loại của dòng đang sửa; chặn ở schema thì không sửa nổi ngày/số lượng của một dòng đáo hạn) — nhưng `updateTransaction` từ chối mọi thay đổi loại khi một trong hai đầu là `MATURITY`. Ngày/số lượng/giá/phí/thuế vẫn sửa bình thường; đổi `BUY ⇄ SELL` vẫn cho phép như trước.
  3. Lý do chặn cả hai chiều: `MATURITY → SELL` nhảy sang thuế 0,1% trên toàn bộ mệnh giá hoàn trả; `SELL → MATURITY` dựng một dòng đáo hạn không qua luồng tất toán, rồi vẫn được `cashflowEventRank()` xếp cuối ngày và `computeRealizedGainForHolding()` tính như SELL.

## Chi phí ăn mòn (cost drag) — tổng thuế + phí luỹ kế
- **Mục đích:** trả lời câu hỏi Sheet cũ không trả lời được — "tổng cộng tôi đã mất bao nhiêu tiền cho thuế/phí giao dịch, và con số đó chiếm bao nhiêu % số vốn tôi bỏ ra" (xem `docs/business-overview.md` mục "Bài toán"). Hiển thị như một dòng phụ nhỏ dưới card lãi/lỗ trên dashboard (`ReturnMetrics`), không phải một card riêng.
- **Phạm vi cộng dồn — gồm cả ba nguồn đã có sẵn dữ liệu**, tính tới cùng mốc chốt (`cutoffDate`) đang chọn trên dashboard:
  - `Σ Cashflow.taxAmount` — thuế bán (Phase 5; luôn `0` cho BUY) **+ thuế lợi tức khi đáo hạn** (Phase 7, `MATURITY`; thường `0` khi mua đúng mệnh giá).
  - `Σ Cashflow.feeAmount` — phí giao dịch (BUY + SELL, đã có từ Phase 1).
  - `Σ Dividend.taxAmount` — thuế cổ tức tiền mặt (Phase 4) **+ thuế trái tức** (Phase 7; `0` với trái phiếu Chính phủ). `null`/không áp dụng cho cổ tức cổ phiếu, coi như `0`.
  - Không cần đổi công thức hay thêm nguồn thứ tư khi Phase 7 vào — hai loại thuế mới rơi đúng vào 2 cột `taxAmount` đã cộng dồn sẵn.
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
- **Bán trước hạn vs đáo hạn — ĐÃ CHỐT ở Phase 7 (2026-07-25), đóng điểm mở treo từ 2026-07-17.** `SALE_TAX_BOND` 0.1% chỉ áp cho **chuyển nhượng trước hạn** trên thị trường thứ cấp (`Cashflow{type: SELL}`). **Đáo hạn** dùng loại giao dịch riêng `Cashflow{type: MATURITY}` với công thức thuế lợi tức ở mục "Thuế lãi trái phiếu & đáo hạn" bên trên — không còn phải ghi đáo hạn bằng một dòng SELL rồi tự xoá thuế bằng tay.
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
- **Trái tức doanh nghiệp:** 2 trái phiếu mệnh giá 100.000.000, coupon 9%/năm trả 6 tháng/lần → gộp = `100.000.000 × 9% × 6/12 × 2` = 9.000.000 → `BOND_INTEREST_TAX_RATE_CORPORATE` 5% = 450.000 → thực nhận 8.550.000 (dòng tiền dương XIRR).
- **Trái tức trái phiếu Chính phủ:** cùng số liệu trên nhưng `issuerType = GOVERNMENT` → `BOND_INTEREST_TAX_RATE_GOVERNMENT` = 0% → thuế 0, thực nhận đủ 9.000.000.
- **Đáo hạn mua đúng mệnh giá:** mua 1 trái phiếu par 100.000.000 (avgCost 100.000.000 + phí) → đáo hạn nhận 100.000.000 → chênh lệch ≤ 0 → thuế 0.
- **Đáo hạn trái phiếu chiết khấu (doanh nghiệp):** mua 1 trái phiếu giá 92.000.000, par 100.000.000 → lợi tức 8.000.000 → thuế 5% = 400.000, **không phải** 0.1% × 100.000.000 = 100.000 như khi ghi nhầm bằng SELL.
- Bán 1 lượng vàng SJC → `SALE_TAX_GOLD` = 0% → `taxAmount = 0`, tiền nhận chỉ trừ phí (nếu có).
- **Chi phí ăn mòn:** danh mục có `grossInvested` (tổng tiền đã chi ra mua) = 500.000.000; lịch sử cộng dồn `Cashflow.taxAmount` = 1.200.000, `Cashflow.feeAmount` = 800.000, `Dividend.taxAmount` = 300.000 → `costDragAmount` = 2.300.000 → `costDragPercent` ≈ 0.46%. Dòng phụ dưới lãi/lỗ hiển thị: "Bao gồm 1.500.000 thuế + 800.000 phí (0.46% vốn đã bỏ ra mua)".
  - **Ca bán nhiều làm rõ vì sao không dùng vốn ròng:** mua 100.000.000, sau đó bán bớt thu về 80.000.000 → vốn ròng còn ~20.000.000; nếu chi phí luỹ kế 2.000.000 thì chia vốn ròng ra **10%** (hoảng), còn chia `grossInvested` = 100.000.000 ra **2%** (đúng cảm nhận "phí ăn 2% số tiền tôi từng rót vào").
