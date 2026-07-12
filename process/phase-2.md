# Phase 2 — Lõi XIRR + giá tự động

## Mục tiêu
Có định giá thị trường (NAV) và hai chỉ số hiệu quả: **XIRR (theo năm)** + **lãi/lỗ tuyệt đối**. Tích hợp giá tự động từ vnstock.

## UI (đã hiện thực — design-implementer)
Lớp Presentational của phase này (6 màn 2a–2f + BottomNav dùng chung) đã xong, xem **[`process/UI_phase_2.md`](./UI_phase_2.md)** — Props-contract từng component + query/Server Action còn thiếu (đọc trước khi code phần business bên dưới, khỏi phải hỏi lại design-implementer).

## Công việc cần làm
- [x] Model `PriceQuote` (`symbol`, `date`, `price`, `source`, `@@unique([symbol, date])`) + migration
- [x] Job **Python + vnstock** (`jobs/price-fetcher/`) chạy trên GitHub Actions, upsert `PriceQuote`; secrets ở GitHub Secrets
- [ ] Định giá `Holding` tại ngày D: ưu tiên `NavOverride` → nếu không có, `PriceQuote` gần nhất ≤ D
- [ ] `NavOverride` cho vàng/trái phiếu (nhập tay); nhãn nguồn giá (tự động/nhập tay)
- [ ] `lib/xirr.ts` — **lai**: thư viện + lớp bọc (validate dấu dòng tiền, bắt không hội tụ, gắn nhãn "theo năm")
- [ ] Ghép dòng tiền giả định = NAV tại mốc chốt (runtime, không lưu); mốc: hôm nay / cuối tháng / cuối năm / tùy chỉnh
- [ ] Dashboard hiển thị **song song** XIRR (theo năm) + lãi/lỗ tuyệt đối
- [ ] Unit test XIRR **đối chiếu Google Sheets** + ca biên (không hội tụ, thiếu giá)
- [ ] **Cache có chọn lọc cho `PriceQuote`** (theo `symbol`, `revalidate` khớp cadence job EOD) — xem quy tắc + footgun key-scoping ở [`docs/rules/performance.md`](../docs/rules/performance.md) mục "Data fetching"

## Tiêu chí hoàn thành
- [ ] XIRR khớp kết quả Excel/Google Sheets trên bộ dữ liệu mẫu
- [ ] "Không tính được" trả trạng thái rõ ràng, **không** âm thầm −100%/NaN
- [ ] Job Python chạy theo lịch, ghi giá vào `PriceQuote`; app đọc để định giá
- [ ] Đổi mốc chốt → XIRR tính lại đúng theo NAV mốc đó
- [ ] Cache `PriceQuote` không rò dữ liệu (key theo `symbol`) và không làm giá kém tươi hơn cadence job

## Hiện trạng fetch Phase 1 cần xử lý ở phase này

Phase 1 cố ý **không cache gì ở tầng server** (hợp lý cho quy mô nhỏ). Phase 2 thêm giá tự động → khối lượng đọc tăng, đây là lúc áp chiến lược cache **có chọn lọc** đã chốt ở [`docs/rules/performance.md`](../docs/rules/performance.md). Cụ thể cần rà:

- **`getHoldingsOverview` / `getHoldingDetail`** (`src/features/holdings/queries.ts`) hiện `findMany`/`findUnique` thẳng mỗi request rồi `derivePosition` runtime. Khi ghép định giá (đọc `PriceQuote` cho từng `symbol`), **không** để mỗi holding query giá riêng lẻ (N+1). Cân nhắc gom giá theo tập `symbol` một lần, rồi map — và cache lớp `PriceQuote` (dùng chung, không scoped-user) tách khỏi phần holdings scoped-user.
- **Bất biến giữ nguyên:** `getSession = cache(auth)` **không** được nâng thành cache xuyên request; mọi cache dữ liệu holdings/cashflow (nếu thêm) phải có `userId` trong cache key và `revalidateTag` trong Server Action tương ứng (`revalidatePath` hiện có ở `holdings/actions.ts` vẫn cần cho Full Route Cache).
- **Chưa cần** đụng cache holdings/cashflow của user trong Phase 2 nếu chưa đo được điểm chậm — ưu tiên chỉ cache `PriceQuote`/snapshot (Phase 3). Ghi rõ để tránh over-engineer.

## Phụ thuộc / ghi chú
- Cần Phase 1 (Holding/Cashflow) xong. Thuế khi bán chưa áp ở đây (Phase 5) — có thể để `taxAmount = 0` tạm.
