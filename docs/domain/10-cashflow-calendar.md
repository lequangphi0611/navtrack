# Cash flow calendar (Lịch dòng tiền sắp tới)

## Mục đích
Hai việc, không phải một:
1. **Cho biết trước** những khoản tiền **dự kiến** sẽ phát sinh từ trái phiếu đang giữ — đáo hạn (nhận lại gốc) và **mọi kỳ trả lãi** trong cửa sổ — để chủ động dòng tiền cá nhân.
2. **Nhắc những khoản đã tới hạn mà chưa ghi nhận** — đáo hạn quá hạn và kỳ trả lãi đã qua mà chưa có `Dividend` tương ứng. Đây là lý do cửa sổ có chiều lùi (xem "Cách tính"). 
**Chỉ áp dụng cho `Holding{type: BOND}`**: cổ tức cổ phiếu/quỹ (`03-dividends.md`) không có ngày/mức cố định theo hợp đồng nên không đủ tin cậy để dự đoán, cố ý không đưa vào đây (quyết định `process/DECISION.md` 2026-07-17).

## Entity / field
Bảng riêng **`BondTerms`** (1-1 với `Holding`, chỉ tồn tại khi `type = BOND`) — **không** phải các cột nullable trên `Holding` như thiết kế ban đầu. Lý do tách bảng ghi ở `docs/02-data-model.md` mục "Ghi chú thiết kế".

| field | bắt buộc | ý nghĩa |
|---|---|---|
| `issuerType` | có | `CORPORATE`/`GOVERNMENT` — quyết định thuế lãi (`07-tax.md`) |
| `parValue` | có | mệnh giá **một** trái phiếu (đ) |
| `couponRatePercent` | không | lãi suất coupon danh nghĩa (%/năm); trống = zero-coupon |
| `couponFrequencyMonths` | không | kỳ trả lãi theo tháng (`6` = nửa năm/lần, `12` = hàng năm) |
| `firstCouponDate` | không | **mốc neo** của lịch coupon — ngày trả lãi kỳ đầu theo hợp đồng |
| `maturityDate` | không | ngày đáo hạn |
| `nextCouponDateOverride` | không | chỉ dùng khi tổ chức phát hành đổi lịch thực tế |

- **Mệnh giá/coupon rate lưu cố định** (đã chốt 2026-07-17, giữ nguyên): trái tức đọc từ `BondTerms` khi ghi, không hỏi lại user mỗi lần.
- **KHÔNG có field `nextCouponDate` cộng tay** (đảo thiết kế cũ, chốt 2026-07-25) — xem mục kế tiếp.

## Lịch trả lãi: suy mốc & "hôm nay"

Cài đặt: `lib/bond-schedule.ts` (thuần, không đụng DB — caller truyền lịch sử `Dividend` đọc sẵn). Mọi phép tính ngày theo **UTC**; so sánh theo **NGÀY**, không theo giờ (`Dividend.date` lưu ở DB có thể mang phần giờ khác nhau tuỳ nguồn ghi).

**Hai phép suy khác nhau, đừng dùng lẫn** — cùng neo `firstCouponDate` nhưng trả về thứ khác nhau và phục vụ màn khác nhau:

