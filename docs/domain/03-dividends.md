# Dividends

## Mục đích
Định nghĩa cách ghi nhận cổ tức tiền mặt, cổ tức cổ phiếu và **trái tức (lãi trái phiếu định kỳ)** — gồm khấu trừ thuế và ảnh hưởng tới XIRR.

## Entity / field
- `Dividend`: `holdingId`, `type` (`CASH`/`STOCK`/`BOND_COUPON`), `date`, `paymentDate?`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`, `parValueApplied?`, `couponRatePercentApplied?`, `couponFrequencyMonthsApplied?`, `grossAmountOverridden` (mặc định `false`; chỉ `true` khi `type = BOND_COUPON` và user đã sửa tay `grossAmount` — xem "Cách tính" nhánh `BOND_COUPON`), `note?`.
- Tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền.
- `paymentDate` (issue #61) — ngày tiền/CP **thực về** tài khoản, có thể trễ vài tuần so với `date` (ngày chia) ngoài thực tế. Optional, user có thể bỏ trống. **Từ 2026-07-19 (issue #65): là mốc dòng tiền XIRR của cổ tức `CASH`** — `buildXirrCashflows` (`lib/xirr-cashflow.ts`) ghép điểm dòng tiền tại `paymentDate ?? date` (fallback `date` khi bỏ trống), vì XIRR quy đổi lợi suất theo thời gian nên phải đặt đúng lúc tiền thực về tay thay vì ngày chia. **KHÔNG** dùng cho `buildQuantityTimeline()` (số lượng nắm giữ) và **KHÔNG** phải mốc ghi `NavOverride` bù pha loãng bên dưới — hai chỗ đó vẫn luôn dùng `date`.

## Quy tắc & bất biến
- **Cổ tức tiền mặt (`CASH`)** là tiền **nhận về** — dòng tiền **dương** trong XIRR (không phải khoản trừ).
  - App **tự khấu trừ thuế TNCN (~5%)**: lưu `grossAmount` (gộp), `taxAmount` (thuế), `netAmount` (thực nhận).
  - **`netAmount` là dòng tiền dương đưa vào XIRR** (số thực nhận sau thuế).
  - `netAmount = grossAmount − taxAmount`.
- **Cổ tức cổ phiếu (`STOCK`)** **tăng `stockQuantity`** nắm giữ, **không phát sinh tiền** → không phải dòng tiền XIRR. Ảnh hưởng gián tiếp qua NAV tăng do số lượng tăng. Thuế (nếu có) xử lý khi bán — để sau.
- **Trái tức (`BOND_COUPON`, Phase 7)** là lãi định kỳ của `Holding{type: BOND}` — cũng là tiền **nhận về**, dùng chung 3 field `grossAmount`/`taxAmount`/`netAmount` và cũng lấy `netAmount` làm dòng tiền dương XIRR như `CASH`. Ba khác biệt bắt buộc so với `CASH`:
  1. **Thuế theo key riêng phụ thuộc tổ chức phát hành** (`BOND_INTEREST_TAX_RATE_CORPORATE`/`_GOVERNMENT` theo `BondTerms.issuerType`), không phải `DIVIDEND_TAX_RATE` — xem `07-tax.md`.
  2. **KHÔNG bù pha loãng NAV** — xem mục dưới, đây là điểm dễ sai nhất.
  3. **Không hỏi lại mệnh giá/lãi suất mỗi lần ghi** — đọc từ `BondTerms`, xem "Cách tính".
- Cổ tức/trái tức gắn với đúng một `Holding`.

## Cách tính
- Người dùng nhập **tỷ lệ % cổ tức** (`percent`, so với mệnh giá) + ngày chia — Server Action tự tính số tiền/số lượng, `Dividend` **không lưu `percent` trực tiếp** (chỉ lưu kết quả đã tính). Khi hiển thị lịch sử, `percentLabel` được **suy ngược** từ dữ liệu đã lưu (xem "Hiển thị lịch sử" bên dưới).
- Với `CASH`:
  - `parValue` = mệnh giá tại ngày chia, resolve từ key `DIVIDEND_PAR_VALUE` trong `Setting` (effective-dated, xem `09-settings.md`).
  - `grossAmount = parValue × percent/100 × SL đang giữ tại ngày chia`.
  - `taxAmount = grossAmount × taxRateCổTức`; `netAmount = grossAmount − taxAmount = grossAmount × (1 − taxRateCổTức)`.
- Với `STOCK`: `stockQuantity = SL đang giữ tại ngày chia × percent/100`. `stockQuantity` làm tròn xuống (floor) — cổ phiếu không chia lẻ. Giá trị trước làm tròn giữ lại làm mốc so sánh khi user tự chỉnh.
- Với `BOND_COUPON`:
  - **Không nhập `percent`** (khác `CASH`/`STOCK`): mệnh giá và lãi suất là **điều khoản hợp đồng**, đọc từ `BondTerms.parValue`/`couponRatePercent`/`couponFrequencyMonths` — form chỉ hỏi ngày trả lãi (và `paymentDate` nếu tiền về trễ).
  - `grossAmount = parValue × couponRatePercent/100 × couponFrequencyMonths/12 × SL đang giữ tại ngày trả lãi`.
  - `taxAmount = grossAmount × BOND_INTEREST_TAX_RATE_<issuerType>` (resolve theo `date`); `netAmount = grossAmount − taxAmount`.
  - **Thuế chỉ PREFILL, sửa tay được** (issue #58) — cùng nguyên tắc "form chỉ prefill, KHÔNG khoá field" của thuế bán/phí (`07-tax.md`): tổ chức phát hành có thể khấu trừ lệch vài đồng so với công thức chuẩn. Khi user sửa, `netAmount` tính lại theo thuế đã sửa (`gross − thuế hiệu lực`), không giữ `net` tính từ số tự động. Đây là loại cổ tức DUY NHẤT nhận thuế nhập tay: `CASH` tự tính từ `DIVIDEND_TAX_RATE` và **từ chối** request gửi kèm `taxAmount` (không tin client).
  - **`grossAmount` cũng chỉ PREFILL, sửa tay được (mở rộng cùng cơ chế trên, chốt 2026-08-08)** — cùng lý do "SL hiện tại vs SL tại ngày trả lãi" đã giải thích cho thuế phía trên: trái phiếu lãi suất thả nổi (model giả định coupon rate cố định) khiến số tự tính từ `BondTerms` lệch số thực nhận trên sao kê phát hành. `Dividend.grossAmountOverridden: Boolean` đánh dấu khi kỳ này đã bị chỉnh tay — **khác tiền lệ `taxAmount`** (không có `taxAmountOverridden` tương đương): `grossAmount` là số **gốc** dùng cho XIRR/báo cáo thuế (thuế/net đều tính từ nó), nên cần phân biệt được lúc audit lịch sử con số lệch là do lãi suất thật đổi, do SL replay lệch (ghi bù/sửa giao dịch cũ), hay do user tự sửa — chỉ nhìn con số đã lưu không tách được 3 nguyên nhân này nếu thiếu cờ.
  - **"Sửa tay" nghĩa là user THẬT SỰ gõ — form không gửi số tự tính lên** (sửa 2026-07-29, xem `process/DECISION.md`). Card thuế/gộp chỉ submit `taxAmount`/`grossAmount` khi giá trị đã bị chỉnh; chưa động vào thì field **vắng mặt** trong `FormData` và server dùng số của chính nó. Bắt buộc như vậy vì hai bên tính trên **SL khác nhau**: form tính theo `Holding.quantity` (SL **hiện tại**, thứ duy nhất client có), còn server tính `grossAmount` theo **SL tại ngày trả lãi**. Luôn gửi số tự tính lên sẽ ra `netAmount = gross(theo ngày trả lãi) − tax(theo SL hiện tại)` — sai tiền, không tín hiệu lỗi, và lộ ra đúng lúc **ghi bù một kỳ cũ** sau khi đã mua thêm (đúng ca mà lịch trả lãi neo `firstCouponDate` sinh ra để hỗ trợ). Hệ quả chung: **schema nhận field kiểu "prefill sửa được" phải để `.optional()`, KHÔNG `.default()`** — "vắng mặt" phải mang nghĩa "dùng số server tự tính", không phải "bằng 0".
  - **Chặn `taxAmount > grossAmount`** — `netAmount` là dòng tiền **dương** đưa vào XIRR; một giá trị âm sẽ trôi vào XIRR và tổng "đã nhận" như thể trái tức làm mất tiền. Lỗi lường trước (`ActionResult`), không phải sự cố. **So sánh với `grossAmount` CUỐI CÙNG** (đã qua override nếu có), **không phải số tự tính từ `BondTerms`** — so với số tự tính sẽ để lọt ca user hạ gộp xuống thấp hơn thuế đã prefill (chốt 2026-08-08 cùng lúc thêm override gộp, xem `process/DECISION.md`).
  - **Hàm thuần:** `computeBondCoupon()` (`features/dividends/dividend-math.ts`). Hệ số `couponFrequencyMonths/12` quy đổi lãi suất **danh nghĩa theo năm** về một kỳ — bỏ sót hệ số này làm số tiền sai gấp đôi/gấp bốn mà không có tín hiệu lỗi nào.
  - **Đóng băng thông số đã dùng:** ghi `parValueApplied`/`couponRatePercentApplied` vào chính dòng `Dividend`. Lý do: `BondTerms` **sửa được về sau** (nhập sai lúc tạo, hoặc trái phiếu lãi suất thả nổi) — nếu lịch sử đọc lại giá trị hiện tại thì mọi kỳ cũ sẽ hiển thị sai. Cùng nguyên tắc "thuế/phí đã tính không hồi tố" ở `07-tax.md`.
  - **Trái tức KHÔNG cập nhật gì trên `BondTerms`** — "kỳ trả lãi tới" suy runtime từ `firstCouponDate` + lịch sử `Dividend{type: BOND_COUPON}`, xem `10-cashflow-calendar.md`.
- **"SL đang giữ tại ngày chia"** không phải `Holding.quantity` cache hiện tại (luôn phản ánh HÔM NAY) — phải phát lại lịch sử `Cashflow` (BUY/SELL) **và** `Dividend{type: STOCK}` đã ghi trước đó tính đến đúng ngày chia (`lib/position-trail.ts::buildQuantityTimeline`, chuyển từ `features/dividends/` ra dùng chung khi `features/holdings/` cũng cần — xem issue #59), vì ghi cổ tức có thể lùi ngày so với giao dịch gần nhất.
- **`avgCost` giữ nguyên khi nhận cổ tức cổ phiếu** — chỉ `Holding.quantity` tăng thêm `stockQuantity` (cộng thẳng vào cache hiện có trong cùng transaction, không replay lại toàn bộ lịch sử); giá vốn/CP giảm tương ứng một cách tự nhiên vì cùng tổng vốn chia cho nhiều CP hơn (không cần công thức riêng).
- Số lượng nắm giữ (xem `01-assets-and-holdings.md`) cộng thêm Σ(dividend STOCK.stockQuantity).

## Bù pha loãng NAV khi ghi cổ tức

> **CHỈ áp dụng cho `CASH` và `STOCK`. Nhánh `BOND_COUPON` phải BỎ QUA hoàn toàn mục này** (Phase 7, đã chốt 2026-07-25).
>
> Lý do (đây là khác biệt bản chất giữa cổ phiếu và trái phiếu, không phải đơn giản hoá): với cổ phiếu, tiền cổ tức **rời khỏi vốn công ty** nên thị giá điều chỉnh giảm tương ứng ngay ngày giao dịch không hưởng quyền. Với trái phiếu, coupon là **nghĩa vụ trả lãi theo hợp đồng**, không rút vốn khỏi tổ chức phát hành — **clean price (giá yết) không giảm theo coupon**; cái reset về 0 là *lãi dồn tích* nằm trong dirty price, mà Navtrack không mô hình hoá (giá lưu ở `NavOverride`/`PriceQuote` là clean price).
>
> Nếu để nhánh BOND đi qua bước bù pha loãng dùng chung, mỗi lần ghi trái tức sẽ tạo một `NavOverride` kéo giá trái phiếu **tụt xuống sai**, và tụt **tích luỹ** qua từng kỳ — NAV danh mục sai dần một cách âm thầm, không có tín hiệu lỗi nào. `recordDividend` là hàm dùng chung nên đây là bẫy mặc định, phải chặn tường minh ngay đầu nhánh.

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
  - `BOND_COUPON`: **không suy ngược gì cả** — cả ba thành phần của nhãn (`9%/năm · kỳ 6 tháng`) đọc thẳng từ field đã đóng băng trên chính dòng đó: `parValueApplied`, `couponRatePercentApplied`, `couponFrequencyMonthsApplied`. Đây là đáp án cho điểm mở (3) cũ của Phase 7: không cần công thức suy ngược nào, vì mọi thông số đã được lưu tại thời điểm ghi.
    - **Vì sao `couponFrequencyMonthsApplied` phải là một CỘT, không phải phép đảo công thức** (chốt lúc implement #58, sau khi thử cách kia): kỳ trả lãi nằm **trong nhãn**, nên nó phải bất biến như mệnh giá/lãi suất. Đảo ngược `computeBondCoupon()` (`freq = gross × 1200 / (par × rate × SL)`) trông như tránh được một cột, nhưng **mẫu số chứa SL-tại-ngày-ghi** — con số này KHÔNG đóng băng, nó được phát lại từ lịch sử `Cashflow`/`Dividend` mỗi lần đọc. Hệ quả: user nhập bù một lệnh mua bị sót (lùi ngày) hoặc xoá một lệnh mua → SL tại ngày đó đổi → nhãn của kỳ **đã ghi** nhảy từ `kỳ 6 tháng` sang `kỳ 4 tháng`/`kỳ 12 tháng`, đều là số nghe hợp lý nên **sai âm thầm**. Đúng loại lỗi mà cơ chế đóng băng sinh ra để chặn. Xem `process/DECISION.md` 2026-07-28 (3).
- `SL trước đó`/`SL sau` của từng dòng lấy từ cùng `buildQuantityTimeline()` phát lại trên toàn bộ `Cashflow` + `Dividend` thật của Holding đó (không suy từ cache hiện tại).

## Ca biên
- **Thuế cổ tức khác thuế bán:** thuế cổ tức tiền mặt lấy từ key `DIVIDEND_TAX_RATE` trong bảng `Setting`, khác key thuế bán `SALE_TAX_<LOẠI>`. Tra theo ngày chia cổ tức (effective dating). Xem `07-tax.md`.
- **Mức 5% đã seed chính thức** (`prisma/seed.ts`, `DIVIDEND_TAX_RATE = "5"` từ 2020-01-01) — vẫn resolve qua `Setting` như mọi giá trị effective-dated khác (đổi mức thuế về sau chỉ cần thêm dòng `Setting` mới, không sửa code).
- **Mệnh giá cũng là `Setting`** (`DIVIDEND_PAR_VALUE`, mặc định `10000` đ/CP từ 2020-01-01) — không hard-code trong code, resolve theo ngày chia giống thuế.
- **Lãi trái phiếu:** đã xử lý bằng `BOND_COUPON` ở Phase 7 (xem trên). Cổ tức của **vàng** không tồn tại; quỹ (`FUND`) trả cổ tức thì dùng `CASH` như cổ phiếu.
- **Trái tức kỳ cuối trùng ngày đáo hạn — thứ tự ghi ảnh hưởng kết quả.** `buildQuantityTimeline()` sắp xếp theo `date` rồi `createdAt`; nếu user ghi `Cashflow{type: MATURITY}` trước rồi mới ghi trái tức kỳ cuối **cùng ngày**, "SL đang giữ tại ngày trả lãi" đã về `0` → `grossAmount` ra **0 đồng**, sai âm thầm. Quy ước bắt buộc: trong **cùng một ngày**, `Dividend` luôn xếp **trước** `Cashflow{type: MATURITY}` — tie-break theo bản chất sự kiện (lãi phát sinh trên số dư trước khi tất toán), không theo `createdAt`. Xem `10-cashflow-calendar.md`.
- **Ghi trái tức cho `Holding` chưa có `BondTerms`** → chặn ở Server Action với thông báo rõ ("cần nhập điều khoản trái phiếu trước"), không tự đoán mệnh giá. Khác nguyên tắc "thiếu field optional là bình thường" của lịch dòng tiền (`10-cashflow-calendar.md`) — ở đó thiếu field chỉ làm holding không xuất hiện, còn ở đây thiếu field thì **không tính được số tiền**.
  - **Có `BondTerms` nhưng thiếu `couponRatePercent` hoặc `couponFrequencyMonths` cũng chặn** (implement #58) — đó là trái phiếu chiết khấu/zero-coupon: không có kỳ trả lãi nào để ghi, toàn bộ lợi tức phát sinh khi tất toán đáo hạn (`07-tax.md`). Thông báo tách riêng khỏi ca thiếu hẳn `BondTerms` để user biết cần bổ sung gì.
  - UI chặn sớm hơn một bước (mockup 7g): vị thế BOND chưa có `BondTerms` vẫn hiện tab "Trái tức" nhưng render màn chặn dẫn sang màn nhập điều khoản, thay vì giấu tab đi không lời giải thích. Server Action vẫn chặn độc lập — không tin UI đã chặn.
- **Làm tròn cổ tức cổ phiếu:** hệ thống làm tròn xuống theo công thức tuyến tính, nhưng công ty phát hành có thể áp quy ước làm tròn khác (VD theo lô) → cho phép user tự sửa `stockQuantity` khi ghi, validate sai lệch tối đa **2 đơn vị** so với số tính từ % (`STOCK_DIVIDEND_ROUNDING_TOLERANCE`), để bắt lỗi gõ nhầm mà vẫn linh hoạt với sai số làm tròn thực tế.

## Ví dụ
- FPT trả cổ tức tiền mặt 2.000/cổ phần × 100 cổ phần = gộp 200.000 → thuế 5% = 10.000 → **net 190.000** ghi làm dòng tiền dương ngày chia.
- FPT trả cổ tức cổ phiếu 10% với 100 cổ phần → `stockQuantity = 10`, số lượng nắm giữ thành 110, không có tiền.
