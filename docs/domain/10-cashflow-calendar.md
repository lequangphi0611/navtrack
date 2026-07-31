# Cash flow calendar (Lịch dòng tiền sắp tới)

## Mục đích
Cho biết trước những khoản tiền **dự kiến** sẽ phát sinh từ trái phiếu đang giữ — đáo hạn (nhận lại gốc) và coupon kỳ tới — để chủ động dòng tiền cá nhân. **Chỉ áp dụng cho `Holding{type: BOND}`**: cổ tức cổ phiếu/quỹ (`03-dividends.md`) không có ngày/mức cố định theo hợp đồng nên không đủ tin cậy để dự đoán, cố ý không đưa vào đây (quyết định `process/DECISION.md` 2026-07-17).

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

## Suy ra kỳ trả lãi tới

Cài đặt: `lib/bond-schedule.ts::computeNextCouponDate()` (thuần, không đụng DB — caller truyền `lastPaidCouponDate` đọc sẵn). Dùng chung cho tầng ghi trái tức (Phase 7 tự điền ngày + badge `KỲ n`), preview card "app suy ra" ở màn nhập điều khoản, và Phase 8 (lịch dòng tiền). Mọi phép tính ngày theo **UTC**; so sánh theo **NGÀY**, không theo giờ (`Dividend.date` lưu ở DB có thể mang phần giờ khác nhau tuỳ nguồn ghi).

**"Hôm nay" phải là hôm nay theo giờ Việt Nam.** Hàm ở `lib/bond-schedule.ts` thuần và nhận `today` từ caller — caller **bắt buộc** truyền `todayIctDateOnly()` (`lib/cutoff.ts`), không truyền `new Date()` thô. Lý do đã có tiền lệ trong repo (comment `lib/cutoff.ts`): code chạy trên Vercel theo giờ UTC, nên khung **00:00–06:59 giờ VN** sẽ tính "hôm nay" lùi một ngày → biên cửa sổ lịch lệch một ngày và nhãn "trễ N ngày" thiếu một. Phase 8 sửa lại cả 2 call site cũ của Phase 7 (`getBondHoldingActions`, `getBondCouponFormData`).

**Ngữ nghĩa `nextCouponDateOverride`: chỉ áp cho kỳ kế tiếp CHƯA ghi.** Cài đặt Phase 7 cho override thắng vô điều kiện — đúng khi lịch chỉ có một mốc "kỳ tới", nhưng sai ngay khi Phase 8 liệt kê nhiều kỳ trong một cửa sổ: override là *một* giá trị, không mô tả được cả lịch, và sau khi user đã ghi đúng kỳ đó thì lịch vẫn kẹt ở ngày override. Quy tắc: **bỏ qua override khi `lastPaidCouponDate >= nextCouponDateOverride`** (kỳ được override đã về tay) — từ đó trở đi lịch quay lại neo theo `firstCouponDate`. User đổi lịch tiếp thì nhập override mới.

```
nextCouponDate(bondTerms, dividends):
  nếu có nextCouponDateOverride  → dùng luôn (tổ chức phát hành đã đổi lịch)
  nếu thiếu firstCouponDate hoặc couponFrequencyMonths → không có kỳ tới (zero-coupon)
  lastPaid = max(date) của Dividend{type: BOND_COUPON} thuộc holding này (null nếu chưa ghi kỳ nào)
  mốc      = firstCouponDate + k × couponFrequencyMonths (k = 0, 1, 2...)
  return mốc đầu tiên > (lastPaid ?? hôm qua)   // luôn neo theo lịch hợp đồng, không theo ngày nhận thực tế
```