```
# (A) MỘT mốc — form ghi trái tức tự điền ngày + badge "KỲ n", card "app suy ra" ở màn 7a.
#     computeNextCouponDate() — Phase 7, giữ nguyên.
nextCouponDate(bondTerms, lastPaidCouponDate, today):
  nếu có nextCouponDateOverride VÀ (chưa ghi kỳ nào HOẶC lastPaid < override)
      → dùng override (tổ chức phát hành đã đổi lịch, kỳ đó chưa về tay)
  nếu thiếu firstCouponDate hoặc couponFrequencyMonths → không có kỳ tới (zero-coupon)
  lastPaid = max(date) của Dividend{type: BOND_COUPON} thuộc holding này (null nếu chưa ghi kỳ nào)
  mốc      = firstCouponDate + k × couponFrequencyMonths (k = 0, 1, 2...)
  return mốc đầu tiên > (lastPaid ?? hôm qua)   // neo lịch hợp đồng, không theo ngày nhận thực tế

# (B) CẢ LỊCH trong cửa sổ — màn lịch dòng tiền (Phase 8).
#     KHÔNG gọi (A) rồi bọc lại: (A) trả một mốc nên sẽ giấu kỳ thứ 2/3 của trái phiếu
#     trả hàng tháng/quý, và lọc theo max(date) sẽ giấu kỳ cũ bị bỏ sót (xem "Cách tính").
couponScheduleInWindow(bondTerms, couponDatesĐãGhi[], window):
  mốc   = firstCouponDate + k × couponFrequencyMonths, dừng ở min(maturityDate ?? +∞, window.đến)
  giữ    mốc nằm trong [window.từ, window.đến]
  loại   mốc đã có Dividend{BOND_COUPON} gán vào (đối chiếu TỪNG MỐC, không phải max)
  return danh sách mốc còn lại, kèm cờ "quá hạn/chưa ghi" khi mốc < hôm nay
```

**"Hôm nay" phải là hôm nay theo giờ Việt Nam.** Hàm ở `lib/bond-schedule.ts` thuần và nhận `today` từ caller (bản thân file không tự gọi `new Date()` để lấy hôm nay) — **caller bắt buộc truyền `todayIctDateOnly()`** (`lib/cutoff.ts`), không truyền `new Date()` thô. Lý do đã có tiền lệ: code chạy trên Vercel theo giờ UTC, nên khung **00:00–06:59 giờ VN** sẽ tính "hôm nay" lùi một ngày → biên cửa sổ lệch một ngày, nhãn "trễ N ngày" thiếu một. Chính lớp bug này đã được sửa một lần ở Phase 2 cho mốc chốt định giá (comment `lib/cutoff.ts`). Không xung đột với "mọi phép tính theo UTC" ở trên: `todayIctDateOnly()` trả `Date.UTC(y, m, d, 0, 0, 0)` của **ngày lịch ICT**, đúng hình dạng `startOfUtcDay()` sinh ra — chỉ khác ở chỗ *chọn ngày nào*.

Phase 8 rà **mọi** chỗ lấy "hôm nay" trong luồng trái phiếu, không chỉ màn lịch — tính tới hết Phase 7 có 4 chỗ: `getBondHoldingActions` (`startOfUtcDay(new Date())`), `getBondCouponFormData` (`new Date()` thô, dùng cho cả ngưỡng lịch lẫn `atDate` resolve thuế), `getMaturitySettlementData` (`maturityDate ?? new Date()`), `computeBondTermsPreview` (mặc định tham số `today = new Date()` — ở đây là giờ máy user, khác 3 chỗ kia nhưng cùng triệu chứng).

**Ngữ nghĩa `nextCouponDateOverride`: chỉ áp cho kỳ kế tiếp CHƯA ghi.** Cài đặt Phase 7 cho override thắng vô điều kiện — đúng khi lịch chỉ có một mốc "kỳ tới", nhưng sai ngay khi Phase 8 liệt kê nhiều kỳ trong một cửa sổ: override là *một* giá trị, không mô tả được cả lịch, và sau khi user đã ghi đúng kỳ đó thì lịch vẫn kẹt ở ngày override. Quy tắc: **bỏ qua override khi `lastPaidCouponDate >= nextCouponDateOverride`** (kỳ được override đã về tay) — từ đó trở đi lịch quay lại neo theo `firstCouponDate`. User đổi lịch tiếp thì nhập override mới.

