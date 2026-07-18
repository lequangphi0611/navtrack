# Tax

## Mục đích
Định nghĩa cách app tự tính và trừ thuế, để lãi/lỗ hiển thị là số **thực nhận** chứ không phải số trên giấy.

## Entity / field
- **`Setting`** (bảng master cấu hình, effective dating) giữ mọi thuế suất: `SALE_TAX_<LOẠI>` (thuế bán theo loại), `DIVIDEND_TAX_RATE` (thuế cổ tức). Thay cho `TaxRule` cũ.
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

## Ca biên
- **Mức thuế cổ phiếu/quỹ:** 0.1% (bán) và 5% (cổ tức) là mức phổ biến VN — dùng làm mặc định seed cho `SALE_TAX_STOCK`/`SALE_TAX_FUND`/`DIVIDEND_TAX_RATE`.
- **`SALE_TAX_GOLD` = 0 (đã chốt, 2026-07-17):** cá nhân bán vàng miếng/trang sức tại VN không chịu thuế TNCN chuyển nhượng (khác chứng khoán) — seed `Setting` với giá trị `0`, KHÔNG được để trống/thiếu dòng (vẫn phải seed tường minh, vì "thiếu cấu hình" báo lỗi cứng — xem `09-settings.md`).
- **`SALE_TAX_BOND` và việc bán/đáo hạn trái phiếu (điểm còn mở, cố ý để ngỏ tới Phase 7):** mô hình thuế-khi-bán hiện áp dụng chung cho mọi `Cashflow{type: SELL}` bất kể loại tài sản. Về bản chất, **chuyển nhượng trái phiếu trước hạn** trên thị trường thứ cấp mới chịu thuế CK 0.1%; **đáo hạn nhận lại gốc** từ tổ chức phát hành không phải một giao dịch chuyển nhượng nên **không** thuộc diện chịu thuế này. Navtrack hiện chưa có cách ghi nhận riêng "đáo hạn" (chỉ có SELL chung) — nếu ghi đáo hạn bằng một dòng SELL bình thường, Phase 5 sẽ tính nhầm 0.1% trên toàn bộ mệnh giá hoàn trả. Quyết định (2026-07-17): **chưa xử lý ở Phase 5** — người dùng hiện tại chỉ giữ trái phiếu tới đáo hạn, không bán thứ cấp; bàn kỹ lại khi làm Phase 7 (trái tức), xem `docs/domain/03-dividends.md`/`process/phase-7.md`.
- **Thuế theo loại tài sản khác nhau:** mỗi loại một key `SALE_TAX_<LOẠI>` (đặt 0 nếu không áp, như `GOLD`).
- **Đổi chính sách giữa chừng:** thêm dòng `Setting` mới cùng `key`, `effectiveFrom` = ngày hiệu lực mới — không sửa dòng cũ (giữ lịch sử).
- **Giao dịch trước mọi mốc effectiveFrom:** nếu không có dòng nào `effectiveFrom <= ngày` → coi là thiếu cấu hình, báo rõ (không mặc định 0 âm thầm).
- **Lỗ khi bán:** vẫn có thể phát sinh thuế trên *giá trị bán* (không phải trên lãi) — mô hình `giá trị bán × ratePercent` phản ánh đúng cách VN đánh thuế cổ phiếu (trên giá trị giao dịch, không trên lãi). UI nên nói rõ điều này (vd chú thích khi lãi/lỗ âm mà vẫn có `taxAmount` > 0) để người dùng không tưởng nhầm là app tính sai.
- **Sửa một giao dịch SELL đã ghi (đổi ngày/giá) — điểm còn mở, chưa chốt:** chưa quyết định form sửa sẽ tự tính lại `taxAmount` theo ngày mới (resolve lại `SALE_TAX_<loại>` tại ngày sau khi sửa) hay giữ nguyên giá trị cũ (vì người dùng có thể đã tự sửa tay để khớp sao kê thật, ghi đè lại sẽ mất giá trị đó). Cần chốt lúc implement Phase 5 — không tự chọn thay.

## Ví dụ
- Bán 50 FPT giá 130k → giá trị bán 6.500.000 → thuế 0.1% = 6.500 → tiền nhận ≈ 6.493.500 (trước phí).
- Cổ tức tiền mặt gộp 200.000 → thuế 5% = 10.000 → thực nhận 190.000.
- Bán 1 lượng vàng SJC → `SALE_TAX_GOLD` = 0% → `taxAmount = 0`, tiền nhận chỉ trừ phí (nếu có).
- **Chi phí ăn mòn:** danh mục có `grossInvested` (tổng tiền đã chi ra mua) = 500.000.000; lịch sử cộng dồn `Cashflow.taxAmount` = 1.200.000, `Cashflow.feeAmount` = 800.000, `Dividend.taxAmount` = 300.000 → `costDragAmount` = 2.300.000 → `costDragPercent` ≈ 0.46%. Dòng phụ dưới lãi/lỗ hiển thị: "Bao gồm 1.500.000 thuế + 800.000 phí (0.46% vốn đã bỏ ra mua)".
  - **Ca bán nhiều làm rõ vì sao không dùng vốn ròng:** mua 100.000.000, sau đó bán bớt thu về 80.000.000 → vốn ròng còn ~20.000.000; nếu chi phí luỹ kế 2.000.000 thì chia vốn ròng ra **10%** (hoảng), còn chia `grossInvested` = 100.000.000 ra **2%** (đúng cảm nhận "phí ăn 2% số tiền tôi từng rót vào").
