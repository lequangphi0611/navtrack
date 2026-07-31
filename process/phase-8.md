# Phase 8 — Lịch dòng tiền sắp tới (trái phiếu)

## Mục tiêu
Hiển thị các khoản tiền **dự kiến** phát sinh từ trái phiếu đang giữ — đáo hạn và các kỳ trả lãi — để chủ động dòng tiền cá nhân, đồng thời **nhắc những khoản đã tới hạn mà chưa ghi nhận**. Xem `docs/domain/10-cashflow-calendar.md` cho spec đầy đủ.

> Phạm vi phase đã được rà lại ngày 2026-07-31 trước khi code (12 nút thắt, xem `DECISION.md` 2026-07-31). Các mục dưới đây đã phản ánh bản sửa — **không** phải bản gốc 2026-07-17.

## Công việc cần làm

### 1. Truy vấn & tính toán
- [ ] Truy vấn **batch** ở `features/holdings/repository.ts`: (a) `Holding{type: BOND, quantity > 0}` kèm `BondTerms` trong một query; (b) **danh sách** `Dividend{BOND_COUPON}.date` trong cửa sổ cho nhiều holding — **không** phải `groupBy _max: date` (gán mốc là đối chiếu từng mốc, hàm chỉ trả max không phục vụ được). Giữ nguyên `findLastBondCouponDate` (max) cho form ghi trái tức. Không truy vấn Prisma ngoài `repository.ts`.
- [ ] Thuế cũng batch: đọc rows 2 key `BOND_INTEREST_TAX_RATE_*` **một lần** (`findSettingRowsByKeys`) rồi `pickEffectiveSetting()` theo từng mốc — **không** gọi `resolveDecimalSetting()` trong vòng lặp (mỗi lần gọi là một query, đúng N+1 vừa cấm).
- [ ] Cửa sổ **hai chiều** `[hôm nay − 180, hôm nay + N]`, `N` mặc định 90; **tầng server luôn dựng theo biên rộng nhất `[−180, +180]`**, bộ chọn chỉ lọc ở client (không thì chọn 180 sẽ không ra thêm mục nào).
- [ ] "Hôm nay" lấy từ `todayIctDateOnly()` (`lib/cutoff.ts`) ở **mọi** chỗ trong luồng trái phiếu, không chỉ màn lịch — 4 call site cũ: `getBondHoldingActions` (`startOfUtcDay(new Date())`), `getBondCouponFormData` (`new Date()` thô, dùng cho cả ngưỡng lịch lẫn `atDate` thuế), `getMaturitySettlementData` (`maturityDate ?? new Date()`), `computeBondTermsPreview` (tham số mặc định `today = new Date()`).
- [ ] Liệt kê **mọi** mốc trả lãi trong cửa sổ (trái phiếu trả hàng tháng có 3–4 kỳ), không chỉ kỳ kế tiếp — hàm mới `couponScheduleInWindow()` ở `lib/bond-schedule.ts`. **Không** bọc `computeNextCouponDate()` (trả một mốc), **không** cài lại công thức lịch trong `features/`.
- [ ] "Mốc đã ghi" đối chiếu **từng mốc**, không phải `> max(date)`: mỗi `Dividend{BOND_COUPON}` gán vào **mốc gần nhất** với dung sai **± nửa kỳ**; mốc có bản ghi gán vào thì biến mất khỏi lịch. Lọc theo max sẽ giấu kỳ cũ bị bỏ sót (làm chiều lùi vô dụng) và làm mốc đã trả sớm hiện lại kèm CTA (dẫn tới ghi trùng kỳ).
- [ ] Mở rộng `lib/bond-schedule.ts` (không viết bản song song): (a) mốc dừng = `min(maturityDate ?? +∞, biên trên cửa sổ)` để trái phiếu **thiếu `maturityDate` vẫn có lịch trả lãi**; (b) `nextCouponDateOverride` chỉ thắng khi **chưa** ghi kỳ đó (`lastPaidCouponDate < override`); (c) dọn bản song song đã có — `countRemainingCouponPeriods()` không có call site production nào trong khi `bond-terms-preview.ts` cài lại inline.
- [ ] Ước tính từng mục, hiển thị **gộp là số chính + dòng phụ "thực nhận"**:
  - kỳ trả lãi gộp = `parValue × couponRatePercent/100 × couponFrequencyMonths/12 × SL`; **SL theo mốc**: mốc tương lai dùng SL hiện tại (ghi rõ giả định trên UI), mốc **quá khứ** dùng **SL tại ngày mốc** (`buildQuantityTimeline`) — cùng cơ sở mà `recordBondCouponDividend` sẽ dùng khi user bấm CTA, tránh lặp lại bug "lịch hiện X, ghi ra Y" (`DECISION.md` 2026-07-29 (3)). Thực nhận = trừ thuế theo `issuerType`, effective-dated **theo ngày của chính mốc đó**.
  - đáo hạn gộp = `parValue × quantity`; thực nhận = trừ thuế lãi phần chiết khấu `max(0, (parValue − avgCost) × quantity) × thuế lãi` — **dùng lại** công thức `settleMaturity`, không cài lại. Không trừ phí (đáo hạn `feeAmount = 0`).
- [ ] Sắp xếp: theo ngày gần nhất trước; nhóm quá hạn lên đầu (trong nhóm **cũ nhất trước**); **cùng ngày thì kỳ trả lãi trước đáo hạn** (user ghi theo thứ tự nhìn thấy — ngược lại sẽ khiến trái tức kỳ cuối ra 0 đồng).
- [ ] Tổng hợp: tổng tiền dự kiến trong cửa sổ (gộp + thực nhận), tổng **theo tháng dương lịch** cho phần chiều tới, và số mục **quá hạn chưa ghi** tách riêng khỏi tổng dự kiến.

