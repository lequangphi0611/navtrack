# Phase 7 — Trái tức (lãi trái phiếu)

## Mục tiêu
Ghi nhận lãi định kỳ (trái tức) cho `Holding{type: BOND}` — bổ sung ngoài Phase 4 (Phase 4 chỉ scope cổ tức tiền mặt/cổ phiếu cho STOCK/FUND).

## Công việc cần làm
- [ ] Schema & Setting: mở rộng `DividendType`/`Dividend` cho loại trái tức + migration; quyết định key `Setting` thuế lãi trái phiếu (dùng chung `DIVIDEND_TAX_RATE` hay key riêng).
- [ ] Design & UI: mở rộng `DividendForm` hiện có (Phase 4) hỗ trợ loại trái tức (field mệnh giá nhập tay + coupon rate), `DividendHistoryList` hiển thị đúng loại mới.
- [ ] Server Action + tính toán: `dividend-math.ts` hàm tính trái tức, `schemas.ts`/`actions.ts::recordDividend` mở rộng nhánh mới, `queries.ts::getDividendHistory` hiển thị lịch sử trái tức.

## Tiêu chí hoàn thành
- [ ] Ghi trái tức tạo dòng tiền dương đúng (sau thuế) vào chuỗi XIRR của `Holding` loại BOND, tương tự cổ tức tiền mặt.
- [ ] Mệnh giá/coupon rate nhập tay mỗi lần ghi (không phụ thuộc `Setting` mặc định như cổ tức cổ phiếu) — đúng đặc thù mỗi trái phiếu mệnh giá khác nhau.
- [ ] Docs domain (`docs/domain/03-dividends.md`, `07-tax.md`, `02-data-model.md`, `09-settings.md`) đồng bộ với quyết định thật đã chốt lúc implement.

## Phụ thuộc / ghi chú
- Phụ thuộc Phase 4 (model `Dividend`, `DividendForm`, `recordDividend` đã có) — mở rộng, không dựng lại từ đầu.
- Điểm còn mở, không tự chốt trước: (1) mệnh giá/coupon rate nhập tay mỗi lần hay lưu cố định trên `Holding`; (2) thuế lãi trái phiếu dùng chung `DIVIDEND_TAX_RATE` hay key riêng; (3) cách suy ngược nhãn hiển thị lịch sử (`percentLabel`-tương-đương) cho loại trái tức; (4) **đáo hạn trái phiếu (nhận lại gốc) vs bán trước hạn trên thị trường thứ cấp** — Phase 5 áp `SALE_TAX_BOND` (0.1%) chung cho mọi `Cashflow{type: SELL}`, nhưng về bản chất chỉ chuyển nhượng trước hạn mới chịu thuế này, đáo hạn không phải là một giao dịch chuyển nhượng. Nếu người dùng phát sinh nhu cầu ghi nhận đáo hạn, cần quyết định: thêm cách ghi riêng (không dùng SELL thường) hay chấp nhận taxAmount tính sai và sửa tay (đã cho phép sửa tay từ Phase 5). Xem `docs/domain/07-tax.md` mục "Ca biên".