**Vì sao không lưu sẵn một giá trị cộng tay** (thiết kế cũ: `nextCouponDate += couponFrequencyMonths` sau mỗi lần ghi):
- **Lịch trôi dần.** Cộng từ *ngày nhận thực tế* thay vì *lịch hợp đồng* → mỗi lần tổ chức phát hành trả trễ 10 ngày, lịch trôi thêm 10 ngày và **tích luỹ** qua các kỳ.
- **Nhảy ngược về kỳ đã nhận.** Đã ghi kỳ 3/2026 và 9/2026, user ghi bù một kỳ 3/2025 bỏ sót → giá trị bị đẩy về 9/2025, tức một kỳ **đã về tay**, và lịch hiển thị nó như khoản sắp tới.
- **Trái với bất biến của repo:** đây là "cộng/trừ tay trên giá trị suy ra được" — đúng thứ mà `Holding.quantity`/`avgCost` cấm tuyệt đối (`02-data-model.md`). Khác `quantity`/`avgCost` ở chỗ suy lại **rẻ** (vài phép cộng tháng, không replay lịch sử), nên không có lý do materialize.
- **Sửa/xoá một `Dividend` không cần rollback gì** — công thức tự cho kết quả đúng ở lần đọc kế tiếp.

## Quy tắc & bất biến
- Chỉ xét `Holding{type: BOND, quantity > 0}` (vị thế đang mở) — bán/đáo hạn hết thì `quantity` về 0, tự động biến mất khỏi lịch (không cần lọc riêng).
- **Thiếu field là bình thường, không phải lỗi:** `maturityDate`/`firstCouponDate`/`couponFrequencyMonths` là optional (user có thể chưa nhập, hoặc trái phiếu không có coupon định kỳ — chiết khấu/zero-coupon chỉ có `maturityDate`). Holding thiếu field liên quan đơn giản **không xuất hiện** ở mục tương ứng — riêng `maturityDate` chỉ ảnh hưởng mục **đáo hạn**, không còn chặn lịch trả lãi (xem gạch đầu dòng bên dưới). Khác nguyên tắc "thiếu `Setting` → báo lỗi cứng" (`09-settings.md`), vì đây là field nhập tay optional trên entity, không phải cấu hình hệ thống bắt buộc. (Ngoại lệ: **ghi** trái tức mà thiếu `parValue`/`couponRatePercent` thì báo lỗi — xem `03-dividends.md` mục "Ca biên" — vì lúc đó không tính được số tiền.)
- **Không có bước "cập nhật ngày kỳ tới" sau khi ghi trái tức.** `recordDividend` nhánh `BOND_COUPON` **không ghi gì** vào `BondTerms`; kỳ tới luôn suy runtime theo công thức ở mục trên. User vẫn sửa tay được qua `nextCouponDateOverride` khi tổ chức phát hành đổi lịch thật (cùng tinh thần `NavOverride`/`taxAmount` — giá trị tự động là gợi ý, không khoá).
  - **Ô nhập `nextCouponDateOverride` thuộc Phase 8** (Phase 7 chỉ có cột + logic ưu tiên, màn nhập điều khoản 7a chưa có ô). Bắt buộc làm cùng lịch dòng tiền: từ lúc có màn lịch, một ngày sai vì tổ chức phát hành đổi lịch sẽ hiển thị thường trực mà user **không có cách sửa** — sửa ngày trên form ghi trái tức chỉ sửa được *bản ghi*, không sửa được *lịch*.
