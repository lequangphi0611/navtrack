# Phase 4 — Cổ tức

## Mục tiêu
Ghi nhận cổ tức tiền mặt (ảnh hưởng XIRR, tự khấu trừ thuế) và cổ tức cổ phiếu (tăng số lượng nắm giữ).

## Công việc cần làm
- [x] Model `Dividend` (`type`, `date`, `grossAmount?`, `taxAmount?`, `netAmount?`, `stockQuantity?`) + enum `DividendType` + migration — đã có sẵn từ migration `20260708154124_init` (Phase 1), không cần migration mới ở #52.
- [x] Cổ tức **tiền mặt**: nhập % (so mệnh giá `DIVIDEND_PAR_VALUE`) → tự khấu trừ thuế (`DIVIDEND_TAX_RATE`) → lưu gross/tax/net; **net** là dòng tiền dương vào XIRR (issue #52, `features/dividends/actions.ts::recordDividend`).
- [x] Cổ tức **cổ phiếu**: tăng `stockQuantity` nắm giữ, không phát sinh tiền; cache `Holding.quantity` cộng thẳng, `avgCost` giữ nguyên (issue #52).
- [x] UI ghi nhận cổ tức gắn với từng `Holding` — Presentational xong (issue #51, sample data): `DividendForm`/`HoldingSwitcher`/`DividendHistoryScreen` + CTA "Ghi cổ tức"/"Lịch sử cổ tức" trên `HoldingDetailScreen` + entry point Dashboard. Chi tiết + điểm lệch so với plan: [`UI_phase_4.md`](./UI_phase_4.md). Server Action/query thật đã wiring ở issue #52 (`features/dividends/actions.ts`, `queries.ts`) — không còn sample data.

## Tiêu chí hoàn thành
- [x] Cổ tức tiền mặt: net (sau thuế 5%) cộng vào chuỗi XIRR đúng — `features/holdings/queries.ts::getCashDividends` đã đọc `Dividend{type: CASH}.netAmount` thật (không còn luôn rỗng như trước #52).
- [x] Cổ tức cổ phiếu: số lượng nắm giữ tăng đúng, không tạo dòng tiền — `recordDividend` cộng thẳng `stockQuantity` vào cache `Holding.quantity` trong cùng transaction.
- [x] XIRR/lãi-lỗ phản ánh cổ tức chính xác — dòng tiền CASH net đã vào `buildXirrCashflows`, không cần thay đổi thêm ở lớp XIRR.

## Phụ thuộc / ghi chú
- Thuế cổ tức `DIVIDEND_TAX_RATE` **và mệnh giá `DIVIDEND_PAR_VALUE`** lấy từ bảng `Setting` — cả 2 key mới được thêm ở issue #52 (không phải "đã có sẵn từ Phase 1" như ghi trước đây — trước #52, `SETTING_KEYS` chỉ có `MAX_MEMBERS`). Dùng `resolveDecimalSetting(SETTING_KEYS.DIVIDEND_TAX_RATE, ngày chia)`/`resolveDecimalSetting(SETTING_KEYS.DIVIDEND_PAR_VALUE, ngày chia)` (`src/lib/settings.ts`).
