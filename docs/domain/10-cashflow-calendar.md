# Cash flow calendar (Lịch dòng tiền sắp tới)

## Mục đích
Cho biết trước những khoản tiền **dự kiến** sẽ phát sinh từ trái phiếu đang giữ — đáo hạn (nhận lại gốc) và coupon kỳ tới — để chủ động dòng tiền cá nhân. **Chỉ áp dụng cho `Holding{type: BOND}`**: cổ tức cổ phiếu/quỹ (`03-dividends.md`) không có ngày/mức cố định theo hợp đồng nên không đủ tin cậy để dự đoán, cố ý không đưa vào đây (quyết định `process/DECISION.md` 2026-07-17).

## Entity / field
- Mở rộng `Holding` (chỉ có ý nghĩa khi `type = BOND`, các loại khác luôn `null`):
  - `parValue` (Decimal, optional) — mệnh giá trái phiếu (đ), mỗi trái phiếu một mức khác nhau theo tổ chức phát hành.
  - `couponRatePercent` (Decimal, optional) — lãi suất coupon danh nghĩa (%/năm).
  - `couponFrequencyMonths` (Int, optional) — kỳ trả lãi tính theo tháng (vd `6` = nửa năm/lần, `12` = hàng năm).
  - `maturityDate` (DateTime, optional) — ngày đáo hạn.
  - `nextCouponDate` (DateTime, optional) — ngày dự kiến trả lãi kỳ tới.
- **Đảo quyết định treo của Phase 7** (`process/phase-7.md` điểm mở (1)): mệnh giá/coupon rate **lưu cố định trên `Holding`**, KHÔNG nhập tay lại mỗi lần ghi trái tức như đề xuất ban đầu — cần thiết để suy ra "kỳ tới" cho tính năng này. Trái tức (Phase 7) đọc `parValue`/`couponRatePercent` từ `Holding` khi ghi, không hỏi lại user mỗi lần.

## Quy tắc & bất biến
- Chỉ xét `Holding{type: BOND, quantity > 0}` (vị thế đang mở) — bán/đáo hạn hết thì `quantity` về 0, tự động biến mất khỏi lịch (không cần lọc riêng).
- **Thiếu field là bình thường, không phải lỗi:** `maturityDate`/`nextCouponDate` là optional trên `Holding` (user có thể chưa nhập khi tạo, hoặc trái phiếu không có coupon định kỳ — trái phiếu chiết khấu/zero-coupon chỉ có `maturityDate`). Holding thiếu field liên quan đơn giản **không xuất hiện** ở mục tương ứng — khác nguyên tắc "thiếu `Setting` → báo lỗi cứng" (`09-settings.md`), vì đây là field nhập tay optional trên entity, không phải cấu hình hệ thống bắt buộc.
- **`nextCouponDate` tự cập nhật sau khi ghi trái tức thành công:** Phase 7 `recordDividend` nhánh BOND cộng thêm `couponFrequencyMonths` vào `date` vừa ghi để suy ra kỳ tiếp theo, ghi lại `Holding.nextCouponDate`. Vẫn **cho user sửa tay** (giống các override khác trong app — `NavOverride`, `taxAmount`) vì tổ chức phát hành có thể đổi lịch trả thực tế.
- **Chỉ là dự kiến, không phải giao dịch/cam kết:** UI phải ghi rõ "dự kiến" — số tiền ước tính có thể lệch giao dịch thật khi ghi nhận (đáo hạn có thể sớm/muộn hơn, coupon rate có thể đổi với trái phiếu lãi suất thả nổi — ngoài phạm vi model hiện tại, giả định lãi suất cố định).
- **Ước tính đáo hạn KHÔNG trừ thuế** — nhất quán với quyết định "đáo hạn không phải chuyển nhượng, không chịu `SALE_TAX_BOND`" (`07-tax.md` mục "Ca biên"); cơ chế ghi nhận giao dịch đáo hạn thật (có tách khỏi SELL thường hay không) vẫn để ngỏ ở Phase 7.
- **Ước tính coupon hiển thị số gộp (trước thuế)** kèm ghi chú chưa trừ thuế — công thức thuế lãi trái phiếu chính xác (dùng chung `DIVIDEND_TAX_RATE` hay `Setting` riêng) là điểm còn mở của Phase 7 (`docs/domain/07-tax.md`), tính năng lịch này không tự chọn thay.

## Cách tính
- **Cửa sổ nhìn tới:** 90 ngày kể từ hôm nay (mặc định đề xuất, chỉnh lại lúc implement Phase 8 nếu cần).
- **Đáo hạn:** với mỗi `Holding{type: BOND, quantity > 0, maturityDate}` mà `maturityDate` nằm trong cửa sổ → liệt kê, ước tính nhận lại = `parValue × quantity`.
- **Coupon kỳ tới:** với mỗi `Holding{type: BOND, quantity > 0, nextCouponDate}` mà `nextCouponDate` nằm trong cửa sổ → liệt kê, ước tính (gộp, trước thuế) = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity`.
- Sắp xếp danh sách theo ngày gần nhất trước.

## Ca biên
- **Trái phiếu zero-coupon (chỉ đáo hạn, không coupon định kỳ):** để trống `couponRatePercent`/`couponFrequencyMonths`/`nextCouponDate` — chỉ xuất hiện ở mục đáo hạn.
- **Đã đáo hạn nhưng chưa ghi giao dịch tất toán:** `maturityDate` đã qua nhưng `quantity` vẫn > 0 (user quên ghi) → vẫn hiển thị, đổi trạng thái sang "đã quá hạn" thay vì ẩn đi, để nhắc người dùng ghi nhận.
- **Coupon trả trễ so với `nextCouponDate`:** hệ thống không tự biết — vẫn hiển thị theo ngày dự kiến cũ cho tới khi user ghi nhận (cập nhật `nextCouponDate`) hoặc tự sửa tay.
- **Không áp dụng cổ tức STOCK/FUND** — xem "Mục đích".

## Ví dụ
- Trái phiếu doanh nghiệp X: `parValue = 100.000.000đ`, `couponRatePercent = 9%/năm`, `couponFrequencyMonths = 6`, giữ 2 trái phiếu, `nextCouponDate` trong 30 ngày tới → ước tính coupon gộp = `100.000.000 × 9% × 6/12 × 2 = 9.000.000đ` (trước thuế).
- Trái phiếu Y đáo hạn trong 45 ngày, `parValue = 50.000.000đ`, giữ 1 trái phiếu → ước tính nhận lại = `50.000.000đ`, không trừ thuế.