- **Lịch sinh được cả khi thiếu `maturityDate`** (đổi ở Phase 8). `buildCouponSchedule()` của Phase 7 trả rỗng khi thiếu ngày đáo hạn vì không có mốc dừng — đúng cho ca "sinh toàn bộ lịch hợp đồng", nhưng lịch dòng tiền **đã có mốc dừng riêng là biên cửa sổ**. Quy tắc: mốc dừng = `min(maturityDate ?? +∞, biên trên của cửa sổ)`. Thiếu một field optional không được làm mất **toàn bộ** dòng coupon của một trái phiếu — đó là mất dữ liệu có thật, không phải "bỏ qua mục không tính được".
- **Chỉ là dự kiến, không phải giao dịch/cam kết:** UI phải ghi rõ "dự kiến" — số tiền ước tính có thể lệch giao dịch thật khi ghi nhận (đáo hạn có thể sớm/muộn hơn, coupon rate có thể đổi với trái phiếu lãi suất thả nổi — ngoài phạm vi model hiện tại, giả định lãi suất cố định).
- **Hiển thị cả số gộp lẫn ước tính thực nhận** (đổi ở Phase 8 — trước đó cố ý chỉ hiện số gộp). Lý do đảo: mục đích của màn này là *lập kế hoạch chi tiêu*, mà tiền vào tài khoản là tiền **sau thuế** — hiện mỗi số gộp cho một trái phiếu doanh nghiệp là chênh 5% ngay từ đầu. Lập luận cũ ("số chính xác chỉ có khi ghi nhận thật") đúng cho việc **ghi sổ**, không đúng cho việc **dự trù dòng tiền**; và cả hai con số đều nằm dưới nhãn "dự kiến". Công thức ở "Cách tính > Ước tính tiền".

## Cách tính

### Cửa sổ
**Hai chiều: `[hôm nay − 180 ngày, hôm nay + N ngày]`**, `N` mặc định 90, chọn được 30/90/180 (hôm nay theo giờ VN, xem mục trên).

- **Chiều tới (`N`)** — là **hằng số + tuỳ chọn hiển thị**, cố ý **không** làm `Setting`: quy ước `09-settings.md` là thiếu `Setting` thì báo lỗi cứng, quá nặng cho một lựa chọn xem cho vui, và không có gì cần effective-dating.
- **Chiều lùi (180 ngày, cố định)** — bắt các mục đã tới hạn mà user chưa ghi (mục đích 2), không phải để xem lịch sử (lịch sử đã ghi nằm ở `DividendHistoryList`/`CashflowTimeline`). Giới hạn 180 ngày để một trái phiếu bị bỏ bê nhiều năm không đổ hàng chục dòng vào màn hình.
- **Tầng server luôn dựng lịch theo biên RỘNG NHẤT `[−180, +180]`; bộ chọn chỉ lọc lại ở client.** Nếu server cắt đúng `N` đang chọn thì đổi sang 180 sẽ không ra thêm mục nào, và lời khuyên "thử mở rộng cửa sổ" ở trạng thái rỗng (c) dẫn vào ngõ cụt. Dữ liệu thêm là vài mốc ngày, không đáng để đánh đổi lấy một round-trip.

### Các mục
- **Đáo hạn:** mỗi `Holding{type: BOND, quantity > 0}` có `bondTerms.maturityDate` trong cửa sổ → một mục.
- **Kỳ trả lãi:** **mọi** mốc trong cửa sổ, không chỉ kỳ kế tiếp. `couponFrequencyMonths` chỉ ràng buộc "số nguyên dương" nên trái phiếu trả **hàng quý** (`3`) có 1 kỳ và trả **hàng tháng** (`1`) có 3–4 kỳ trong 90 ngày — chỉ hiện kỳ đầu là giấu mất phần lớn tiền vào. Dùng `couponScheduleInWindow()`, **không** bọc `computeNextCouponDate()`.
- **"Mốc đã ghi" đối chiếu TỪNG MỐC, không phải `max(date)`.** `lastPaidCouponDate` (max) là đúng cho form ghi trái tức nhưng **sai cho lịch**, theo cả hai chiều:
  - Đã ghi kỳ 15/07 nhưng **bỏ sót kỳ 15/01** → lọc theo `> max` sẽ giấu luôn kỳ 15/01. Đó đúng là ca "ghi bù kỳ bỏ sót" mà cả thiết kế neo `firstCouponDate` được dựng lên để phục vụ (`02-data-model.md`), và cũng đúng ca mà chiều lùi sinh ra để bắt → chiều lùi thành vô dụng.
  - Ghi **sớm** hơn mốc hợp đồng (trả 10/07 cho kỳ 15/07 — hợp lệ) → `max < mốc` nên mốc 15/07 vẫn hiện kèm CTA → user bấm vào và **ghi trùng kỳ**.
  - **Quy tắc gán:** mỗi `Dividend{BOND_COUPON}` gán vào **mốc gần nhất** trong lịch hợp đồng, với dung sai **± nửa kỳ** (`couponFrequencyMonths/2`) — tự co giãn theo loại trái phiếu (kỳ 1 tháng → ±15 ngày; kỳ 12 tháng → ±6 tháng, vẫn không nhập nhằng vì hai mốc cách nhau 12 tháng). Mốc có bản ghi gán vào → **không** xuất hiện trên lịch. Bản ghi không gán được vào mốc nào (user ghi một khoản lệch hẳn lịch hợp đồng — hợp lệ, `computeCouponPeriodIndex` đã trả `null` cho ca này) **không** làm mốc nào biến mất.
