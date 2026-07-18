# Phase 8 — Lịch dòng tiền sắp tới (trái phiếu)

## Mục tiêu
Hiển thị danh sách các khoản tiền **dự kiến** sắp phát sinh từ trái phiếu đang giữ — đáo hạn và coupon kỳ tới — để chủ động dòng tiền cá nhân. Xem `docs/domain/10-cashflow-calendar.md` cho spec đầy đủ.

## Công việc cần làm
- [ ] Query tổng hợp: liệt kê `Holding{type: BOND, quantity > 0}` có `maturityDate` hoặc `nextCouponDate` nằm trong cửa sổ 90 ngày tới, sắp xếp theo ngày gần nhất
- [ ] Tính ước tính từng mục: đáo hạn = `parValue × quantity` (không trừ thuế); coupon = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity` (gộp, trước thuế, ghi rõ chưa trừ thuế)
- [ ] UI: màn/section riêng liệt kê lịch — vị trí cụ thể (link từ dashboard hay trang riêng) chốt lúc lên plan chi tiết; badge "đã quá hạn" khi `maturityDate` đã qua nhưng `quantity` vẫn > 0
- [ ] Bỏ qua Holding thiếu field liên quan (không phải lỗi — field optional trên `Holding`)

## Tiêu chí hoàn thành
- [ ] Danh sách hiển thị đúng các mục trong cửa sổ 90 ngày, đúng công thức ước tính
- [ ] Holding thiếu `maturityDate`/`nextCouponDate` không xuất hiện ở mục tương ứng, không báo lỗi
- [ ] Mọi số tiền có nhãn rõ "dự kiến", không nhầm với giao dịch thật đã ghi
- [ ] Trái phiếu đã đáo hạn quá hạn nhưng chưa tất toán hiển thị trạng thái "đã quá hạn" thay vì biến mất

## Phụ thuộc / ghi chú
- **Phụ thuộc chặt Phase 7:** cần 5 field mới trên `Holding` (`parValue`/`couponRatePercent`/`couponFrequencyMonths`/`maturityDate`/`nextCouponDate`) do Phase 7 thêm — Phase 8 chỉ đọc, không tự thêm schema.
- Chỉ áp dụng cho `BOND` — không dự đoán cổ tức STOCK/FUND (không đủ dữ liệu tin cậy để dự đoán ngày/mức, xem `docs/domain/10-cashflow-calendar.md` mục "Mục đích").
- Không phải trình tự ưu tiên gốc (giống Phase 7) — chỉ làm khi có nhu cầu, không chặn các phase khác.