### 2. UI
- [ ] Trang lịch đầy đủ: sắp xếp theo ngày gần nhất trước, **mục quá hạn/chưa ghi xếp lên đầu**; badge "đã quá hạn" (đáo hạn) và "chưa ghi" (coupon); mọi số tiền có nhãn "dự kiến".
- [ ] Bộ chọn cửa sổ **30/90/180 ngày** (client-side, mặc định 90) — hằng số + tuỳ chọn hiển thị, **không** thêm `Setting`.
- [ ] CTA trên từng mục: `ROUTES.newDividend(holdingId)` (kỳ trả lãi) / `ROUTES.maturitySettlement(holdingId)` (đáo hạn) — CTA kỳ trả lãi **mang theo mốc** qua `?couponDate=yyyy-MM-dd`, `getBondCouponFormData()` nhận mốc tuỳ chọn để prefill đúng kỳ được bấm (hiện luôn prefill kỳ chưa ghi đầu tiên).
- [ ] Card tóm tắt ở Dashboard: **2–3 mục sắp tới** gần nhất + tổng cửa sổ, mục quá hạn chỉ đếm ở badge riêng (không chen vào danh sách, không thì card "Sắp tới" toàn mục quá hạn) → link sang trang đầy đủ. `BottomNav` giữ 3 tab, không thêm tab.
- [ ] 3 trạng thái rỗng phân biệt rõ: (a) không có trái phiếu → ẩn hẳn; (b) không sinh được mục nào trong cửa sổ rộng nhất **và** thiếu `maturityDate` hoặc thiếu cặp `firstCouponDate`+`couponFrequencyMonths` → nêu số vị thế + link `ROUTES.bondTerms(id)`; (c) còn lại (gồm zero-coupon đủ điều khoản, đáo hạn còn xa) → "không có khoản nào tới hạn", chỉ gợi ý mở rộng cửa sổ khi `N < 180`.
- [ ] **Ô nhập `nextCouponDateOverride`** ở màn điều khoản (7a) — việc treo từ Phase 7, bắt buộc làm ở phase này (có lịch mà không sửa được lịch là ngõ cụt).
- [ ] **Callout "quá đáo hạn" ở màn Danh mục** (mockup 7h, treo từ Phase 7) — dùng đúng truy vấn batch ở trên; `OverdueMaturityCard` đã dựng sẵn, mới chỉ có preview.

### 3. Bỏ qua đúng chỗ
- [ ] Holding thiếu field liên quan hoặc chưa có `BondTerms` **không** xuất hiện ở mục tương ứng và **không** báo lỗi (field optional trên bảng đặc tả) — nhưng phải được đếm vào trạng thái rỗng ca (b) để user biết còn thiếu gì.

## Tiêu chí hoàn thành
- [ ] Đúng **mọi** kỳ trả lãi trong cửa sổ, không chỉ kỳ đầu — có test cho trái phiếu trả hàng tháng (3–4 kỳ/90 ngày) và hàng quý.
- [ ] Kỳ trả lãi **đã qua mà chưa ghi** vẫn hiện (badge "chưa ghi"), cả ca đã ghi vài kỳ lẫn ca **chưa ghi kỳ nào** — ca thứ hai là ca dễ mất mục nhất (ngưỡng mặc định là "hôm qua").
- [ ] **Kỳ cũ bị bỏ sót vẫn hiện** dù đã ghi kỳ mới hơn (test: ghi kỳ 15/07, bỏ sót 15/01 → 15/01 phải còn trên lịch) — đây là ca mà lọc theo `max(date)` làm hỏng, và là lý do tồn tại của chiều lùi.
- [ ] **Ghi sớm hơn mốc không làm mốc hiện lại**: trả 10/07 cho kỳ 15/07 → mốc 15/07 biến mất (dung sai ± nửa kỳ), không dụ user ghi trùng kỳ.
- [ ] Chọn cửa sổ **180 ngày ra nhiều mục hơn 90 ngày** (bằng chứng server không cắt theo `N` đang chọn).
- [ ] CTA kỳ trả lãi mở form prefill **đúng mốc được bấm**, kể cả mục thứ 2/3 và mục quá hạn — không phải luôn kỳ chưa ghi đầu tiên.
- [ ] Ước tính của mục **quá hạn** khớp số mà `recordBondCouponDividend` ghi ra khi bấm CTA (cùng cơ sở SL tại ngày mốc).
- [ ] Card Dashboard chỉ liệt kê mục **sắp tới**; mục quá hạn nằm ở badge đếm riêng.
- [ ] Có **ô nhập `nextCouponDateOverride`** ở màn điều khoản (7a), nhập rồi thì lịch đổi theo.
- [ ] Callout "quá đáo hạn" hiện ở **màn Danh mục** (không chỉ chi tiết vị thế), dùng chung truy vấn batch.
- [ ] Tổng theo **tháng dương lịch** và tổng cửa sổ khớp tổng các mục đang hiển thị; mục quá hạn không nằm trong tổng dự kiến.
- [ ] Cùng một ngày: kỳ trả lãi hiển thị **trước** đáo hạn.
- [ ] Trái phiếu **thiếu `maturityDate`** nhưng đủ `firstCouponDate` + `couponFrequencyMonths` vẫn có mục trả lãi trong cửa sổ.
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