- **Sắp xếp:** theo ngày, gần nhất trước. Hai tie-break bắt buộc:
  - Nhóm **quá hạn/chưa ghi** (ngày < hôm nay) xếp lên đầu toàn danh sách, trong nhóm thì **cũ nhất trước** (khoản trễ lâu nhất là khoản đáng lo nhất).
  - **Cùng một ngày, kỳ trả lãi xếp TRƯỚC đáo hạn** — khớp bất biến `Dividend` trước `Cashflow{MATURITY}` (`03-dividends.md`). Không phải chuyện thẩm mỹ: user bấm CTA theo đúng thứ tự nhìn thấy, xếp ngược sẽ dẫn họ ghi tất toán trước → trái tức kỳ cuối tính trên số dư 0 → **0 đồng, sai âm thầm**.

### Ước tính tiền
Mỗi mục hiển thị **số gộp** (số chính, khớp con số đối chiếu với sao kê của tổ chức phát hành) + **dòng phụ "thực nhận"** (dùng đúng chữ "thực nhận" như màn tất toán 7e/7f, `07-tax.md`).

- **Kỳ trả lãi — gộp:** `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × SL`.
  - **`SL` (số lượng) theo mốc, không phải luôn luôn "hiện tại":** mốc **tương lai** dùng SL đang giữ hiện tại (app không dự đoán được user mua/bán thêm — ghi rõ giả định trên UI); mốc **quá khứ** dùng **SL tại ngày mốc** (`buildQuantityTimeline`), vì đó chính là cơ sở `recordBondCouponDividend` sẽ dùng khi user bấm CTA ghi. Hai bên tính trên hai cơ sở SL khác nhau là đúng lớp bug đã xảy ra và đã sửa ở Phase 7 (`DECISION.md` 2026-07-29 (3)) — lịch hiện X, ghi xong ra Y, không tín hiệu.
  - **Thực nhận:** trừ thuế theo `issuerType` (`BOND_INTEREST_TAX_RATE_CORPORATE` 5% / `_GOVERNMENT` 0%), resolve **effective-dated theo ngày của chính mốc đó**, không theo hôm nay — một kỳ rơi sau ngày đổi chính sách phải hiện đúng mức mới (cùng quy tắc `getBondCouponFormData` đã dùng).
- **Đáo hạn — gộp:** `parValue × quantity`, **không** chịu `SALE_TAX_BOND` 0.1% (đáo hạn ghi bằng `Cashflow{type: MATURITY}`, chốt ở Phase 7).
  - **Thực nhận:** `parValue × quantity − max(0, (parValue − avgCost) × quantity) × thuế lãi theo issuerType` — phần lợi tức của trái phiếu **mua chiết khấu** vẫn chịu thuế lãi. Dùng lại công thức `settleMaturity` đang prefill, không cài lại. `avgCost` lấy giá trị **hiện tại**: mua thêm trước ngày đáo hạn sẽ đổi số này, đúng như bản thân màn tất toán cũng tính lại lúc ghi.
  - **Không trừ phí:** đáo hạn không đi qua lệnh khớp CTCK nên `feeAmount` mặc định `0` (quyết định 2026-07-29 (4)).

