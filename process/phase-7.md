# Phase 7 — Trái tức (lãi trái phiếu)

## Mục tiêu
Ghi nhận lãi định kỳ (trái tức) cho `Holding{type: BOND}` — bổ sung ngoài Phase 4 (Phase 4 chỉ scope cổ tức tiền mặt/cổ phiếu cho STOCK/FUND).

## Công việc cần làm
- [ ] Schema & Setting: mở rộng `DividendType`/`Dividend` cho loại trái tức + migration; thêm 5 field mới trên `Holding` (`parValue`/`couponRatePercent`/`couponFrequencyMonths`/`maturityDate`/`nextCouponDate`, xem `docs/domain/10-cashflow-calendar.md`) — cần cho Phase 8; quyết định key `Setting` thuế lãi trái phiếu (dùng chung `DIVIDEND_TAX_RATE` hay key riêng).
- [ ] Design & UI: form tạo/sửa `Holding{type: BOND}` thêm field mệnh giá/coupon rate/kỳ trả lãi/ngày đáo hạn (nhập một lần, không phải mỗi lần ghi trái tức); mở rộng `DividendForm` hiện có (Phase 4) hỗ trợ loại trái tức (đọc `parValue`/`couponRatePercent` từ `Holding`, không hỏi lại), `DividendHistoryList` hiển thị đúng loại mới.
- [ ] Server Action + tính toán: `dividend-math.ts` hàm tính trái tức, `schemas.ts`/`actions.ts::recordDividend` mở rộng nhánh mới (đọc mệnh giá/coupon rate từ `Holding` thay vì input riêng), cập nhật `Holding.nextCouponDate` sau khi ghi thành công (+`couponFrequencyMonths`), `queries.ts::getDividendHistory` hiển thị lịch sử trái tức.

## Tiêu chí hoàn thành
- [ ] Ghi trái tức tạo dòng tiền dương đúng (sau thuế) vào chuỗi XIRR của `Holding` loại BOND, tương tự cổ tức tiền mặt.
- [ ] Mệnh giá/coupon rate **lưu cố định trên `Holding`** (đã chốt 2026-07-17, đảo hướng đề xuất ban đầu "nhập tay mỗi lần") — `recordDividend` đọc từ `Holding`, không nhập lại mỗi lần ghi; `Holding.nextCouponDate` tự cộng thêm kỳ hạn sau mỗi lần ghi thành công.
- [ ] Docs domain (`docs/domain/03-dividends.md`, `07-tax.md`, `02-data-model.md`, `09-settings.md`, `10-cashflow-calendar.md`) đồng bộ với quyết định thật đã chốt lúc implement.

## Phụ thuộc / ghi chú
- Phụ thuộc Phase 4 (model `Dividend`, `DividendForm`, `recordDividend` đã có) — mở rộng, không dựng lại từ đầu.
- **Là tiền đề bắt buộc cho Phase 8** (Lịch dòng tiền sắp tới) — 5 field mới trên `Holding` phải làm ở Phase 7 vì Phase 8 chỉ đọc, không tự thêm schema.
- Điểm còn mở, không tự chốt trước: (1) ~~mệnh giá/coupon rate nhập tay mỗi lần hay lưu cố định trên `Holding`~~ **đã chốt 2026-07-17: lưu cố định trên `Holding`** (xem trên); (2) thuế lãi trái phiếu dùng chung `DIVIDEND_TAX_RATE` hay key riêng; (3) cách suy ngược nhãn hiển thị lịch sử (`percentLabel`-tương-đương) cho loại trái tức; (4) **đáo hạn trái phiếu (nhận lại gốc) vs bán trước hạn trên thị trường thứ cấp** — Phase 5 áp `SALE_TAX_BOND` (0.1%) chung cho mọi `Cashflow{type: SELL}`, nhưng về bản chất chỉ chuyển nhượng trước hạn mới chịu thuế này, đáo hạn không phải là một giao dịch chuyển nhượng. Nếu người dùng phát sinh nhu cầu ghi nhận đáo hạn, cần quyết định: thêm cách ghi riêng (không dùng SELL thường) hay chấp nhận taxAmount tính sai và sửa tay (đã cho phép sửa tay từ Phase 5). Xem `docs/domain/07-tax.md` mục "Ca biên".
