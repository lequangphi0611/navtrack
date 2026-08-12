# Quyết định — XIRR & lãi/lỗ

Phạm vi: chuỗi dòng tiền XIRR, `absolutePnl`, `realizedPnl`/`unrealizedPnl`, `totalInvested`.
Spec tương ứng: [`docs/domain/05-returns-xirr-and-pnl.md`](../../docs/domain/05-returns-xirr-and-pnl.md).

---

## 2026-07-19 — Issue #65: mốc dòng tiền XIRR của cổ tức tiền mặt đổi sang `paymentDate ?? date`

**Status:** Accepted — đảo một phần quyết định #61 ([`dividends.md`](./dividends.md) mục 2026-07-17: "`paymentDate` thuần thông tin")

**Issue #65 — mốc dòng tiền XIRR của cổ tức tiền mặt đổi từ `date` (ngày chia) sang `paymentDate ?? date` (tiền thực về, fallback `date`) — đảo một phần quyết định 2026-07-17 #61.**
- Bối cảnh: log ở entry 2026-07-17 (7) mục C1 — `buildXirrCashflows` (`lib/xirr-cashflow.ts`) ghép điểm cổ tức tại `Dividend.date` (ngày chia), trong khi `paymentDate` (ngày tiền thực về tài khoản, có thể trễ vài tuần) từ #61 chỉ để hiển thị, không dùng cho tính toán nào.
- **Quyết định:** `XirrCashflowInput.dividends` nhận thêm `paymentDate: Date | null`; điểm dòng tiền XIRR của cổ tức CASH đặt tại `paymentDate ?? date` thay vì luôn `date`. Áp dụng ở 3 nơi build input: `lib/portfolio-valuation.ts::getAllCashDividendsForXirr` (dashboard + widget XIRR toàn danh mục), `features/holdings/queries.ts::getCashDividends` (chi tiết một vị thế), `features/holdings/queries.ts::getCashDividendsForHoldings` (danh sách vị thế đang mở, batch).
- **Lý do tài chính:** XIRR quy đổi lợi suất theo thời gian (annualized) — đặt dòng tiền dương sớm hơn thời điểm tiền thực sự về tay sẽ thổi nhẹ lợi suất tính được (dòng tiền dương xuất hiện sớm hơn → nghiệm r lớn hơn thực tế). Sai số này rõ nhất với coupon trái phiếu (Phase 7/8), nơi khoảng trễ chia→trả thường dài hơn cổ tức cổ phiếu vài tuần.
- **KHÔNG đổi** 2 mốc khác vẫn dùng `Dividend.date`: mốc ghi `NavOverride` bù pha loãng (`features/dividends/dividend-math.ts`/`actions.ts`) và mốc `buildQuantityTimeline()` (`lib/position-trail.ts`, số lượng nắm giữ tại ngày chia) — cả hai gắn với **ngày chia** theo đúng bản chất nghiệp vụ (pha loãng NAV xảy ra tại ngày chia; số lượng cổ tức cổ phiếu cộng vào đúng ngày chia), không liên quan tới thời điểm tiền/CP thực về.
- Việc lọc `date <= cutoffDate` ở tầng query (3 hàm trên) **giữ nguyên theo `date`** (ngày chia) — không đổi sang lọc theo `paymentDate`, tránh vênh với "cổ tức đã ghi nhận tính tới mốc chốt" (một cổ tức chia trước cutoff nhưng `paymentDate` rơi sau cutoff vẫn được tính, chỉ lệch mốc dòng tiền trong chuỗi XIRR).
- Không đụng Prisma schema/migration — field `paymentDate` đã tồn tại từ #61.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Entity / field"), `docs/domain/05-returns-xirr-and-pnl.md` (mục "Cách tính"), `docs/02-data-model.md` (comment field `paymentDate` trong snippet `Dividend`).
- Tham chiếu: GitHub issue #65.

---

## 2026-07-24 — Issue #67: tách `realizedPnl`/`unrealizedPnl` khỏi `absolutePnl`

**Status:** Accepted — cách tính bên trong `computeRealizedGainForHolding` đã sửa lại ở [`transactions-and-cost-basis.md`](./transactions-and-cost-basis.md) mục 2026-07-24 (2)/(3)