### Tổng hợp
Danh sách trần không đủ để lập kế hoạch — bắt buộc có:
- **Tổng tiền dự kiến trong cửa sổ** (gộp + ước tính thực nhận), đổi theo bộ chọn 30/90/180.
- **Tổng theo tháng dương lịch** cho phần chiều tới (không phải "mỗi 30 ngày" — cửa sổ 30 ngày vẫn cắt ngang 2 tháng, và người dùng lập kế hoạch chi tiêu theo tháng lịch).
- Số mục **quá hạn chưa ghi**, tách khỏi tổng dự kiến (tiền đó lẽ ra đã về, không phải tiền sắp về).

## Trạng thái rỗng (bắt buộc phân biệt 3 ca)
Màn trống không lời giải thích là ca **phổ biến nhất** của tính năng này, không phải ca hiếm — bất biến "thiếu field optional thì holding không xuất hiện" đúng ở tầng domain nhưng lên UI sẽ thành "tính năng hỏng" nếu gộp cả ba ca vào một màn trống:
1. **Không có `Holding{type: BOND, quantity > 0}` nào** → ẩn hẳn khối lịch (kể cả card tóm tắt ở Dashboard). Người không giữ trái phiếu không cần biết tính năng này tồn tại.
2. **Có trái phiếu nhưng thiếu điều khoản.** Vị từ tường minh (để 2 người đọc ra cùng một cách cài): vị thế **không sinh được mục nào trong cửa sổ rộng nhất (±180)** VÀ thiếu ít nhất một trong hai: (a) `maturityDate`, (b) **cặp** `firstCouponDate` + `couponFrequencyMonths` (thiếu một trong hai là thiếu cả cặp — có `firstCouponDate` mà không có kỳ thì vẫn không sinh được mốc nào). Hiển thị "N vị thế chưa đủ điều khoản để lên lịch" + link `ROUTES.bondTerms(id)` từng vị thế. Đây là ca duy nhất user **sửa được**, phải dẫn đường chứ không im lặng.
3. **Đủ điều khoản, cửa sổ không có mục nào** → "không có khoản nào tới hạn trong N ngày tới" + gợi ý mở rộng cửa sổ (chỉ hiện gợi ý này khi `N < 180`; ở 180 mà vẫn trống thì không còn gì để mở rộng). Trái phiếu zero-coupon đủ điều khoản, đáo hạn còn 5 năm → rơi vào ca này, **không** phải ca (2).

## Ca biên
- **Trái phiếu zero-coupon (chỉ đáo hạn, không coupon định kỳ):** để trống `couponRatePercent`/`couponFrequencyMonths`/`firstCouponDate` — chỉ xuất hiện ở mục đáo hạn.
- **Đã đáo hạn nhưng chưa ghi giao dịch tất toán:** `maturityDate` đã qua nhưng `quantity` vẫn > 0 (user quên ghi) → vẫn hiển thị, đổi trạng thái sang "đã quá hạn" thay vì ẩn đi, để nhắc người dùng ghi nhận.
- **Kỳ trả lãi đã qua mà chưa ghi:** cùng cách xử lý như đáo hạn quá hạn — badge "chưa ghi" + CTA ghi trái tức, **không** biến mất. Đây là lý do cửa sổ phải có chiều lùi: mốc quá hạn nằm ngoài `[hôm nay, +N]`, và khi user **chưa ghi kỳ nào** thì ngưỡng mặc định của phép suy một-mốc là *hôm qua* nên mọi kỳ quá khứ bị bỏ qua hẳn — cửa sổ một chiều sẽ giấu đúng những mục cần nhắc nhất, cho đúng người cần nhắc nhất. Bất đối xứng "đáo hạn có badge quá hạn, kỳ trả lãi thì im lặng" là lỗi spec, không phải chủ ý.
- **Kỳ trả lãi trả trễ so với ngày dự kiến:** hệ thống không tự biết — vẫn hiển thị theo mốc lịch hợp đồng cho tới khi user ghi kỳ đó (bản ghi gán vào mốc theo quy tắc ± nửa kỳ, mốc rời khỏi lịch) hoặc đặt `nextCouponDateOverride`. Vì mốc luôn neo `firstCouponDate`, **một kỳ trả trễ không làm lệch các kỳ sau**.
- **Kỳ trả lãi cuối trùng ngày đáo hạn:** hai mục cùng xuất hiện tại cùng một ngày — đúng thực tế (tổ chức phát hành trả cả lãi kỳ cuối lẫn gốc). Thứ tự hiển thị **bắt buộc** kỳ trả lãi trước đáo hạn (xem "Cách tính > Sắp xếp") vì user sẽ ghi theo thứ tự nhìn thấy, và ghi tất toán trước sẽ làm trái tức kỳ cuối ra 0 đồng — xem `03-dividends.md` mục "Ca biên".
- **Không áp dụng cổ tức STOCK/FUND** — xem "Mục đích".

