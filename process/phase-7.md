# Phase 7 — Trái tức (lãi trái phiếu) & đáo hạn

## Mục tiêu
Ghi nhận lãi định kỳ (trái tức) và tất toán đáo hạn cho `Holding{type: BOND}` — bổ sung ngoài Phase 4 (Phase 4 chỉ scope cổ tức tiền mặt/cổ phiếu cho STOCK/FUND). Toàn bộ điểm mở treo từ 2026-07-17 đã được chốt ở 2026-07-25 (xem `process/DECISION.md`), phase này chỉ còn việc hiện thực.

## Công việc cần làm

### 1. Schema & Setting
- [x] Bảng mới **`BondTerms`** (1-1 với `Holding` qua `holdingId @unique`, `onDelete: Cascade`) — **không** thêm cột nullable vào `Holding`. Field: `issuerType` (enum `BondIssuerType`: `CORPORATE`/`GOVERNMENT`), `parValue`, `couponRatePercent?`, `couponFrequencyMonths?`, `firstCouponDate?`, `maturityDate?`, `nextCouponDateOverride?`. Xem `docs/02-data-model.md`. (issue #56)
- [x] Validate ở tầng app: chỉ tạo/sửa `BondTerms` cho `Holding{type: BOND}` (quan hệ 1-1 không tự ràng buộc được điều này) — `src/lib/bond-terms.ts::assertBondHoldingType()`. (issue #56)
- [x] Enum: `DividendType += BOND_COUPON`, `CashflowType += MATURITY`, thêm `BondIssuerType`. (issue #56)
- [x] `Dividend` thêm `parValueApplied?`/`couponRatePercentApplied?` — đóng băng thông số đã dùng để tính tại thời điểm ghi. (issue #56) **Bổ sung ở #58: `couponFrequencyMonthsApplied?`** — kỳ trả lãi nằm trong nhãn lịch sử nên phải bất biến như 2 field kia; suy ngược từ `grossAmount` là bẫy (mẫu số chứa SL-tại-ngày-ghi, không đóng băng). Xem `DECISION.md` 2026-07-28 (3).
- [x] Seed `Setting`: `BOND_INTEREST_TAX_RATE_CORPORATE = 5`, `BOND_INTEREST_TAX_RATE_GOVERNMENT = 0` (seed tường minh cả giá trị 0). (issue #56) — **Migration thật (`prisma migrate dev`) CHƯA chạy được** trên Claude Cloud (thiếu Postgres/Docker, hạn chế hạ tầng đã biết); đã xác nhận `pnpm prisma generate`/`pnpm prisma validate` sạch và schema migration-ready. Cần chạy `prisma migrate dev` thật trên Claude Local trước khi coi phần DB là xong tuyệt đối.

### 2. Dọn nợ enum trước khi thêm giá trị (bắt buộc, làm TRƯỚC bước 3)
Thêm giá trị vào `DividendType`/`CashflowType` sẽ **sai âm thầm** ở các điểm phân nhánh nhị phân hiện có — TypeScript không bắt được. Rule mới: `docs/rules/typescript-style.md` mục "Enum".
- [x] Tạo `src/lib/assert-never.ts` và `src/lib/enums.ts` (danh sách giá trị runtime + `satisfies` + check bắt thiếu giá trị).
- [x] Chuyển các điểm rẽ nhánh sang `switch` exhaustive; nhãn UI sang `Record<EnumType, string>`. Danh sách đã rà (không phải suy đoán):
  - `src/features/dividends/queries.ts` — `if (type === "CASH") … else` (nhánh else non-null-assert `stockQuantity`, `BOND_COUPON` sẽ crash/sai); filter `type: "CASH"` ở `getTotalCashDividendReceived`.
  - `src/features/dividends/actions.ts` — chuỗi `type === "CASH"`.
  - `src/features/dividends/components/DividendHistoryList/DividendRowsFilter.tsx` — `type === "CASH" ? "Tiền mặt" : "Cổ phiếu"` (trái tức sẽ hiện nhãn "Cổ phiếu"); tab filter.
  - `src/features/dividends/types.ts`, `.../DividendHistoryList.tsx`, `schemas.ts` — union literal `"CASH" | "STOCK"` khai lại song song, đổi sang dẫn xuất từ Prisma.
  - `src/features/holdings/components/ClosedHoldingsSection/ClosedHoldingsSection.tsx` — lọc `type === "SELL"` để tìm lần đóng vị thế; **không sửa thì trái phiếu đáo hạn xong không hiện đúng ở mục "đã đóng"**.
  - `src/features/holdings/components/CashflowTimeline/CashflowTimeline.tsx` — nhãn/màu theo `kind`.
  - `src/features/holdings/components/TransactionForm/TransactionForm.tsx` — state union `"BUY" | "SELL"`.
- [x] Rà lại các predicate `=== "BUY"` (`lib/cost-basis.ts`, `lib/cost-drag.ts`, `lib/realized-pnl.ts`, `lib/portfolio-valuation.ts`): `MATURITY` rơi vào nhánh "không phải BUY" và hành xử **đúng** (giảm số lượng, không gộp giá vốn) — xác nhận lại bằng test, không sửa mù.

### 3. Server Action + tính toán
- [x] `dividend-math.ts`: hàm tính trái tức `gross = parValue × couponRatePercent/100 × couponFrequencyMonths/12 × SL tại ngày trả lãi`; thuế theo `issuerType`; `net = gross − tax`.
- [x] `recordDividend` nhánh `BOND_COUPON`: đọc thông số từ `BondTerms` (không hỏi lại user), ghi `parValueApplied`/`couponRatePercentApplied`, **BỎ QUA hoàn toàn bước bù pha loãng NAV** (xem tiêu chí bên dưới), **không ghi gì** vào `BondTerms`.
- [x] Hàm suy "kỳ trả lãi tới" (`firstCouponDate + k × frequency`, neo theo lịch hợp đồng, override thắng) — dùng chung cho Phase 8.
- [x] Server Action ghi `Cashflow{type: MATURITY}`: prefill `date = maturityDate`, `quantity` = toàn bộ đang giữ, `pricePerUnit = parValue`, `taxAmount = max(0, (pricePerUnit − avgCost) × quantity) × thuế lãi theo issuerType`, `feeAmount` từ `TRANSACTION_FEE_SELL_BOND`. Tất cả **chỉ prefill, không khoá**.
- [x] Quy ước thứ tự trong `buildQuantityTimeline`: cùng một ngày, `Dividend` xếp **trước** `Cashflow{type: MATURITY}` (trái tức kỳ cuối tính trên số dư trước khi tất toán).
- [x] `queries.ts::getDividendHistory` hiển thị lịch sử trái tức; rà lại `getTotalCashDividendReceived` và bộ lọc dòng tiền XIRR — **`Dividend{type: BOND_COUPON}` phải được đưa vào chuỗi XIRR** (`lib/xirr-cashflow.ts` nhận dividends đã lọc sẵn ở caller, hiện lọc cứng `type: "CASH"`).

### 4. Design & UI
- [x] Form tạo/sửa `Holding{type: BOND}`: nhập điều khoản trái phiếu một lần (loại phát hành, mệnh giá, coupon rate, kỳ trả lãi, ngày trả lãi kỳ đầu, ngày đáo hạn) — không hỏi lại mỗi lần ghi trái tức.
- [x] `DividendForm` hỗ trợ loại trái tức: chỉ hỏi ngày trả lãi (+ `paymentDate`), hiển thị số tiền tự tính từ `BondTerms` để user đối chiếu.
- [x] Màn/nút "Tất toán đáo hạn" cho `Holding{type: BOND}` có `maturityDate`; sau khi ghi thành công, nếu chưa có trái tức kỳ cuối tại/gần `maturityDate` thì **gợi ý ghi bổ sung**.
- [x] `DividendHistoryList` hiển thị đúng loại mới (nhãn "Trái tức", dòng phụ `9%/năm · kỳ 6 tháng` đọc từ field đã đóng băng); `CashflowTimeline` hiển thị `MATURITY` khác `SELL`.

## Tiêu chí hoàn thành
- [x] Ghi trái tức tạo dòng tiền dương đúng (sau thuế) vào chuỗi XIRR của `Holding` loại BOND — kiểm chứng bằng test, không chỉ bằng việc "đã ghi được bản ghi".
- [x] Thuế trái tức đúng theo `issuerType`: 5% với `CORPORATE`, **0% với `GOVERNMENT`** (miễn theo NĐ 253/2026/NĐ-CP).
- [x] **Ghi trái tức KHÔNG tạo `NavOverride` bù pha loãng** — có test khẳng định điều này (clean price trái phiếu không giảm theo coupon; nếu để chạy chung sẽ kéo NAV tụt tích luỹ qua từng kỳ, sai âm thầm).
- [x] Điều khoản trái phiếu lưu ở **`BondTerms`** (bảng riêng), `recordDividend` đọc từ đó và **không ghi ngược** field lịch nào; "kỳ trả lãi tới" luôn suy runtime từ `firstCouponDate`, không cộng tay.
- [x] Sửa `BondTerms` (vd nhập sai coupon rate) **không làm đổi** số tiền/nhãn của các trái tức đã ghi trước đó.
- [x] Đáo hạn ghi bằng `Cashflow{type: MATURITY}`, **không** chịu `SALE_TAX_BOND` 0.1%; trái phiếu mua chiết khấu tính đúng thuế lãi trên phần lợi tức; mua đúng mệnh giá ra thuế 0.
- [x] Trái tức kỳ cuối trùng ngày đáo hạn tính trên số lượng **trước** khi tất toán (không ra 0 đồng do thứ tự ghi).
- [x] Không còn điểm rẽ nhánh nhị phân theo `DividendType`/`CashflowType` trong `src/` (đã chuyển sang `switch` + `assertNever` / `Record`).
- [x] Docs domain (`03-dividends.md`, `07-tax.md`, `09-settings.md`, `10-cashflow-calendar.md`, `02-data-model.md`) đồng bộ với quyết định thật lúc implement.

## Trạng thái verify (cập nhật 2026-07-30 — hạ tầng đã chạy xong trên Claude Local)

Tiêu chí ở trên đã tick theo bằng chứng thật (code + unit test); hai việc hạ tầng từng treo trên Claude Cloud nay đã hoàn tất trên Claude Local (xem `TOOLS.md`):

- ✅ **`prisma migrate dev` thật** — migration `20260729233213_add_bond_terms_and_coupon_maturity` đã tạo và áp vào DB dev (bảng `BondTerms`, enum `BondIssuerType`, `CashflowType.MATURITY`, `DividendType.BOND_COUPON`, 3 cột đóng băng trên `Dividend`).
- ✅ **`pnpm e2e` (Playwright)** — toàn bộ **43/43** pass, gồm 2 kịch bản bắt buộc bên dưới (`e2e/tests/bond-coupon-and-maturity.spec.ts`).

**Bug phát hiện + sửa trong lúc chạy e2e thật (commit `3875282`):** `recordDividend()` forward thẳng `formData.get("percent")` (luôn `null` cho `BOND_COUPON`, field không được render) vào schema zod `.optional()` (chỉ chấp nhận `undefined`) — mọi lần ghi trái tức qua UI thật bị từ chối "Dữ liệu không hợp lệ", dù 372 unit test + build đều xanh (không phủ đường `FormData -> schema`). Sửa 1 dòng: coerce `|| undefined` như các field optional khác cùng khối.

**Hai kịch bản e2e BẮT BUỘC** — đã viết và PASS, `e2e/tests/bond-coupon-and-maturity.spec.ts` (cả hai bắt đúng lỗi đã sửa ngày 2026-07-29, và cả hai đều nằm ngoài tầm unit test):
1. **Ghi bù một kỳ trái tức cũ sau khi đã mua thêm** — `grossAmount`/`taxAmount`/`netAmount` phải cùng một cơ sở SL (SL **tại ngày trả lãi**), không lẫn SL hiện tại. ✅
2. **Trái tức kỳ cuối trả đúng ngày đáo hạn, ghi tất toán TRƯỚC rồi mới ghi trái tức** — bất biến `SETTLEMENT_RANK`; sai thì trái tức ra 0 đồng, im lặng. ✅
- ✅ `pnpm lint` / `pnpm typecheck` / `pnpm test` (**372/372**, 36 file) / `pnpm build` / `pnpm e2e` (**43/43**) sạch.

Cách các tiêu chí "khó test" được khoá lại khi chưa có e2e:
- *"Ghi trái tức KHÔNG tạo `NavOverride`"* — khoá bằng **kiểu**: union `RecordedDividend` (`build-dividend-form-state.ts`) cố ý không có field `priceAdjustment` ở nhánh `BOND_COUPON`, nên "quên bỏ qua" là lỗi compile; cộng test đầu ra khẳng định không có `navOverrideAdjusted`/`oldPrice`/`newPrice`.
- *"Trái tức được đưa vào chuỗi XIRR"* — bộ lọc dòng tiền dùng chung hằng số `CASH_FLOW_DIVIDEND_TYPES` (`lib/enums.ts`) thay vì 3 chỗ tự viết `type: "CASH"`. **Bản đầu bỏ sót chỗ thứ 3** (`getAllCashDividendsForXirr()` ở `lib/portfolio-valuation.ts`, ngoài tầng repository) nên trái tức vào XIRR từng vị thế mà biến mất khỏi XIRR cấp danh mục — sửa 2026-07-29, xem `DECISION.md`. Lưu ý: hằng số là dữ liệu, **không** phải cơ chế compiler; thêm call site mới vẫn phải grep cả `src/lib/`.
- *"Trái tức kỳ cuối trùng ngày đáo hạn"* — khoá bằng test thứ tự ở `lib/position-trail.test.ts` (3 ca: MATURITY ghi trước trái tức, probe đang ghi, candidate đang ghi).
- *"Sửa `BondTerms` không đổi nhãn kỳ đã ghi"* — khoá bằng **schema**: cả 3 thành phần của nhãn đọc thẳng từ `parValueApplied`/`couponRatePercentApplied`/`couponFrequencyMonthsApplied`, không có phép tính nào ở đường đọc nên không có gì để trôi. (Bản đầu suy ngược kỳ trả lãi từ `grossAmount` đã bị bỏ — mẫu số của phép đảo chứa SL-tại-ngày-ghi, không đóng băng; xem `DECISION.md` 2026-07-28 (3).)

## Việc còn treo sang sau (không chặn Phase 7)

Cả hai đã được **giao cho Phase 8** ở lần rà spec 2026-07-31 (dùng chung truy vấn/màn với lịch dòng tiền) — xem `process/phase-8.md` mục 2 và `DECISION.md` 2026-07-31 (11)(12).

- **Callout "quá đáo hạn" ở màn Danh mục (mockup 7h)** — hiện chỉ gắn ở **chi tiết vị thế** (`getBondHoldingActions`). Bản danh mục cần batch `BondTerms.maturityDate` cho toàn bộ vị thế mở; `OverdueMaturityCard` (đã dựng ở #57) vẫn chỉ có preview.
- **Ô nhập `nextCouponDateOverride`** — cột + logic ưu tiên đã có, form 7a chưa có ô. Xoay xở bằng cách sửa thẳng ngày trên form ghi trái tức. Xem `docs/domain/10-cashflow-calendar.md`. Lưu ý Phase 8 còn **thu hẹp ngữ nghĩa** của cột này (chỉ áp cho kỳ chưa ghi) — cài đặt Phase 7 cho override thắng vô điều kiện là bug tiềm ẩn khi lịch có nhiều kỳ.

## Phụ thuộc / ghi chú
- Phụ thuộc Phase 4 (model `Dividend`, `DividendForm`, `recordDividend` đã có) — mở rộng, không dựng lại từ đầu.
- **Là tiền đề bắt buộc cho Phase 8** (Lịch dòng tiền sắp tới) — `BondTerms` và hàm suy "kỳ trả lãi tới" phải làm ở Phase 7; Phase 8 chỉ đọc, không tự thêm schema.
- **Ngoài phạm vi, ghi rõ để khỏi hiểu nhầm là bỏ sót:**
  - **Lãi dồn tích (accrued interest)** khi mua/bán giữa hai kỳ coupon — giá thanh toán thực tế gồm clean price + accrued interest, Navtrack gộp cả vào `pricePerUnit`. Chấp nhận được vì người dùng mua sơ cấp và giữ tới đáo hạn; nếu chuyển sang mua thứ cấp thường xuyên thì kỳ coupon đầu sẽ trông như lãi vượt trội và `avgCost` hơi cao.
  - **Trái phiếu lãi suất thả nổi** — model giả định coupon rate cố định. Sửa `BondTerms` giữa chừng không hồi tố các kỳ đã ghi (nhờ field đóng băng), nên vẫn dùng tạm được.
  - **Trái phiếu trả gốc dần (amortizing)** — giả định trả gốc một lần khi đáo hạn; ghi tay nhiều dòng `MATURITY` với `quantity` một phần là cách xoay xở, không có hỗ trợ riêng.
