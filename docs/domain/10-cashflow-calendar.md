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
- **Chỉ là dự kiến, không phải giao dịch/cam kết:** UI phải ghi rõ "dự kiến" — số tiền ước tính có thể lệch giao dịch thật khi ghi nhận (đáo hạn có thể sớm/muộn hơn, coupon rate có thể đổi với trái phiếu lãi suất thả nổi — ngoài phạm vi model hiện tại, giả định lãi suất cố định).
- **Ước tính đáo hạn không trừ thuế chuyển nhượng** — đáo hạn ghi bằng `Cashflow{type: MATURITY}` (chốt ở Phase 7), không chịu `SALE_TAX_BOND` 0.1%. Lưu ý: với trái phiếu **mua chiết khấu**, phần lợi tức vẫn chịu thuế lãi khi tất toán thật (`07-tax.md`) — ước tính trên lịch là số **gộp**, ghi rõ như vậy.
- **Ước tính coupon hiển thị số gộp (trước thuế)** kèm ghi chú chưa trừ thuế. Mức thuế thật đã chốt ở Phase 7 (`BOND_INTEREST_TAX_RATE_CORPORATE` 5% / `_GOVERNMENT` 0%) — lịch **cố ý không tự trừ** vì đây là con số dự kiến, số chính xác chỉ có khi ghi nhận thật.

## Cách tính
- **Cửa sổ nhìn tới:** 90 ngày kể từ hôm nay (mặc định đề xuất, chỉnh lại lúc implement Phase 8 nếu cần).
- **Đáo hạn:** với mỗi `Holding{type: BOND, quantity > 0}` có `bondTerms.maturityDate` nằm trong cửa sổ → liệt kê, ước tính nhận lại = `parValue × quantity`.
- **Coupon kỳ tới:** với mỗi `Holding{type: BOND, quantity > 0}` mà `nextCouponDate` **suy ra được** (xem mục "Suy ra kỳ trả lãi tới") nằm trong cửa sổ → liệt kê, ước tính (gộp, trước thuế) = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity`.
- Sắp xếp danh sách theo ngày gần nhất trước.

## Ca biên
- **Trái phiếu zero-coupon (chỉ đáo hạn, không coupon định kỳ):** để trống `couponRatePercent`/`couponFrequencyMonths`/`firstCouponDate` — chỉ xuất hiện ở mục đáo hạn.
- **Đã đáo hạn nhưng chưa ghi giao dịch tất toán:** `maturityDate` đã qua nhưng `quantity` vẫn > 0 (user quên ghi) → vẫn hiển thị, đổi trạng thái sang "đã quá hạn" thay vì ẩn đi, để nhắc người dùng ghi nhận.
- **Coupon trả trễ so với ngày dự kiến:** hệ thống không tự biết — vẫn hiển thị theo mốc suy ra từ lịch hợp đồng cho tới khi user ghi nhận kỳ đó (lúc đó công thức tự nhảy sang mốc kế tiếp) hoặc đặt `nextCouponDateOverride`. Vì mốc luôn neo theo `firstCouponDate`, **một kỳ trả trễ không làm lệch các kỳ sau**.
- **Coupon kỳ cuối trùng ngày đáo hạn:** hai mục sẽ cùng xuất hiện trên lịch tại cùng một ngày — đúng thực tế (tổ chức phát hành trả cả lãi kỳ cuối lẫn gốc). Khi ghi nhận thật, thứ tự có ràng buộc: trái tức tính trên số dư **trước** khi tất toán — xem `03-dividends.md` mục "Ca biên".
- **Không áp dụng cổ tức STOCK/FUND** — xem "Mục đích".

## Ví dụ
- Trái phiếu doanh nghiệp X: `parValue = 100.000.000đ`, `couponRatePercent = 9%/năm`, `couponFrequencyMonths = 6`, `firstCouponDate = 15/01/2026`, giữ 2 trái phiếu, đã ghi trái tức kỳ 15/01 → kỳ tới suy ra = **15/07/2026**, nằm trong cửa sổ → ước tính coupon gộp = `100.000.000 × 9% × 6/12 × 2 = 9.000.000đ` (trước thuế; thuế thật 5% nếu là trái phiếu doanh nghiệp, 0% nếu trái phiếu Chính phủ).
- Trái phiếu Y đáo hạn trong 45 ngày, `parValue = 50.000.000đ`, giữ 1 trái phiếu → ước tính nhận lại = `50.000.000đ`, không trừ thuế.
