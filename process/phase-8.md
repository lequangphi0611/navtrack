# Phase 8 — Lịch dòng tiền sắp tới (trái phiếu)

## Mục tiêu
Hiển thị các khoản tiền **dự kiến** phát sinh từ trái phiếu đang giữ — đáo hạn và các kỳ trả lãi — để chủ động dòng tiền cá nhân, đồng thời **nhắc những khoản đã tới hạn mà chưa ghi nhận**. Xem `docs/domain/10-cashflow-calendar.md` cho spec đầy đủ.

> Phạm vi phase đã được rà lại ngày 2026-07-31 trước khi code (12 nút thắt, xem `DECISION.md` 2026-07-31). Các mục dưới đây đã phản ánh bản sửa — **không** phải bản gốc 2026-07-17.

## Công việc cần làm

### 1. Truy vấn & tính toán
- [ ] Truy vấn **batch** ở `features/holdings/repository.ts`: (a) `Holding{type: BOND, quantity > 0}` kèm `BondTerms` trong một query; (b) `groupBy holdingId, _max: date` cho `Dividend{type: BOND_COUPON}` (kỳ đã ghi gần nhất từng holding). Không lặp `findLastBondCouponDate()` theo từng holding (N+1) và không truy vấn Prisma ngoài `repository.ts`.
- [ ] Cửa sổ **hai chiều** `[hôm nay − 180 ngày, hôm nay + 90 ngày]`; "hôm nay" lấy từ `todayIctDateOnly()` (`lib/cutoff.ts`), **không** `new Date()` thô — sửa luôn 2 call site cũ của Phase 7 (`getBondHoldingActions`, `getBondCouponFormData`) đang dùng `startOfUtcDay(new Date())`.
- [ ] Liệt kê **mọi** mốc coupon trong cửa sổ (trái phiếu trả hàng tháng/quý có 2–3 kỳ), không chỉ kỳ kế tiếp: sinh lịch bằng `buildCouponSchedule()` rồi lọc theo cửa sổ và `> lastPaidCouponDate`. **Không** dùng `computeNextCouponDate()` cho màn này, **không** cài lại công thức lịch trong `features/`.
- [ ] Mở rộng `lib/bond-schedule.ts` (không viết bản song song): (a) mốc dừng = `min(maturityDate ?? +∞, biên trên cửa sổ)` để trái phiếu **thiếu `maturityDate` vẫn có lịch coupon**; (b) `nextCouponDateOverride` chỉ thắng khi **chưa** ghi kỳ đó (`lastPaidCouponDate < override`), sau đó quay lại neo `firstCouponDate`.
- [ ] Ước tính từng mục, hiển thị **gộp là số chính + dòng phụ ước tính thực nhận**:
  - coupon gộp = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × quantity` (SL đang giữ hiện tại, ghi rõ trên UI); thực nhận = trừ thuế theo `issuerType`, resolve **effective-dated theo ngày trả lãi của chính mốc đó**.
  - đáo hạn gộp = `parValue × quantity`; thực nhận = trừ thuế lãi phần chiết khấu `max(0, (parValue − avgCost) × quantity) × thuế lãi` — **dùng lại** công thức `settleMaturity`, không cài lại. Không trừ phí (đáo hạn `feeAmount = 0`).
- [ ] Tổng hợp: tổng tiền dự kiến trong cửa sổ (gộp + thực nhận), tổng theo tháng cho phần chiều tới, và số mục **quá hạn chưa ghi** tách riêng khỏi tổng dự kiến.

### 2. UI
- [ ] Trang lịch đầy đủ: sắp xếp theo ngày gần nhất trước, **mục quá hạn/chưa ghi xếp lên đầu**; badge "đã quá hạn" (đáo hạn) và "chưa ghi" (coupon); mọi số tiền có nhãn "dự kiến".
- [ ] Bộ chọn cửa sổ **30/90/180 ngày** (client-side, mặc định 90) — hằng số + tuỳ chọn hiển thị, **không** thêm `Setting`.
- [ ] CTA trên từng mục: `ROUTES.newDividend(holdingId)` (coupon) / `ROUTES.maturitySettlement(holdingId)` (đáo hạn).
- [ ] Card tóm tắt ở Dashboard: 2–3 mục gần nhất + tổng cửa sổ + số mục quá hạn → link sang trang đầy đủ. `BottomNav` giữ 3 tab, không thêm tab.
- [ ] 3 trạng thái rỗng phân biệt rõ: (a) không có trái phiếu → ẩn hẳn; (b) có trái phiếu nhưng thiếu điều khoản → nêu số vị thế + link `ROUTES.bondTerms(id)`; (c) đủ điều khoản nhưng cửa sổ trống → gợi ý đổi sang 180 ngày.
- [ ] **Ô nhập `nextCouponDateOverride`** ở màn điều khoản (7a) — việc treo từ Phase 7, bắt buộc làm ở phase này (có lịch mà không sửa được lịch là ngõ cụt).
- [ ] **Callout "quá đáo hạn" ở màn Danh mục** (mockup 7h, treo từ Phase 7) — dùng đúng truy vấn batch ở trên; `OverdueMaturityCard` đã dựng sẵn, mới chỉ có preview.

### 3. Bỏ qua đúng chỗ
- [ ] Holding thiếu field liên quan hoặc chưa có `BondTerms` **không** xuất hiện ở mục tương ứng và **không** báo lỗi (field optional trên bảng đặc tả) — nhưng phải được đếm vào trạng thái rỗng ca (b) để user biết còn thiếu gì.

## Tiêu chí hoàn thành
- [ ] Đúng **mọi** kỳ coupon trong cửa sổ, không chỉ kỳ đầu — có test cho trái phiếu trả hàng tháng (3 kỳ/90 ngày) và hàng quý.
- [ ] Kỳ coupon **đã qua mà chưa ghi** vẫn hiện (badge "chưa ghi"), cả ca đã ghi vài kỳ lẫn ca **chưa ghi kỳ nào** — ca thứ hai là ca dễ mất mục nhất (ngưỡng mặc định là "hôm qua").
- [ ] Trái phiếu **thiếu `maturityDate`** nhưng đủ `firstCouponDate` + `couponFrequencyMonths` vẫn có mục coupon trong cửa sổ.
- [ ] Số tiền: gộp đúng công thức; ước tính thực nhận đúng thuế theo `issuerType` **và đúng ngày hiệu lực của mốc**; đáo hạn mua chiết khấu trừ thuế lãi phần lợi tức, mua đúng mệnh giá thì gộp = thực nhận.
- [ ] Biên cửa sổ và nhãn "trễ N ngày" đúng theo **giờ Việt Nam** — có test ở khung giờ UTC 17:00–23:59 (tức 00:00–06:59 hôm sau ICT).
- [ ] `nextCouponDateOverride` áp đúng một kỳ: sau khi ghi kỳ đó, lịch quay lại neo `firstCouponDate` (không kẹt ở ngày override).
- [ ] Một kỳ coupon trả trễ **không làm lệch** các kỳ sau (lịch luôn neo `firstCouponDate`, không cộng dồn từ ngày nhận thực tế).
- [ ] Mọi số tiền có nhãn rõ "dự kiến", không nhầm với giao dịch thật đã ghi.
- [ ] Trái phiếu đã đáo hạn quá hạn nhưng chưa tất toán hiển thị "đã quá hạn" thay vì biến mất.
- [ ] 3 trạng thái rỗng hiển thị đúng ca, ca (b) dẫn được sang màn nhập điều khoản.
- [ ] Không có truy vấn Prisma nào ngoài `repository.ts`, không có vòng lặp query theo từng holding.

## Phụ thuộc / ghi chú
- **Phụ thuộc chặt Phase 7:** cần bảng `BondTerms` **và** `lib/bond-schedule.ts` do Phase 7 tạo — Phase 8 **không thêm schema mới** (`nextCouponDateOverride` đã có sẵn cột), chỉ **mở rộng** hàm lịch, không cài lại công thức.
- Trạng thái "đã quá hạn" giả định user **có cách tất toán** — chính là `Cashflow{type: MATURITY}` của Phase 7.
- Chỉ áp dụng cho `BOND` — không dự đoán cổ tức STOCK/FUND (không đủ dữ liệu tin cậy để dự đoán ngày/mức, xem `docs/domain/10-cashflow-calendar.md` mục "Mục đích").
- Không phải trình tự ưu tiên gốc (giống Phase 7) — chỉ làm khi có nhu cầu, không chặn các phase khác.