**Vì sao không lưu sẵn một giá trị cộng tay** (thiết kế cũ: `nextCouponDate += couponFrequencyMonths` sau mỗi lần ghi):
- **Lịch trôi dần.** Cộng từ *ngày nhận thực tế* thay vì *lịch hợp đồng* → mỗi lần tổ chức phát hành trả trễ 10 ngày, lịch trôi thêm 10 ngày và **tích luỹ** qua các kỳ.
- **Nhảy ngược về kỳ đã nhận.** Đã ghi kỳ 3/2026 và 9/2026, user ghi bù một kỳ 3/2025 bỏ sót → giá trị bị đẩy về 9/2025, tức một kỳ **đã về tay**, và lịch hiển thị nó như khoản sắp tới.
- **Trái với bất biến của repo:** đây là "cộng/trừ tay trên giá trị suy ra được" — đúng thứ mà `Holding.quantity`/`avgCost` cấm tuyệt đối (`02-data-model.md`). Khác `quantity`/`avgCost` ở chỗ suy lại **rẻ** (vài phép cộng tháng, không replay lịch sử), nên không có lý do materialize.
- **Sửa/xoá một `Dividend` không cần rollback gì** — công thức tự cho kết quả đúng ở lần đọc kế tiếp.

## Quy tắc & bất biến
- Chỉ xét `Holding{type: BOND, quantity > 0}` (vị thế đang mở) — bán/đáo hạn hết thì `quantity` về 0, tự động biến mất khỏi lịch (không cần lọc riêng).
- **Thiếu field là bình thường, không phải lỗi:** `maturityDate`/`firstCouponDate`/`couponFrequencyMonths` là optional (user có thể chưa nhập, hoặc trái phiếu không có coupon định kỳ — chiết khấu/zero-coupon chỉ có `maturityDate`). Holding thiếu field liên quan đơn giản **không xuất hiện** ở mục tương ứng — khác nguyên tắc "thiếu `Setting` → báo lỗi cứng" (`09-settings.md`), vì đây là field nhập tay optional trên entity, không phải cấu hình hệ thống bắt buộc. (Ngoại lệ: **ghi** trái tức mà thiếu `parValue`/`couponRatePercent` thì báo lỗi — xem `03-dividends.md` mục "Ca biên" — vì lúc đó không tính được số tiền.)
- **Không có bước "cập nhật ngày kỳ tới" sau khi ghi trái tức.** `recordDividend` nhánh `BOND_COUPON` **không ghi gì** vào `BondTerms`; kỳ tới luôn suy runtime theo công thức ở mục trên. User vẫn sửa tay được qua `nextCouponDateOverride` khi tổ chức phát hành đổi lịch thật (cùng tinh thần `NavOverride`/`taxAmount` — giá trị tự động là gợi ý, không khoá).
  - **Ô nhập `nextCouponDateOverride` thuộc Phase 8** (Phase 7 chỉ có cột + logic ưu tiên, màn nhập điều khoản 7a chưa có ô). Bắt buộc làm cùng lịch dòng tiền: từ lúc có màn lịch, một ngày sai vì tổ chức phát hành đổi lịch sẽ hiển thị thường trực mà user **không có cách sửa** — sửa ngày trên form ghi trái tức chỉ sửa được *bản ghi*, không sửa được *lịch*.
