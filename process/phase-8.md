# Phase 8 — Lịch dòng tiền sắp tới (trái phiếu)

## Mục tiêu
Hiển thị danh sách các khoản tiền **dự kiến** sắp phát sinh từ trái phiếu đang giữ — đáo hạn và coupon kỳ tới — để chủ động dòng tiền cá nhân. Xem `docs/domain/10-cashflow-calendar.md` cho spec đầy đủ.

## Công việc cần làm
- [ ] Query tổng hợp: liệt kê `Holding{type: BOND, quantity > 0}` (join `BondTerms`) có `maturityDate` hoặc **kỳ trả lãi tới suy ra được** nằm trong cửa sổ 90 ngày tới, sắp xếp theo ngày gần nhất — dùng lại hàm suy kỳ tới do Phase 7 viết, **không** tự cài lại công thức
- [ ] Tính ước tính từng mục: đáo hạn = `parValue × quantity` (không trừ thuế); coupon = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity` (gộp, trước thuế, ghi rõ chưa trừ thuế)
- [ ] UI: màn/section riêng liệt kê lịch — vị trí cụ thể (link từ dashboard hay trang riêng) chốt lúc lên plan chi tiết; badge "đã quá hạn" khi `maturityDate` đã qua nhưng `quantity` vẫn > 0
- [ ] Bỏ qua Holding thiếu field liên quan hoặc chưa có `BondTerms` (không phải lỗi — field optional trên bảng đặc tả)

## Tiêu chí hoàn thành
- [ ] Danh sách hiển thị đúng các mục trong cửa sổ 90 ngày, đúng công thức ước tính
- [ ] Holding thiếu `maturityDate`/`firstCouponDate` (hoặc chưa có `BondTerms`) không xuất hiện ở mục tương ứng, không báo lỗi
- [ ] Một kỳ coupon trả trễ **không làm lệch** các kỳ sau (lịch luôn neo theo `firstCouponDate`, không cộng dồn từ ngày nhận thực tế)
- [ ] Mọi số tiền có nhãn rõ "dự kiến", không nhầm với giao dịch thật đã ghi
- [ ] Trái phiếu đã đáo hạn quá hạn nhưng chưa tất toán hiển thị trạng thái "đã quá hạn" thay vì biến mất

## Phụ thuộc / ghi chú
- **Phụ thuộc chặt Phase 7:** cần bảng `BondTerms` **và** hàm suy "kỳ trả lãi tới" do Phase 7 tạo — Phase 8 chỉ đọc, không tự thêm schema, không tự cài lại công thức lịch coupon.
- Trạng thái "đã quá hạn" giả định user **có cách tất toán** — chính là `Cashflow{type: MATURITY}` của Phase 7.
- Chỉ áp dụng cho `BOND` — không dự đoán cổ tức STOCK/FUND (không đủ dữ liệu tin cậy để dự đoán ngày/mức, xem `docs/domain/10-cashflow-calendar.md` mục "Mục đích").
- Không phải trình tự ưu tiên gốc (giống Phase 7) — chỉ làm khi có nhu cầu, không chặn các phase khác.