## Điểm vào & hành động
- **Mỗi mục phải hành động được tại chỗ** — link thẳng sang route đã có: `ROUTES.newDividend(holdingId)` cho mục kỳ trả lãi và `ROUTES.maturitySettlement(holdingId)` cho mục đáo hạn. Một màn chỉ báo tin mà không nối sang chỗ ghi sẽ để user tự đi tìm, và họ sẽ không đi.
  - **CTA phải mang theo mốc:** thêm query param `?couponDate=yyyy-MM-dd`, `getBondCouponFormData()` nhận mốc tuỳ chọn và prefill đúng mốc đó (route `/holdings/[id]/dividends/new` hiện chỉ nhận `params`, và prefill đi qua `computeNextCouponDate()` — tức luôn trả **kỳ chưa ghi đầu tiên**). Không có param này thì bấm mục thứ 2/3 của trái phiếu trả hàng tháng sẽ mở form điền ngày của mục thứ nhất, và ca quá hạn còn nguy hơn vì user không có lý do nghi ngờ ngày prefill. Param chỉ là **gợi ý prefill**, vẫn sửa được, và server vẫn tính lại mọi con số theo ngày thật được submit.
- **Hai bề mặt, một nguồn dữ liệu:** card tóm tắt ở Dashboard → link sang trang lịch đầy đủ. `BottomNav` giữ nguyên 3 tab, không thêm tab thứ tư cho một màn xem theo đợt.
  - Card hiện **2–3 mục SẮP TỚI gần nhất** + tổng cửa sổ; mục quá hạn **không** chen vào danh sách này mà chỉ đếm ở một badge riêng ("N khoản quá hạn chưa ghi" → link sang trang đầy đủ). Nếu để mục quá hạn xếp lên đầu như ở trang đầy đủ, một danh mục bỏ bê sẽ có card "Sắp tới" toàn mục quá hạn và không hiện đồng nào sắp về — ngược hẳn mục đích của card.
- **Callout "quá đáo hạn" ở màn Danh mục** (mockup 7h, treo từ Phase 7) dùng đúng truy vấn batch của lịch — làm cùng Phase 8; `OverdueMaturityCard` đã dựng sẵn từ #57, mới chỉ có preview.

