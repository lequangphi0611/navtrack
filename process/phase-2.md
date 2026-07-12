# Phase 2 — Lõi XIRR + giá tự động

## Mục tiêu
Có định giá thị trường (NAV) và hai chỉ số hiệu quả: **XIRR (theo năm)** + **lãi/lỗ tuyệt đối**. Tích hợp giá tự động từ vnstock.

## UI (đã hiện thực — design-implementer)
Lớp Presentational của phase này (6 màn 2a–2f + BottomNav dùng chung) đã xong, xem **[`process/UI_phase_2.md`](./UI_phase_2.md)** — Props-contract từng component + query/Server Action còn thiếu (đọc trước khi code phần business bên dưới, khỏi phải hỏi lại design-implementer).

## Công việc cần làm
- [x] Model `PriceQuote` (`symbol`, `date`, `price`, `source`, `@@unique([symbol, date])`) + migration
- [x] Job **Python + vnstock** (`jobs/price-fetcher/`) chạy trên GitHub Actions, upsert `PriceQuote`; secrets ở GitHub Secrets
- [x] Định giá `Holding` tại ngày D: ưu tiên `NavOverride` → nếu không có, `PriceQuote` gần nhất ≤ D
- [x] `NavOverride` cho vàng/trái phiếu (nhập tay); nhãn nguồn giá (tự động/nhập tay)
- [x] `lib/xirr.ts` — **lai**: thư viện + lớp bọc (validate dấu dòng tiền, bắt không hội tụ, gắn nhãn "theo năm")
- [x] Ghép dòng tiền giả định = NAV tại mốc chốt (runtime, không lưu); mốc: hôm nay / cuối tháng / cuối năm / tùy chỉnh
- [x] Dashboard hiển thị **song song** XIRR (theo năm) + lãi/lỗ tuyệt đối
- [x] Unit test XIRR **đối chiếu Google Sheets** + ca biên (không hội tụ, thiếu giá)
- [x] **Cache có chọn lọc cho `PriceQuote`** (theo `symbol`, `revalidate` khớp cadence job EOD) — xem quy tắc + footgun key-scoping ở [`docs/rules/performance.md`](../docs/rules/performance.md) mục "Data fetching"

## Tiêu chí hoàn thành
- [x] XIRR khớp kết quả Excel/Google Sheets trên bộ dữ liệu mẫu
- [x] "Không tính được" trả trạng thái rõ ràng, **không** âm thầm −100%/NaN
- [ ] Job Python chạy theo lịch, ghi giá vào `PriceQuote`; app đọc để định giá
- [x] Đổi mốc chốt → XIRR tính lại đúng theo NAV mốc đó
- [x] Cache `PriceQuote` không rò dữ liệu (key theo `symbol`) và không làm giá kém tươi hơn cadence job

## Hiện trạng fetch Phase 1 cần xử lý ở phase này

**Trạng thái: đã xử lý** cho mọi nơi đã ghép định giá; xem ghi chú riêng ở gạch đầu dòng đầu cho phần chưa tới lượt áp dụng.

Phase 1 cố ý **không cache gì ở tầng server** (hợp lý cho quy mô nhỏ). Phase 2 thêm giá tự động → khối lượng đọc tăng, đây là lúc áp chiến lược cache **có chọn lọc** đã chốt ở [`docs/rules/performance.md`](../docs/rules/performance.md). Cụ thể đã rà:

- **`getHoldingDetail`** (`src/features/holdings/queries.ts`) và **`getPortfolioValuation`** (`src/lib/portfolio-valuation.ts`, dùng cho Dashboard) đều gọi `valuateHoldings()` (`src/lib/valuation.ts`) — batch giá theo tập `symbol` một lần cho toàn bộ holding cần định giá, không query riêng lẻ từng holding (N+1). `PriceQuote` đã cache theo `symbol` (xem `getLatestPriceQuotes`, `unstable_cache` riêng từng symbol, `revalidate` 1 giờ) tách khỏi phần holdings scoped-user, không rò dữ liệu. — **Ngoại lệ còn lại:** danh sách tổng quan `/holdings` (`getOpenHoldings`/`getClosedHoldings`) **chưa ghép định giá** (chỉ đọc `quantity`/`avgCost` materialized, đúng Phase 1) — đây là phần "hiển thị market value trên danh sách" cố ý hoãn, chưa nằm trong phạm vi đã giao ở Phase 2. Khi wiring phần đó, **phải** dùng lại `valuateHoldings()` theo đúng pattern trên, không tự viết query riêng lẻ.
- **Bất biến giữ nguyên:** `getSession = cache(auth)` **không** được nâng thành cache xuyên request; mọi cache dữ liệu holdings/cashflow (nếu thêm) phải có `userId` trong cache key và `revalidateTag` trong Server Action tương ứng (`revalidatePath` hiện có ở `holdings/actions.ts` vẫn cần cho Full Route Cache). Chưa vi phạm — không cache nào được thêm cho holdings/cashflow của user.
- **Chưa đụng** cache holdings/cashflow của user trong Phase 2 (đúng như đã chốt, chưa đo được điểm chậm) — chỉ cache `PriceQuote`; snapshot để Phase 3.

## Phụ thuộc / ghi chú
- Cần Phase 1 (Holding/Cashflow) xong. Thuế khi bán chưa áp ở đây (Phase 5) — có thể để `taxAmount = 0` tạm.