- **Lịch sinh được cả khi thiếu `maturityDate`** (đổi ở Phase 8). `buildCouponSchedule()` của Phase 7 trả rỗng khi thiếu ngày đáo hạn vì không có mốc dừng — đúng cho ca "sinh toàn bộ lịch hợp đồng", nhưng lịch dòng tiền **đã có mốc dừng riêng là biên cửa sổ**. Quy tắc: mốc dừng = `min(maturityDate ?? +∞, biên trên của cửa sổ)`. Thiếu một field optional không được làm mất **toàn bộ** dòng coupon của một trái phiếu — đó là mất dữ liệu có thật, không phải "bỏ qua mục không tính được".
- **Chỉ là dự kiến, không phải giao dịch/cam kết:** UI phải ghi rõ "dự kiến" — số tiền ước tính có thể lệch giao dịch thật khi ghi nhận (đáo hạn có thể sớm/muộn hơn, coupon rate có thể đổi với trái phiếu lãi suất thả nổi — ngoài phạm vi model hiện tại, giả định lãi suất cố định).
- **Hiển thị cả số gộp lẫn ước tính thực nhận** (đổi ở Phase 8 — trước đó cố ý chỉ hiện số gộp). Số **gộp** là số chính (khớp con số user đối chiếu với sao kê của tổ chức phát hành), kèm **dòng phụ "≈ … sau thuế N%"**. Lý do đảo: mục đích của màn này là *lập kế hoạch chi tiêu*, mà tiền vào tài khoản là tiền **sau thuế** — hiện số gộp cho một trái phiếu doanh nghiệp là chênh 5% ngay từ đầu. Lập luận cũ ("số chính xác chỉ có khi ghi nhận thật") đúng cho việc **ghi sổ**, không đúng cho việc **dự trù dòng tiền**; và cả hai con số đều nằm dưới nhãn "dự kiến".
  - **Coupon:** thuế theo `issuerType` (`BOND_INTEREST_TAX_RATE_CORPORATE` 5% / `_GOVERNMENT` 0%), resolve **effective-dated theo ngày trả lãi của chính mốc đó**, không theo hôm nay — một kỳ rơi sau ngày đổi chính sách phải hiện đúng mức mới (cùng quy tắc `getBondCouponFormData` đã dùng).
  - **Đáo hạn:** ước tính nhận về = `parValue × quantity`, **không** chịu `SALE_TAX_BOND` 0.1% (đáo hạn ghi bằng `Cashflow{type: MATURITY}`, chốt ở Phase 7). Phần lợi tức của trái phiếu **mua chiết khấu** vẫn chịu thuế lãi: ước tính thực nhận = `parValue × quantity − max(0, (parValue − avgCost) × quantity) × thuế lãi theo issuerType` — đúng công thức `settleMaturity` đang prefill, dùng lại, không cài lại.
  - Ước tính thực nhận **không trừ phí**: đáo hạn không đi qua lệnh khớp CTCK nên `feeAmount` mặc định `0` (quyết định 2026-07-29 (4)).

## Cách tính

### Cửa sổ
**Hai chiều: `[hôm nay − 180 ngày, hôm nay + 90 ngày]`** (hôm nay theo giờ VN, xem mục "Suy ra kỳ trả lãi tới").

- **Chiều tới (90 ngày)** — mặc định hiển thị, đổi được sang 30/180 bằng bộ chọn **client-side**. Là **hằng số + tuỳ chọn hiển thị**, cố ý **không** làm `Setting`: quy ước `09-settings.md` là thiếu `Setting` thì báo lỗi cứng, quá nặng cho một lựa chọn xem cho vui, và không có gì cần effective-dating.
- **Chiều lùi (180 ngày)** — chỉ để bắt các mục **đã tới hạn mà user chưa ghi**, không phải để xem lịch sử (lịch sử đã ghi nằm ở `DividendHistoryList`/`CashflowTimeline`). Giới hạn 180 ngày để một trái phiếu bị bỏ bê nhiều năm không đổ hàng chục dòng quá hạn vào màn hình.