## Ghi chú cài đặt
- **Truy vấn phải batch theo `userId`, không lặp theo từng holding.** Phase 7 chỉ có `findLastBondCouponDate(holdingId, userId)` (một query/holding) và `findHoldingRows()` không select `bondTerms` → viết lịch bằng vòng lặp trên hai hàm đó là N+1. Phase 8 thêm ở `features/holdings/repository.ts`: (a) một hàm lấy `Holding{type: BOND, quantity > 0}` **kèm** `BondTerms`; (b) một hàm trả **danh sách** `Dividend{BOND_COUPON}.date` trong cửa sổ cho **nhiều** holding — **không** phải `groupBy _max: date`, vì gán mốc là đối chiếu từng mốc (xem "Cách tính"); một hàm chỉ trả max về cấu trúc không thể phục vụ việc đó, chốt nhầm là khoá cứng lỗi vào tầng dữ liệu. `findLastBondCouponDate` (max) vẫn giữ nguyên cho form ghi trái tức. Danh mục cá nhân nhỏ nên đây không phải vấn đề hiệu năng sống còn — làm đúng ngay vì rẻ hơn sửa sau, và vì `data-prisma.md` cấm truy vấn Prisma ngoài `repository.ts`.
- **Thuế cũng phải batch — `resolveDecimalSetting()` là một query mỗi lần gọi.** Quy tắc "resolve theo ngày của chính mốc đó" nghĩa là N mốc = N `atDate` khác nhau; gọi `resolveDecimalSetting`/`resolveSettings` trong vòng lặp là đúng N+1 vừa cấm ở trên, chỉ đổi bảng. Cách đúng đã có sẵn: đọc rows của 2 key `BOND_INTEREST_TAX_RATE_*` **một lần** (`findSettingRowsByKeys`) rồi `pickEffectiveSetting()` cho từng mốc trong bộ nhớ.
- **Không cài lại công thức lịch.** Mọi phép tính mốc đi qua `lib/bond-schedule.ts`; Phase 8 **mở rộng** hàm ở đó (mốc dừng theo cửa sổ, gán mốc theo dung sai, ngữ nghĩa override) chứ không viết bản song song trong `features/`.
  - **Dọn luôn một bản song song đã có:** `countRemainingCouponPeriods()` (`lib/bond-schedule.ts`) hiện **không có call site production nào** (chỉ có test), trong khi `bond-terms-preview.ts` cài lại đúng logic đó inline (`schedule.filter(> today).length`). Phase 8 gọi hàm chung ở cả hai chỗ hoặc xoá hàm thừa — đừng thêm cái thứ ba.

## Ví dụ
- Trái phiếu doanh nghiệp X: `parValue = 100.000.000đ`, `couponRatePercent = 9%/năm`, `couponFrequencyMonths = 6`, `firstCouponDate = 15/01/2026`, giữ 2 trái phiếu, đã ghi trái tức kỳ 15/01 → mốc 15/07/2026 nằm trong cửa sổ → gộp = `100.000.000 × 9% × 6/12 × 2 = 9.000.000đ`, dòng phụ `thực nhận ≈ 8.550.000đ (đã trừ thuế 5%)` (trái phiếu Chính phủ thì 0% và hai số bằng nhau).
- Trái phiếu Z trả **hàng tháng** (`couponFrequencyMonths = 1`), `firstCouponDate = 05/01/2026`, hôm nay 31/07/2026, cửa sổ 90 ngày (tới 29/10) → **3 mục** riêng biệt: 05/08, 05/09, 05/10 (mốc 05/11 rơi ngoài cửa sổ). Có thể ra **4 mục** khi cửa sổ rơi vào các tháng ngắn: hôm nay 04/02 → cửa sổ tới 05/05, ôm trọn 05/02, 05/03, 05/04, 05/05 (tháng 2+3+4 chỉ 89 ngày). Số mục phụ thuộc vị trí mốc và độ dài tháng, không cố định.
- Trái phiếu Y đáo hạn trong 45 ngày, `parValue = 50.000.000đ`, `avgCost = 47.000.000đ` (mua chiết khấu), giữ 1 trái phiếu, doanh nghiệp → gộp = `50.000.000đ`; thực nhận ≈ `50.000.000 − max(0, 50.000.000 − 47.000.000) × 5% = 49.850.000đ`. Mua đúng mệnh giá thì hai số bằng nhau.
- Trái phiếu W có `firstCouponDate = 10/03/2026`, kỳ 6 tháng, user chưa từng ghi trái tức, hôm nay 31/07/2026 → mốc 10/03/2026 nằm trong chiều lùi 180 ngày → hiện mục **"chưa ghi"** kèm CTA, thay vì biến mất như cửa sổ một chiều.
