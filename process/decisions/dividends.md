# Quyết định — Cổ tức (tiền mặt & cổ phiếu)

Phạm vi: `Dividend{CASH|STOCK}`, thuế cổ tức, bù pha loãng NAV khi chia cổ tức, `recordDividend`.
Spec tương ứng: [`docs/domain/03-dividends.md`](../../docs/domain/03-dividends.md).

> Trái tức (`BOND_COUPON`) KHÔNG nằm ở đây — xem [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md).

---

## 2026-07-16 — Issue #52: `DIVIDEND_PAR_VALUE`, `avgCost` giữ nguyên, SL-tại-ngày-ghi

**Status:** Superseded một phần bởi 2026-08-13 — điểm "avgCost giữ nguyên"; phần Setting mới + SL-tại-ngày-ghi vẫn Accepted

**Issue #52: `DIVIDEND_PAR_VALUE` Setting mới; `avgCost` giữ nguyên khi STOCK dividend; SL-tại-ngày-ghi replay cả Cashflow + Dividend.**
- **`DIVIDEND_PAR_VALUE` + `DIVIDEND_TAX_RATE` đều là Setting mới** (trước #52, chỉ có `MAX_MEMBERS`); seed `effectiveFrom = 2020-01-01`: `TAX_RATE = "5"`, `PAR_VALUE = "10000"`. Không hard-code mệnh giá (Setting = runtime config).
- **`avgCost` giữ nguyên** — `recordDividend` chỉ `update({ quantity })`, KHÔNG gọi `derivePosition()`/`buildQuantityTimeline()` lại (STOCK dividend chỉ CỘNG, không "bán vượt" cần validate).
- **SL-tại-ngày-ghi:** tổng quát `derivePosition()` thành `buildQuantityTimeline()` — phát lại TOÀN BỘ Cashflow + Dividend STOCK, cộng "probe event" (`delta=0`) tại ngày ghi để đọc `.before`. Cần vì ghi cổ tức có thể lùi ngày so với giao dịch gần nhất.
- **`Dividend` không lưu `percent`** — suy ngược `percentLabel`/`quantityBefore/After` từ data + `buildQuantityTimeline()`, không thêm cột schema.
- **`recordDividend` không trigger snapshot** — chưa quyết định nghiệp vụ. *(Đã đóng ở 2026-07-17 (2) bên dưới.)*
- Docs đã sync: `docs/domain/03-dividends.md`, `docs/domain/09-settings.md`, `docs/domain/01-assets-and-holdings.md`, `process/phase-4.md`.

---

## 2026-07-16 (2) — Issue #52 fix: floor `stockQuantity` + override, tolerance 2 đơn vị

**Status:** Accepted

**Issue #52 fix: `computeStockDividend` floor `stockQuantity` + user override, tolerance 2 đơn vị.**
- Bối cảnh: `stockQuantity = quantity × percent/100` không làm tròn → số lẻ CP (vd 105 × 12% = 12.6) — vô lý.
- `computeStockDividend()` trả `{ rawStockQuantity, stockQuantity, wasRounded }`. `stockQuantity = floor(raw)` mặc định lưu DB. Thêm `stockQuantityOverride` vào schema cho phép user sửa; validate sai lệch ≤ `TOLERANCE = 2` so với raw. **Validate TRONG transaction** (sau khi có `quantityAtDate`/`rawStockQuantity` từ `holding.cashflows/dividends`), override sai → return `{ ok: false, fieldErrors }`.
- Cache `Holding.quantity` cộng `finalStockQuantity` (floor hoặc override); `avgCost` giữ nguyên.
- **Không lưu `wasRounded`/`rawAddedQuantity`** — chỉ derive trong `DividendRecordedResult` để display cảnh báo.
- Docs đã sync: `docs/domain/03-dividends.md`.

---

## 2026-07-17 — Issue #61: `recordDividend` tự tạo `NavOverride` bù pha loãng NAV; thêm `Dividend.paymentDate`

**Status:** Accepted (mốc dòng tiền XIRR của `paymentDate` đã đảo một phần ở [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md) mục 2026-07-19)

**Issue #61 (follow-up nhỏ của Phase 4): `recordDividend` tự tạo `NavOverride` bù pha loãng NAV; thêm `Dividend.paymentDate` (thuần thông tin).**
- Bối cảnh: `STOCK` dividend cộng `Holding.quantity` NGAY khi ghi nhưng giá (`PriceQuote`/`NavOverride`) chưa đổi kịp → NAV vị thế bị thổi phồng tạm thời tới khi có giá mới. `CASH` dividend cũng lệch giá theo hướng ngược lại (tiền rời khỏi vốn công ty, giá ex-dividend thường giảm tương ứng ngoài thị trường thật nhưng hệ thống chưa phản ánh).
- Quyết định: thêm 2 hàm thuần `computeStockDividendPriceAdjustment`/`computeCashDividendPriceAdjustment` (`features/dividends/dividend-math.ts`) và gọi trong `recordDividend` TRƯỚC `tx.dividend.create`, ghi `NavOverride` **tại `date`** (ngày chia, KHÔNG phải `paymentDate` mới thêm) qua `upsert` theo `(holdingId, date)` đã có sẵn. Đọc giá cũ TRONG transaction bằng `tx.navOverride.findFirst`/`tx.priceQuote.findFirst` (KHÔNG dùng `getLatestNavOverrides`/`getLatestPriceQuotes` của `lib/valuation.ts` — 2 hàm đó đọc `db` ngoài transaction + `unstable_cache`, không an toàn với race của transaction ghi cổ tức), nhưng vẫn TÁI DÙNG `resolvePrice()` (hàm thuần, không phụ thuộc nguồn đọc) để không lặp lại logic ưu tiên giá.
- **`priceAlreadyReflectsMarket`** (field mới trong `recordDividendSchema`, KHÔNG lưu vào `Dividend`): cờ để user tắt hoàn toàn bước tự điều chỉnh khi biết giá hiện có đã đúng. Submit qua hidden input chuỗi `"true"/"false"` — dùng `z.enum(["true","false"]).transform()`, KHÔNG dùng `z.coerce.boolean()` (coi mọi string non-empty kể cả `"false"` là `true`).
- **`Dividend.paymentDate` (mới, optional, `DateTime` không `@db.Date`** khớp kiểu `date` hiện có cùng model**)**: ngày tiền/CP thực về tài khoản — THUẦN THÔNG TIN, không dùng cho bất kỳ tính toán nào (không XIRR, không quantity timeline, không phải mốc ghi `NavOverride` — luôn ghi tại `date`).
- **Không clamp giá điều chỉnh âm/0** — chưa chốt spec cho ca biên này (để ngỏ, ghi comment trong code). *(Đã đóng ở 2026-07-17 (3) bên dưới.)*
- **Không xử lý MISSING_PRICE** khác gì bình thường — bỏ qua bước tạo `NavOverride`, dividend vẫn ghi thành công.
- **UI (checkbox `priceAlreadyReflectsMarket`, input `paymentDate`) do `design-implementer` làm riêng ngay sau đó** — kéo lại mockup Figma mới (`Phase 4 Screens.dc.html`, bản cập nhật cho issue #61) qua DesignSync thay vì dùng cache cũ trước Phase 4, sửa `DividendForm.tsx` bind đúng contract `business-implementer` đã chuẩn bị. e2e cho ca "tick checkbox" đã đổi từ inject `page.evaluate()` sang tương tác checkbox thật (`getByRole("checkbox")`) khi `verifier` kiểm chứng lại.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức" mới, cập nhật Entity/field), `docs/domain/04-pricing-and-valuation.md` (thêm dòng cross-reference ở "Ca biên"), `docs/02-data-model.md` (field `paymentDate` trong snippet `Dividend`).

---

## 2026-07-17 (2) — Ghi cổ tức KHÔNG tự trigger `Snapshot{MANUAL}`

**Status:** Accepted — đóng điểm treo từ #52

**Đóng quyết định treo từ #52: ghi cổ tức KHÔNG tự trigger `Snapshot{period: MANUAL}` (khác mua/bán).**
- Bối cảnh: mọi giao dịch mua/bán (`createHolding`/`addTransaction`/`updateTransaction`/`deleteTransaction`) tự gọi `freezeManualSnapshot()` sau khi commit — đóng băng một mốc `Snapshot{date: hôm nay, period: MANUAL}`. `recordDividend` không làm việc này, để ngỏ từ Phase 4 (#52) như một quyết định nghiệp vụ chưa chốt; issue #61 (bù pha loãng NAV) không đụng tới.
- Quyết định: **giữ nguyên — không trigger.** Lý do: mua/bán là quyết định phân bổ vốn thật (tiền vào/ra), NAV danh mục thực sự đổi — đóng một mốc ngay sau đó tách bạch được "NAV đổi vì giao dịch" khỏi "NAV đổi vì giá thị trường". Ghi cổ tức thì ngược lại: cơ chế `NavOverride` bù pha loãng (#61) được thiết kế **cố tình giữ NAV gần như liên tục** qua sự kiện chia cổ tức (STOCK: SL tăng, giá giảm tương ứng, tổng giá trị bất biến; CASH: giá ex-dividend giảm đúng bằng phần gross rời khỏi vốn, NAV cũng gần bất biến — cổ tức nhận về chỉ sống trong dòng tiền XIRR, không phải một tài sản Navtrack theo dõi số dư). Một Snapshot MANUAL đóng ngay sau ghi cổ tức gần như sẽ trùng số với mốc gần nhất (chỉ lệch do làm tròn floor SL cổ phiếu), không mang thêm thông tin, trong khi tạo thêm nhiễu ở "Các mốc đã chốt" (UI hiện chỉ có 1 badge "THỦ CÔNG" chung cho mọi trigger MANUAL — user dễ nhầm là một giao dịch thật đã xảy ra ngày đó).
- Ca biên đã cân nhắc: khi `MISSING_PRICE` (không có giá cũ để bù), NAV có thể lệch thật do SL tăng "chay" không giá đi kèm — nhưng đúng lúc này Snapshot cũng tự bỏ qua Holding đó (không resolve được giá, theo rule ở `06-snapshots.md`), nên trigger snapshot cũng không cứu được ca này.
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức", bỏ khung "quyết định treo", ghi rõ đã chốt + lý do).

---

## 2026-07-17 (3) — `computeCashDividendPriceAdjustment` trả `null` khi giá điều chỉnh ra âm/0

**Status:** Accepted

> ⚠️ Nhãn `2026-07-17 (3)` bị dùng cho **hai** quyết định khác nhau trong file gốc. Entry còn lại (thảo luận nghiệp vụ Phase 5 về thuế bán) nằm ở [`tax-and-fees.md`](./tax-and-fees.md). Citation `docs/domain/03-dividends.md` "mục 2026-07-17 (3)" trỏ tới **entry này**.

**Đóng review finding #5 (PR #62): `computeCashDividendPriceAdjustment` trả `null` khi giá điều chỉnh ra âm/0.**
- Bối cảnh: `giá_mới = giá_cũ − grossAmount/SL` (nhánh CASH) là phép TRỪ nên có thể ra âm/0 thật — ca thực tế: CP giao dịch **dưới mệnh giá** (khá phổ biến ở CP nhỏ/thanh khoản thấp trên TTCK Việt Nam) kết hợp **%cổ tức cao** trên mệnh giá (một số công ty chia cổ tức đặc biệt >100% mệnh giá từ thanh lý tài sản/lợi nhuận bất thường), hoặc **nhiều đợt cổ tức liên tiếp cùng holding** dồn giá xuống dần (mỗi đợt trừ tiếp vào giá đã điều chỉnh của đợt trước). Nhánh `STOCK` KHÔNG có rủi ro này — `giá_mới = giá_cũ × SL_trước/SL_sau` là phép NHÂN với tỷ lệ luôn dương, không thể ra âm/0 trừ khi `giá_cũ` vốn đã hỏng sẵn (ngoài phạm vi tính năng này).
- **Trước fix:** `if (newPrice)` ở `recordDividend` (`features/dividends/actions.ts`) chỉ kiểm tra `newPrice !== null` — một `Decimal` instance LUÔN truthy trong JS bất kể giá trị âm/0/dương, nên giá âm/0 vẫn bị ghi thẳng vào `NavOverride` trước fix này.
- Quyết định: **xử lý giống `MISSING_PRICE`** — `computeCashDividendPriceAdjustment()` trả `null` khi kết quả `<= 0` (dùng `.gt(0)`, không dùng `.isPositive()` vì API đó có thể coi `0` dương tùy dấu nội bộ của decimal.js). Caller (`recordDividend`) không cần sửa gì thêm — `if (newPrice)` đã coi `null` = bỏ qua tạo `NavOverride`, dividend vẫn ghi thành công bình thường. Không clamp về một sàn tối thiểu (vd 1 VND) — giá trị đó không phản ánh đúng công thức bù trừ, không mang ý nghĩa tài chính thật, dễ gây hiểu nhầm hơn là hữu ích.
- Không thêm log cảnh báo riêng cho ca này — giữ nhất quán với `MISSING_PRICE` (cũng không có log riêng, xem `docs/domain/03-dividends.md` "Không xử lý MISSING_PRICE khác gì bình thường").
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Bù pha loãng NAV khi ghi cổ tức", đổi "Ca biên chưa xử lý" thành đã chốt).

---

## 2026-08-13 — Bugfix: `avgCost` PHẢI dilute qua cổ tức cổ phiếu (đảo điểm "giữ nguyên" của 2026-07-16)

**Status:** Accepted — supersedes 2026-07-16 (điểm "avgCost giữ nguyên khi STOCK dividend"); phần Setting mới + SL-tại-ngày-ghi của 2026-07-16 KHÔNG đổi, vẫn Accepted

**`avgCost` bị PHA LOÃNG (dilute) khi nhận cổ tức cổ phiếu, theo công thức đóng — "avgCost giữ nguyên" (chốt ở 2026-07-16) là BUG, không phải quy tắc domain đúng.**
- Bối cảnh: cả 3 nơi tính `avgCost` (`derivePosition()` ở `lib/cost-basis.ts`, `computeRealizedGainForHolding()` ở `lib/realized-pnl.ts`, và `recordStockDividend()` ở `features/dividends/actions.ts`) đều cố tình bỏ qua sự kiện `Dividend{STOCK}` khi tính `avgCost`, theo đúng quyết định gốc 2026-07-16. Nhưng nhận cổ tức cổ phiếu KHÔNG tốn thêm tiền — tổng vốn gốc đã bỏ ra giữ nguyên, chỉ chia đều cho nhiều CP hơn, nên giá vốn TRÊN MỖI CP phải giảm. Không dilute khiến `avgCost` bị giữ cao giả tạo, làm `realizedGain` (lãi/lỗ đã thực hiện) tính **THẤP hơn thực tế** khi bán sau khi đã nhận cổ tức cổ phiếu — báo lãi ít hơn hoặc lỗ nhiều hơn thực, sai theo hướng bi quan.
  - Ví dụ minh hoạ: mua 100 CP giá 100.000 (avgCost=100.000, vốn gốc 10.000.000). Nhận cổ tức cổ phiếu 25% → +25 CP, giữ 125 CP, vẫn cùng 10.000.000 vốn gốc → avgCost ĐÚNG = 10.000.000/125 = 80.000/CP (không phải 100.000 như code cũ giữ). Bán 125 CP giá 90.000: `realizedGain` đúng = 125×(90.000−80.000) = 1.250.000 lãi; code cũ (avgCost=100.000 sai) sẽ tính ra 125×(90.000−100.000) = −1.250.000 lỗ — SAI DẤU hoàn toàn, không chỉ sai độ lớn.
- Quyết định: công thức đóng — `avgCost_mới = SL_trước × avgCost_cũ / SL_sau` (SL_sau = SL_trước + SL cổ tức nhận thêm; SL_sau=0 → `avgCost=0`, ca biên dữ liệu không hợp lệ). Áp dụng đồng bộ ở cả 3 nơi:
  - `derivePosition()`: đổi vòng lặp avgCost từ chỉ-duyệt-BUY sang duyệt CẢ BUY LẪN `Dividend{STOCK}` theo đúng thứ tự thời gian (`sortByPositionTrailOrder`), mirror cấu trúc union sự kiện đã có ở `computeRealizedGainForHolding`.
  - `computeRealizedGainForHolding()`: nhánh `STOCK_DIVIDEND` (trước đây chỉ `realQuantity += quantity; continue`) giờ dilute `avgCost` TRƯỚC khi cộng dồn `realQuantity`.
  - `recordStockDividend()` (write-path, **KHÔNG replay lại toàn bộ lịch sử** — giữ nguyên lý do hiệu năng của quyết định gốc 2026-07-16, chỉ đổi công thức áp lên cache hiện có): tính `avgCost_mới` từ `Holding.quantity`/`avgCost` hiện tại, ghi qua `persistPosition()` (`features/holdings/repository.ts`, dùng chung với 4 Server Action mua/bán) thay vì `updateHoldingQuantity()` (chỉ ghi `quantity`, đã xoá — dead code sau khi không còn call site).
  - `findDividendPositionSource()` (`features/dividends/repository.ts`) thêm select `avgCost` của `Holding` — trước đây thiếu vì write-path cũ không cần đọc nó.
- **Backfill production:** production đã có record cổ tức cổ phiếu thật (user xác nhận — khác giả định "chưa có" ở `transactions-and-cost-basis.md` mục 2026-07-24 (3), đã lỗi thời) → mọi `Holding` có `Dividend{type: STOCK}` cần recompute lại `avgCost` cache theo `derivePosition()` đã sửa. Viết `scripts/backfill-stock-dividend-avgcost.ts` (dry-run mặc định, chỉ ghi khi truyền `--apply`, mỗi holding một transaction riêng qua `persistPosition()`, KHÔNG đụng `Cashflow`/`Dividend` gốc) — **chưa chạy `--apply` lên production trong phiên sửa bug này**, cần chạy riêng sau khi review.
- Ca biên: `SL_sau = 0` (nhận cổ tức khi không giữ CP nào) là trạng thái dữ liệu không hợp lệ theo domain, không xử lý gì thêm ngoài tránh chia-cho-0.
- Docs đã sync: `docs/domain/01-assets-and-holdings.md`, `docs/domain/02-transactions-and-cost-basis.md`, `docs/domain/03-dividends.md`, `docs/domain/05-returns-xirr-and-pnl.md`.

---

## Quyết định liên quan ở file khác

- Mốc dòng tiền XIRR của cổ tức tiền mặt (`paymentDate ?? date`) — [`returns-xirr-and-pnl.md`](./returns-xirr-and-pnl.md), mục 2026-07-19.
- Trái tức `BOND_COUPON` (không bù pha loãng NAV, thuế riêng, override gộp) — [`bonds-and-cashflow-calendar.md`](./bonds-and-cashflow-calendar.md).
- Tách `DividendForm.tsx` theo variant component — [`architecture-and-code-quality.md`](./architecture-and-code-quality.md), mục 2026-07-28.