**Issue #67 — tách `realizedPnl`/`unrealizedPnl` khỏi `absolutePnl` trên card "Lãi/lỗ" Dashboard; hàm tính viết mới thay vì mở rộng `derivePosition()`.**
- Bối cảnh: log 2026-07-17 (7) mục B1 để lại từ trước — user xác nhận đưa vào Phase 6 (đóng gói cùng các tính năng hoàn thiện dashboard khác) thay vì làm standalone ngoài phase, vì đây cũng chỉ là một chỉ số diễn giải thêm cho `absolutePnl` đã có (không phải chỉ số hiệu suất riêng, không đổi XIRR), tương tự tinh thần "chi phí ăn mòn" ở Phase 5.
- **(a) Không mở rộng `derivePosition()`/`CashflowInput` (`lib/cost-basis.ts`) — viết hàm thuần riêng `computeRealizedGainForHolding`/`computeUnrealizedGain` ở `lib/realized-pnl.ts`.** Lý do: `CashflowInput` hiện tại (`type/date/quantity/pricePerUnit/feeAmount`) phục vụ đúng nhu cầu ghi giao dịch (4 Server Action ở `features/holdings/actions.ts`, có test suite lớn bao phủ) — không có `taxAmount`/không cần `amount` đã materialize. Chỉ số realized/unrealized cần chính xác `Cashflow.amount` đã materialize (gồm phí mua, trừ phí+thuế bán) để khớp đúng dòng tiền XIRR, khác input `derivePosition()` cần. Mở rộng `derivePosition()` để nhét thêm nhu cầu đọc-only này sẽ buộc sửa 1 hàm nền tảng của write-path chỉ vì 1 chỉ số hiển thị — rủi ro không cần thiết. `computeRealizedGainForHolding` dùng CÙNG công thức avgCost bình quân di động (tương đương đại số, không phát minh khác đi), chỉ khác nguồn dữ liệu đầu vào (`amount.abs()` đã gồm phí thay vì `quantity*pricePerUnit + feeAmount` tách rời).
- **(b) `unrealizedPnl` dùng `quantity`/`avgCost` HIỆN TẠI (cache materialize trên `Holding`), không phải tại `cutoffDate`** — khi mốc chốt khác "hôm nay", con số không chính xác tuyệt đối. **Đây là giới hạn CÓ SẴN của toàn cơ chế cutoff trong `portfolio-valuation.ts`** (NAV toàn danh mục cũng tính theo `quantity` hiện tại của `Holding`, không phải tại cutoff) — không phải lỗi mới phát sinh từ issue #67, và **cố ý không mở rộng phạm vi sửa** vấn đề cutoff-accuracy cho quá khứ trong lần này.
- **Bất biến đã verify bằng unit test đối chiếu tay** (`src/lib/realized-pnl.test.ts`): `realizedPnl + unrealizedPnl == absolutePnl` khớp tuyệt đối (sai lệch 0 VND) trên portfolio giả lập nhiều holding (1 đã đóng SL=0, 1 bán một phần còn mở, có cổ tức tiền mặt) khi cutoff = hôm nay và không thiếu giá.
- **Không cờ `isPartial` riêng cho 2 field mới** — tái dùng `absolutePnlIsPartial`/`navValueIsPartial` đã có, vì chỉ `unrealizedPnl` bị ảnh hưởng khi thiếu giá (cùng điều kiện NAV không đầy đủ).
- **Không đổi Prisma schema** — mọi field cần (`Cashflow.holdingId/quantity/amount`, `Dividend.netAmount`, `HoldingSummary.totalCostBasis`) đã tồn tại.
- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (mục "Quy tắc & bất biến" + "Cách tính"), `docs/business-overview.md` (mục 5), `process/phase-6.md` (checklist mới), `process/PROCESS.md` (Phase 6 → 🟨 + nhật ký).
- Tham chiếu: GitHub issue #67.

---

## Quyết định liên quan ở file khác

- Tập `Dividend` trong chuỗi XIRR gồm `CASH` + `BOND_COUPON`, một nguồn sự thật `CASH_FLOW_DIVIDEND_TYPES`, và cái bẫy sót call site `getAllCashDividendsForXirr()` — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md), mục 2026-07-29 điểm (1).
- Chi phí ăn mòn (`costDragAmount`/`grossInvested`) — [`tax-and-fees.md`](./tax-and-fees.md), mục 2026-07-17 (4) và (6).
- "XIRR bình quân" của vị thế đã đóng (weighted average) — [`pricing-and-valuation.md`](./pricing-and-valuation.md), mục 2026-07-21 (2) điểm (2).