### Các mục
- **Đáo hạn:** mỗi `Holding{type: BOND, quantity > 0}` có `bondTerms.maturityDate` trong cửa sổ → một mục. Ước tính nhận về = `parValue × quantity` (xem "Quy tắc & bất biến" cho ước tính thực nhận).
- **Coupon:** **mọi** mốc trả lãi trong cửa sổ, không chỉ kỳ kế tiếp. `couponFrequencyMonths` chỉ ràng buộc "số nguyên dương" nên trái phiếu trả **hàng quý** (`3`) có 1 kỳ và trả **hàng tháng** (`1`) có tới **3 kỳ** trong 90 ngày — chỉ hiện kỳ đầu là giấu mất phần lớn tiền vào, đúng con số mà user dùng để lập kế hoạch. Cách lấy: sinh lịch hợp đồng (`buildCouponSchedule`, mốc dừng theo quy tắc ở trên) rồi lọc mốc **nằm trong cửa sổ** và **`> lastPaidCouponDate`** (kỳ đã ghi thì biến mất khỏi lịch). Không dùng `computeNextCouponDate()` — hàm đó trả **một** mốc, đúng cho form ghi trái tức, không đủ cho lịch.
  - Ước tính từng kỳ (gộp, trước thuế) = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity`, `quantity` là **số lượng đang giữ hiện tại** (app không dự đoán được user sẽ mua/bán thêm) — ghi rõ trên UI.
- **Sắp xếp theo ngày**, gần nhất trước; mục quá hạn (ngày < hôm nay, chưa ghi) xếp **lên đầu** vì là việc cần làm ngay, không phải việc sắp tới.

### Tổng hợp
Danh sách trần không đủ để lập kế hoạch — bắt buộc có:
- **Tổng tiền dự kiến trong cửa sổ** (gộp + ước tính thực nhận), đổi theo bộ chọn 30/90/180.
- **Tổng theo tháng** cho phần chiều tới.
- Số mục **quá hạn chưa ghi**, tách khỏi tổng dự kiến (tiền đó lẽ ra đã về, không phải tiền sắp về).

## Trạng thái rỗng (bắt buộc phân biệt 3 ca)
Màn trống không lời giải thích là ca **phổ biến nhất** của tính năng này, không phải ca hiếm — bất biến "thiếu field optional thì holding không xuất hiện" đúng ở tầng domain nhưng lên UI sẽ thành "tính năng hỏng" nếu gộp cả ba ca vào một màn trống:
1. **Không có `Holding{type: BOND, quantity > 0}` nào** → ẩn hẳn khối lịch (kể cả card tóm tắt ở Dashboard). Người không giữ trái phiếu không cần biết tính năng này tồn tại.
2. **Có trái phiếu nhưng thiếu điều khoản** (chưa có `BondTerms`, hoặc có nhưng thiếu `maturityDate` *và* thiếu `firstCouponDate`/`couponFrequencyMonths` nên không sinh được mục nào) → nêu đích danh "N vị thế chưa đủ điều khoản để lên lịch" + link `ROUTES.bondTerms(id)` từng vị thế. Đây là ca duy nhất user **sửa được**, phải dẫn đường chứ không im lặng.
3. **Đủ điều khoản, cửa sổ không có mục nào** → "không có khoản nào tới hạn trong N ngày tới" + gợi ý đổi cửa sổ sang 180 ngày.

## Ca biên
- **Trái phiếu zero-coupon (chỉ đáo hạn, không coupon định kỳ):** để trống `couponRatePercent`/`couponFrequencyMonths`/`firstCouponDate` — chỉ xuất hiện ở mục đáo hạn.
- **Đã đáo hạn nhưng chưa ghi giao dịch tất toán:** `maturityDate` đã qua nhưng `quantity` vẫn > 0 (user quên ghi) → vẫn hiển thị, đổi trạng thái sang "đã quá hạn" thay vì ẩn đi, để nhắc người dùng ghi nhận.
- **Kỳ coupon đã qua mà chưa ghi:** cùng cách xử lý như đáo hạn quá hạn — badge "chưa ghi" + CTA ghi trái tức, **không** biến mất. Đây là lý do cửa sổ phải có chiều lùi: `computeNextCouponDate()` trả mốc nằm ở **quá khứ** khi user quên ghi (ngưỡng là `lastPaidCouponDate`), và khi **chưa ghi kỳ nào** thì ngưỡng là *hôm qua* nên mọi kỳ quá khứ bị bỏ qua hẳn — cửa sổ một chiều `[hôm nay, +90]` sẽ giấu đúng những mục cần nhắc nhất, cho đúng người cần nhắc nhất. Bất đối xứng "đáo hạn có badge quá hạn, coupon thì im lặng" là lỗi spec, không phải chủ ý.
- **Coupon trả trễ so với ngày dự kiến:** hệ thống không tự biết — vẫn hiển thị theo mốc suy ra từ lịch hợp đồng cho tới khi user ghi nhận kỳ đó (lúc đó mốc rời khỏi lịch vì `<= lastPaidCouponDate`) hoặc đặt `nextCouponDateOverride`. Vì mốc luôn neo theo `firstCouponDate`, **một kỳ trả trễ không làm lệch các kỳ sau**.
- **Coupon kỳ cuối trùng ngày đáo hạn:** hai mục sẽ cùng xuất hiện trên lịch tại cùng một ngày — đúng thực tế (tổ chức phát hành trả cả lãi kỳ cuối lẫn gốc). Khi ghi nhận thật, thứ tự có ràng buộc: trái tức tính trên số dư **trước** khi tất toán — xem `03-dividends.md` mục "Ca biên".
- **Không áp dụng cổ tức STOCK/FUND** — xem "Mục đích".

## Điểm vào & hành động
- **Mỗi mục phải hành động được tại chỗ** — link thẳng sang route đã có: `ROUTES.newDividend(holdingId)` cho mục coupon (form tự điền ngày kỳ + số tiền) và `ROUTES.maturitySettlement(holdingId)` cho mục đáo hạn. Một màn chỉ báo tin mà không nối sang chỗ ghi sẽ để user tự đi tìm, và họ sẽ không đi.
- **Hai bề mặt, một nguồn dữ liệu:** card tóm tắt ở Dashboard (2–3 mục gần nhất + tổng cửa sổ + số mục quá hạn) → link sang trang lịch đầy đủ. `BottomNav` giữ nguyên 3 tab, không thêm tab thứ tư cho một màn xem theo đợt.
- **Callout "quá đáo hạn" ở màn Danh mục** (mockup 7h, treo từ Phase 7) dùng đúng truy vấn batch của lịch — làm cùng Phase 8; `OverdueMaturityCard` đã dựng sẵn từ #57, mới chỉ có preview.

## Ghi chú cài đặt
- **Truy vấn phải batch theo `userId`, không lặp theo từng holding.** Phase 7 chỉ có `findLastBondCouponDate(holdingId, userId)` (một query/holding) và `findHoldingRows()` không select `bondTerms` → viết lịch bằng vòng lặp trên hai hàm đó là N+1. Phase 8 thêm ở `features/holdings/repository.ts`: một hàm lấy `Holding{type: BOND, quantity > 0}` **kèm** `BondTerms`, và một hàm `groupBy holdingId, _max: date` cho `Dividend{type: BOND_COUPON}`. Danh mục cá nhân nhỏ nên đây không phải vấn đề hiệu năng sống còn — làm đúng ngay vì rẻ hơn sửa sau, và vì `data-prisma.md` cấm truy vấn Prisma ngoài `repository.ts`.
- **Không cài lại công thức lịch.** Mọi phép tính mốc coupon đi qua `lib/bond-schedule.ts`; Phase 8 được **mở rộng** hàm ở đó (mốc dừng theo cửa sổ, ngữ nghĩa override) nhưng không được viết một bản song song trong `features/`.

## Ví dụ
- Trái phiếu doanh nghiệp X: `parValue = 100.000.000đ`, `couponRatePercent = 9%/năm`, `couponFrequencyMonths = 6`, `firstCouponDate = 15/01/2026`, giữ 2 trái phiếu, đã ghi trái tức kỳ 15/01 → mốc 15/07/2026 nằm trong cửa sổ → ước tính coupon gộp = `100.000.000 × 9% × 6/12 × 2 = 9.000.000đ`, dòng phụ `≈ 8.550.000đ sau thuế 5%` (doanh nghiệp; trái phiếu Chính phủ thì 0% và hai số bằng nhau).
- Trái phiếu Z trả **hàng tháng** (`couponFrequencyMonths = 1`), cửa sổ 90 ngày → **3 mục** riêng biệt ở 3 mốc, không phải 1.
- Trái phiếu Y đáo hạn trong 45 ngày, `parValue = 50.000.000đ`, `avgCost = 47.000.000đ` (mua chiết khấu), giữ 1 trái phiếu, doanh nghiệp → gộp = `50.000.000đ`; thực nhận ≈ `50.000.000 − max(0, 50.000.000 − 47.000.000) × 5% = 49.850.000đ`. Mua đúng mệnh giá thì hai số bằng nhau.
- Trái phiếu W có `firstCouponDate = 10/03/2026`, kỳ 6 tháng, user chưa từng ghi trái tức, hôm nay 31/07/2026 → mốc 10/03/2026 nằm trong chiều lùi 180 ngày → hiện mục **"chưa ghi"** kèm CTA, thay vì biến mất như cửa sổ một chiều.
