# Quyết định — Trái phiếu, trái tức & lịch dòng tiền

Phạm vi: `BondTerms`, `Dividend{BOND_COUPON}`, `Cashflow{MATURITY}`, thuế lãi trái phiếu, lịch coupon/đáo hạn (Phase 7 + 8).
Spec tương ứng: [`docs/domain/10-cashflow-calendar.md`](../../docs/domain/10-cashflow-calendar.md), [`docs/domain/03-dividends.md`](../../docs/domain/03-dividends.md) (nhánh `BOND_COUPON`), [`docs/domain/07-tax.md`](../../docs/domain/07-tax.md).

---

## 2026-07-25 (2) — Rà spec Phase 7 (trái tức): chốt 4 điểm mở + 3 lỗi thiết kế mới

**Status:** Accepted — điểm (2) về `couponFrequencyMonths` đã bị đảo ở [2026-07-28 (3)](#2026-07-28-3--đảo-quyết-định-2-kỳ-trả-lãi-phải-là-một-cột-đóng-băng)

**Rà spec Phase 7 (trái tức) dưới góc nhìn tài chính + kỹ thuật trước khi implement — chốt toàn bộ 4 điểm mở treo từ 2026-07-17, phát hiện thêm 3 lỗi thiết kế chưa từng có trong spec. Phạm vi đợt này: CHỈ tài liệu, không đụng code.**

Bối cảnh: user đặt vấn đề "5 field trái phiếu nên tách bảng riêng thay vì thêm cột vào `Holding`", rà lại cả spec thì thấy chuyện đặt cột ở đâu không phải vấn đề nặng nhất.

- **(1) Tách bảng `BondTerms` (1-1 với `Holding`) — đồng ý, nhưng KHÔNG vì lý do "tránh cột thừa".** Cột NULL trong Postgres gần như miễn phí (null bitmap) và bảng chỉ có vài chục dòng, nên lý do dung lượng không đứng vững. Ba lý do thật: (a) nhóm field này không dừng ở 5 — còn `issuerType` (thuế), `firstCouponDate` (mốc neo lịch), và sẽ còn nữa nếu mở rộng (ngày phát hành, day-count) → `Holding` phình thành god-table; (b) ngữ nghĩa khác hẳn — `Holding` là **vị thế** (position), `BondTerms` là **đặc tả công cụ** (instrument spec), hai thực thể tách bạch kinh điển trong tài chính; (c) tách bảng làm lộ ra `nextCouponDate` không thuộc nhóm đó → dẫn tới quyết định (2). Lưu ý đã ghi vào docs: tách bảng **không** tự cho ràng buộc "chỉ BOND mới có" — vẫn phải validate ở app.
- **(2) Bỏ `nextCouponDate` (cộng tay) → `firstCouponDate` (mốc neo tĩnh) + suy runtime.** Đảo thiết kế ghi ở `docs/domain/10-cashflow-calendar.md` cũ. Thiết kế cũ ("cộng `couponFrequencyMonths` vào `date` vừa ghi") tái phạm đúng thứ mà bất biến `Holding.quantity`/`avgCost` cấm — cộng/trừ tay trên giá trị suy ra được — và gây 2 lỗi nghiệp vụ cụ thể: **lịch coupon trôi dần** (cộng từ ngày nhận thực tế thay vì lịch hợp đồng, sai số tích luỹ qua các kỳ) và **nhảy ngược về kỳ đã nhận** khi user ghi bù kỳ cũ bỏ sót. Suy runtime rẻ (vài phép cộng tháng, không replay lịch sử) nên không có lý do materialize. Giữ `nextCouponDateOverride` cho ca tổ chức phát hành đổi lịch thật (tinh thần `NavOverride`).
- **(3) Trái tức KHÔNG bù pha loãng NAV — lỗi chưa từng có trong spec, mức độ nghiêm trọng nhất đợt rà.** `recordDividend` (Phase 4) tự tạo `NavOverride` trừ giá theo cổ tức gộp/CP. Logic đó đúng với cổ phiếu (tiền rời khỏi vốn công ty → thị giá điều chỉnh) nhưng **sai với trái phiếu**: coupon là nghĩa vụ trả lãi theo hợp đồng, **clean price không giảm theo coupon** (cái reset là lãi dồn tích trong dirty price — Navtrack không mô hình hoá). Vì `recordDividend` là hàm dùng chung, để mặc định chạy qua sẽ kéo giá trái phiếu tụt **tích luỹ** qua từng kỳ, NAV sai dần âm thầm không có tín hiệu lỗi. Nhánh `BOND_COUPON` phải chặn tường minh ngay đầu.
- **(4) Thuế lãi trái phiếu: 2 key riêng, KHÔNG dùng chung `DIVIDEND_TAX_RATE`.** Đã **tra cứu thực tế** (không suy diễn) theo yêu cầu của user: lãi trái phiếu doanh nghiệp là thu nhập từ đầu tư vốn, chịu **5%** khấu trừ tại nguồn; **lãi trái phiếu Chính phủ và chính quyền địa phương được MIỄN thuế TNCN** — khoản 7 trong 22 trường hợp miễn thuế tại **Nghị định 253/2026/NĐ-CP** (hiệu lực 01/07/2026, đúng nghị định đã dùng làm căn cứ cho `SALE_TAX_BOND` ở 2026-07-18 (5)). Vì mức thuế **phụ thuộc tổ chức phát hành**, một key duy nhất không biểu diễn được → `BOND_INTEREST_TAX_RATE_CORPORATE = 5` + `BOND_INTEREST_TAX_RATE_GOVERNMENT = 0` (seed tường minh cả giá trị 0, tiền lệ `SALE_TAX_GOLD`), chọn theo `BondTerms.issuerType` mới. **Miễn thuế chỉ áp cho phần LÃI** — bán trái phiếu Chính phủ trước hạn vẫn chịu `SALE_TAX_BOND` 0.1%, không được suy rộng.
- **(5) Đáo hạn: thêm `CashflowType.MATURITY`, thuế tính trên phần lợi tức chứ không phải 0 cứng.** Đóng điểm mở treo từ 2026-07-17 (`docs/domain/07-tax.md` mục "Ca biên"). Chọn enum mới thay vì "ghi SELL rồi tự xoá thuế" vì với người dùng Navtrack **giữ tới đáo hạn là ca thường xuyên**, bán thứ cấp mới là ngoại lệ — luồng thường xuyên không nên đi mượn hình thức của luồng hiếm. Tra cứu xác nhận: đáo hạn không phải chuyển nhượng (không chịu 0.1%) nhưng phần chênh giữa mệnh giá nhận về và giá vốn **là lãi**, chịu thuế lãi ở trên → `taxAmount = max(0, (pricePerUnit − avgCost) × quantity) × thuế lãi`. Mua đúng par thì `avgCost ≥ parValue` (đã gồm phí mua) → ra 0 tự nhiên, không cần nhánh riêng. Giả định đã ghi rõ: dùng `avgCost` (gồm phí mua) làm căn cứ trừ là rộng hơn luật một chút, lệch về phía thấp, form không khoá nên sửa được.
- **(6) Đóng băng thông số trái tức vào `Dividend`** (`parValueApplied`/`couponRatePercentApplied`). Đóng điểm mở (3) cũ về `percentLabel`: không cần công thức suy ngược nào, đọc thẳng giá trị đã lưu. Lý do: `BondTerms` sửa được về sau (nhập sai, trái phiếu thả nổi) — nếu lịch sử đọc lại giá trị hiện tại thì mọi kỳ cũ hiển thị sai, trái nguyên tắc "thuế/phí đã tính không hồi tố".
- **(7) Ràng buộc thứ tự: trái tức kỳ cuối trùng ngày đáo hạn.** `buildQuantityTimeline()` sort theo `date` rồi `createdAt`; ghi `MATURITY` trước rồi ghi coupon kỳ cuối **cùng ngày** → "SL tại ngày trả lãi" = 0 → coupon ra **0 đồng**, sai âm thầm, mà đó lại là thứ tự thao tác tự nhiên nhất. Quy ước: trong cùng một ngày, `Dividend` xếp **trước** `Cashflow{type: MATURITY}` — tie-break theo bản chất sự kiện, không theo `createdAt`.
- **(8) Rule mới về enum (user yêu cầu bổ sung sau khi thấy footgun ở (9)).** Enum nghiệp vụ khai ở `prisma/schema.prisma` là nguồn sự thật duy nhất, TS **dẫn xuất** từ `@prisma/client` — cấm khai lại union literal song song; giá trị runtime gom vào `src/lib/enums.ts` với `satisfies` + check bắt **thiếu** giá trị (dùng `import type` để không kéo Prisma vào bundle Client Component). Mọi điểm rẽ nhánh theo enum dùng `switch` exhaustive + `assertNever`; nhãn UI dùng `Record<EnumType, string>`; cấm `if/else` hay ternary nhị phân khi nhánh `else` mang giả định về giá trị còn lại. ESLint hiện chưa bật type-aware linting nên `@typescript-eslint/switch-exhaustiveness-check` chưa dùng được — `assertNever` + `Record` là cơ chế thực thi vì chỉ cần compiler. Ghi ở `docs/rules/typescript-style.md` (mục "Enum") + `docs/rules/schema.md` + index `docs/coding-rules.md`.
- **(9) Nợ kỹ thuật phải trả TRƯỚC khi thêm giá trị enum ở Phase 7** — đã grep, không suy đoán. Code dividends dùng **kiểm tra nhị phân** khắp nơi: `queries.ts` có `if (type === "CASH") … else` với nhánh else non-null-assert `stockQuantity` (`BOND_COUPON` rơi vào đây → sai/crash), `DividendRowsFilter.tsx` hiện nhãn "Cổ phiếu" cho mọi loại không phải CASH, `getTotalCashDividendReceived` + caller của `lib/xirr-cashflow.ts` lọc cứng `type: "CASH"` (**không sửa thì tiêu chí "trái tức vào chuỗi XIRR" không đạt mà không test nào fail**), `types.ts`/`schemas.ts` khai lại union song song. Với `CashflowType` rủi ro thấp hơn: code hầu như chỉ hỏi `=== "BUY"` nên `MATURITY` tự hành xử đúng ở `derivePosition`/cost basis/cost drag; chỉ 3 chỗ phải sửa (`ClosedHoldingsSection.tsx` lọc `=== "SELL"` để tìm lần đóng vị thế — không sửa thì trái phiếu đáo hạn không hiện đúng ở mục "đã đóng"; `CashflowTimeline.tsx`; `TransactionForm.tsx`). Danh sách đầy đủ đã ghi thành checklist trong `process/phase-7.md` mục 2.
- **Ngoài phạm vi, ghi rõ trong `phase-7.md` để không bị hiểu là bỏ sót:** lãi dồn tích (accrued interest) khi mua/bán giữa hai kỳ coupon; trái phiếu lãi suất thả nổi; trái phiếu trả gốc dần (amortizing).
- Docs đã sync: `docs/02-data-model.md`, `docs/domain/03-dividends.md`, `docs/domain/07-tax.md`, `docs/domain/09-settings.md`, `docs/domain/10-cashflow-calendar.md`, `docs/rules/typescript-style.md`, `docs/rules/schema.md`, `docs/coding-rules.md`, `process/phase-7.md` (viết lại), `process/phase-8.md`.

---

## 2026-07-28 (2) — Implement Phase 7 lớp Server Action (#58 trái tức + #101 đáo hạn): 5 quyết định phát sinh

**Status:** Accepted — trừ điểm (2), đã đảo ở [2026-07-28 (3)](#2026-07-28-3--đảo-quyết-định-2-kỳ-trả-lãi-phải-là-một-cột-đóng-băng); điểm "lỗ hổng đã vá" được vá lại đúng ở [2026-07-29](#2026-07-29--sửa-3-lỗi--3-điểm-sạch-code-từ-review-vòng-2-pr-102) điểm (2)

**Implement Phase 7 lớp Server Action — issue #58 (trái tức) + #101 (tất toán đáo hạn). 5 quyết định phát sinh lúc code mà spec chưa phủ.**

- **(1) Thứ tự "Dividend trước `Cashflow{MATURITY}` cùng ngày" hiện thực bằng HẠNG (`rank`), thắng cả `createdAt`.** Spec đã yêu cầu quy ước này (`03-dividends.md` ca biên) nhưng không nói cài thế nào. `sortByPositionTrailOrder()` (`lib/position-trail.ts`) nay sort theo `(date, rank, createdAt, id)` — `rank` chèn **trước** `createdAt` vì đây là quy ước domain ("lãi phát sinh trên số dư TRƯỚC khi tất toán"), phải thắng thứ tự người dùng bấm nút. `cashflowEventRank()` là nguồn DUY NHẤT xếp hạng (switch exhaustive), dùng ở `buildPositionEvents()`, `derivePosition()` và `computeRealizedGainForHolding()` — không nơi nào tự so `type === "MATURITY"`. Nếu chỉ dựa `createdAt` như trước: ghi tất toán rồi mới ghi trái tức kỳ cuối cùng ngày → "SL tại ngày trả lãi" = 0 → trái tức ra **0 đồng**, sai âm thầm; và `wentNegative` báo "bán vượt" oan.

- **(2) Kỳ trả lãi trên lịch sử được SUY NGƯỢC, không đọc `BondTerms` hiện tại.** Schema (#56) chỉ đóng băng `parValueApplied`/`couponRatePercentApplied`, **không** đóng băng `couponFrequencyMonths` — nhưng nhãn lịch sử là `9%/năm · kỳ 6 tháng`, tức kỳ trả lãi nằm TRONG nhãn. Đọc từ `BondTerms` hiện tại sẽ vi phạm tiêu chí "sửa điều khoản không làm đổi nhãn của kỳ đã ghi". Giải: đảo ngược công thức `computeBondCoupon()` — `freq = gross × 1200 / (par × rate × SL)` (`deriveCouponFrequencyMonths()`). Chọn cách này thay vì **thêm cột `couponFrequencyMonthsApplied`**: mọi thừa số đều đã lưu nên phép đảo là chính xác tuyệt đối (không phải ước lượng), và tránh một migration nữa khi migration của #56 còn chưa chạy được. Không ra số tháng nguyên (user sửa tay số tiền) → trả `null`, ẩn phần "· kỳ N tháng" thay vì bịa. **→ ĐÃ ĐẢO ở 2026-07-28 (3): cả hai lý do đều sai, phải là một cột đóng băng.**

- **(3) Thuế trái tức + thuế đáo hạn nhận giá trị sửa tay; thuế cổ tức `CASH` thì KHÔNG.** Cả hai màn Phase 7 dùng `AutoFilledAmountCard` (`fieldName="taxAmount"`) nên client thực sự gửi `taxAmount` lên — đúng nguyên tắc "form chỉ prefill, không khoá field" (`07-tax.md`). Nhưng nới lỏng này **không được lan** sang `CASH`: `recordDividendSchema` từ chối request `CASH`/`STOCK` có kèm `taxAmount` thay vì bỏ qua âm thầm ("không tin client"). Khi user sửa thuế, `netAmount` tính lại theo thuế hiệu lực.

- **(4) Điều khoản trái phiếu là ROUTE RIÊNG `/holdings/[id]/bond-terms`, không nhét vào form sửa vị thế.** Đảo mô tả ở `phase-7.md` mục 4 và `UI_phase_7.md` điểm 3 (dự kiến lắp `BondTermsFields` vào `NewHoldingForm`). Lý do: đây là **đích** của mọi chỗ báo thiếu điều khoản — màn chặn 7g ("Nhập điều khoản ngay"), link "Sửa điều khoản" trên thẻ tóm tắt ở form ghi trái tức — nên cần một URL ổn định; nhét vào form vị thế thì các chỗ đó phải trỏ tới một form dài không liên quan rồi mong user tự cuộn xuống đúng nhóm field. `BondTermsFields` (Presentational, #57) giữ nguyên, chỉ thêm `BondTermsForm` bọc state + gọi `saveBondTerms`.

- **(5) `BondTerms` là dữ liệu của feature HOLDINGS, không phải dividends.** Truy vấn `findBondTerms`/`upsertBondTerms` sống ở `features/holdings/repository.ts`; nhánh ghi trái tức (`features/dividends/actions.ts`) import từ đó. Lý do: `BondTerms` là đặc tả của chính vị thế (1-1 với `Holding`, nhập trên màn vị thế) — để mỗi feature tự viết một truy vấn cùng bảng là đúng pattern lặp tri thức mà `clean-code.md` mục 1 cấm. Tương tự, hằng số `CASH_FLOW_DIVIDEND_TYPES` (`lib/enums.ts`) thay 3 chỗ tự viết `type: "CASH"` khi lọc dòng tiền XIRR — `phase-7.md` mục 3 đã nêu đích danh rủi ro "không sửa thì tiêu chí phase không đạt mà không test nào fail".

- **Lỗ hổng phát hiện thêm khi rà (đã vá):** form sửa giao dịch (`TransactionForm`) chỉ có 2 lựa chọn Mua/Bán, nhưng sau #101 thì `Cashflow{MATURITY}` đã tồn tại thật và **sửa được qua form đó** — đổi `MATURITY` → `SELL` sẽ âm thầm chuyển sang chế độ thuế khác hẳn (0,1% trên toàn bộ mệnh giá hoàn trả) và đi vòng qua mọi kiểm tra của luồng tất toán. Vá: sửa một dòng `MATURITY` thì bộ chọn loại đổi thành nhãn tĩnh, các field khác vẫn sửa bình thường. **→ Bản vá này chỉ ở client, chưa đủ — xem 2026-07-29 điểm (2).**

- Docs đã sync: `docs/domain/03-dividends.md` (cách tính + hiển thị lịch sử + ca biên), `docs/domain/07-tax.md` (hàm thuần, chặn khi thiếu `BondTerms`, loại giao dịch không phải input client), `docs/domain/10-cashflow-calendar.md` (cài đặt `lib/bond-schedule.ts`, giới hạn thiếu `maturityDate`, `nextCouponDateOverride` chưa có UI), `process/phase-7.md` (tick mục 2-4 + tiêu chí, thêm mục "Trạng thái verify" và "Việc còn treo"), `process/UI_phase_7.md` (route thật).

---

## 2026-07-28 (3) — Đảo quyết định (2): kỳ trả lãi phải là MỘT CỘT đóng băng

**Status:** Accepted — supersedes 2026-07-28 (2) điểm (2)

**Đảo quyết định (2) của mục 2026-07-28 (2) — kỳ trả lãi trên lịch sử trái tức phải là MỘT CỘT đóng băng, không phải phép đảo công thức. Phát hiện khi user hỏi lại "9% là số cố định à?".**

Bối cảnh: mục (2) hôm nay chốt suy ngược kỳ trả lãi từ dữ liệu đã lưu — `freq = grossAmount × 1200 / (parValueApplied × couponRatePercentApplied × SL_tại_ngày_ghi)` — với lý do "mọi thừa số đều đã lưu nên phép đảo chính xác tuyệt đối" và "tránh thêm một migration khi migration #56 còn chưa chạy được".

- **Cả hai lý do đều sai.**
  - **Không phải mọi thừa số đều đã lưu.** `parValueApplied` và `couponRatePercentApplied` đóng băng thật, nhưng **`SL_tại_ngày_ghi` thì không** — nó được `buildQuantityTimeline()` phát lại từ toàn bộ `Cashflow`/`Dividend` **mỗi lần đọc**. Tôi đã tránh được phụ thuộc vào `BondTerms` nhưng thay bằng một phụ thuộc khác còn dễ đổi hơn: lịch sử giao dịch.
  - **Không có migration nào để tránh.** `prisma/migrations/` chưa từng có migration cho `BondTerms`/`parValueApplied` (issue #56 mới chỉ sửa `schema.prisma`, `prisma migrate dev` chưa chạy lần nào vì hạ tầng). Nghĩa là chưa có một dòng dữ liệu thật nào, thêm cột lúc này gần như miễn phí — đúng thời điểm rẻ nhất để sửa.

- **Ca hỏng cụ thể** (số thật, mockup TCB2528 — par 100tr, 9%/năm, kỳ 6 tháng, giữ 2 TP → gộp 9tr):
  | Hành động | `SL_tại_ngày_ghi` | Nhãn hiển thị |
  |---|---|---|
  | Ghi trái tức | 2 | `kỳ 6 tháng` ✅ |
  | Nhập bù 1 lệnh mua bị sót, lùi ngày trước đó | 3 | **`kỳ 4 tháng`** ❌ |
  | Xoá 1 lệnh mua cũ | 1 | **`kỳ 12 tháng`** ❌ |

  Cả 4, 6, 12 đều là kỳ trả lãi **hợp lệ ngoài đời**, nên kết quả sai không có vẻ gì bất thường — **sai âm thầm**, đúng loại lỗi mà cơ chế đóng băng sinh ra để chặn. Sửa/xoá giao dịch cũ là thao tác bình thường của app (4 Server Action đã có từ Phase 1), không phải ca hiếm.

- **Quyết định:** thêm `Dividend.couponFrequencyMonthsApplied Int?`, ghi cùng lúc với 2 field đóng băng kia trong `recordBondCouponDividend`. Đường đọc (`getDividendHistory`) đọc thẳng cả 3 field, **không còn phép tính nào** — không có gì để trôi. Hàm `deriveCouponFrequencyMonths()` và 5 test của nó bị xoá hẳn thay vì giữ làm fallback: giữ lại một cài đặt song song đã biết là sai chính là pattern gây chuỗi bug retrofit ở `derivePosition`/`computeRealizedGainForHolding` (2026-07-24 (2)(3)).

- **Bài học rút ra, áp cho lần sau:** "suy ngược từ dữ liệu đã lưu" chỉ an toàn khi **mọi** thừa số của phép đảo cũng bất biến. Trước khi thay một cột bằng một công thức đảo, liệt kê từng thừa số và hỏi "cái này có đóng băng không" — một thừa số derive-lại-lúc-đọc là đủ để phá bất biến. Tiền lệ ngược lại đã có sẵn trong repo và tôi đã bỏ qua: `percentLabel` của `CASH`/`STOCK` cũng suy ngược và cũng phụ thuộc `SL trước đó` — nhưng ở đó suy ngược là **bắt buộc** (`Dividend` không lưu `percent`, quyết định từ Phase 4), còn ở đây thì không.

- Docs đã sync: `prisma/schema.prisma` (cột mới + comment nêu đích danh cái bẫy), `docs/02-data-model.md` (model `Dividend`), `docs/domain/03-dividends.md` (mục "Hiển thị lịch sử" — viết lại, bỏ mô tả cách suy ngược), `process/phase-7.md` (mục 1 + "Trạng thái verify").

---

## 2026-07-29 — Sửa 3 lỗi + 3 điểm sạch code từ review vòng 2 PR #102

**Status:** Accepted — có việc còn treo (xem cuối entry)

**Sửa 3 lỗi + 3 điểm sạch code từ review vòng 2 của PR #102 (phần #57 UI + #58/#101).** Cả 3 lỗi đều nằm ở đường ghi thật qua DB — vùng unit test không chạm và `pnpm e2e` chưa từng chạy được trên Claude Cloud.

- **(1) Hằng số "một nguồn sự thật" KHÔNG phải cơ chế compiler — phải grep cả `src/lib/`, không chỉ `features/*/repository.ts`.** `CASH_FLOW_DIVIDEND_TYPES` được lập ra ở #58 đúng để chặn ca "thêm `BOND_COUPON` mà quên một chỗ lọc", nhưng lần rà đó chỉ tìm trong tầng repository và bỏ sót `getAllCashDividendsForXirr()` (`lib/portfolio-valuation.ts`) — một truy vấn `db.dividend` thẳng, sống ngoài DAL. Hệ quả: trái tức vào XIRR của **từng vị thế** nhưng biến mất khỏi XIRR / `absolutePnl` / chi phí ăn mòn **cấp danh mục**; hai con số lệch nhau âm thầm và trái phiếu chính phủ giữ tới đáo hạn (toàn bộ lợi nhuận nằm ở coupon) tụt XIRR về gần 0. Comment của chính hằng số đó cũng đếm sai ("2 repository function") — đã sửa thành 3 kèm ghi rõ chỗ dễ sót.
  - **Bài học:** quên dùng một hằng số dữ liệu không bao giờ là lỗi build. Muốn chặn cứng thì phải bỏ hẳn cài đặt song song (gộp về `findCashDividendsForHoldings`), chưa làm được ở đây vì `computeXirrCore()` không có `userId` trong chữ ký. Ghi lại làm việc còn treo.

- **(2) Khoá bằng UI không phải là khoá.** Mục 2026-07-28 (2) ghi lỗ hổng `MATURITY → SELL` là "đã vá", nhưng bản vá chỉ nằm trong `TransactionTypeField` (client) — `<input type="hidden" name="cashflowType">` vẫn sửa được. Tệ hơn, chiều ngược lại rộng hơn: `cashflowTypeEnum = z.enum(CASHFLOW_TYPES)` và #56 đã thêm `MATURITY` vào mảng đó, nên **cả 3 schema** (`newHolding`/`addTransaction`/`updateTransaction`) lặng lẽ nhận thêm một loại mà form không bao giờ hiển thị → tạo được `Cashflow{MATURITY}` trên vị thế **bất kỳ, kể cả vàng**, bỏ qua toàn bộ kiểm tra `holding.type = BOND` + `BondTerms` tồn tại của `settleMaturity`.
  - **Quyết định:** tách `manualCashflowTypeEnum` (`BUY`/`SELL`) cho `transactionFields`; `updateTransactionSchema` **vẫn** nhận `MATURITY` (không thì không sửa nổi ngày/số lượng của một dòng đáo hạn) và việc chặn **đổi** loại chuyển xuống `updateTransaction`, nơi đọc được loại đang lưu trong DB. Chặn cả hai chiều.
  - **Bài học:** một enum Prisma mở rộng ở phase sau sẽ **tự động** nới lỏng mọi `z.enum(<ENUM>)` đang dùng nó. Enum của *form* và enum của *DB* là hai thứ khác nhau ngay khi có một giá trị chỉ-hệ-thống-sinh — tách sớm, đừng đợi.

- **(3) "Prefill sửa được" chỉ đúng khi client và server tính trên CÙNG một cơ sở.** `AutoFilledAmountCard` render `<input type="hidden">` **vô điều kiện**, nên `taxAmount` luôn có mặt trong `FormData` → nhánh tự tính của `recordBondCouponDividend` là code chết. Mà hai bên tính trên SL khác nhau: card dùng `Holding.quantity` (SL **hiện tại** — thứ duy nhất client có), server dùng **SL tại ngày trả lãi**. Kết quả `netAmount = gross(theo ngày trả lãi) − tax(theo SL hiện tại)`, sai tiền không tín hiệu, lộ ra đúng lúc **ghi bù một kỳ cũ** sau khi đã mua thêm — chính ca mà lịch trả lãi neo `firstCouponDate` sinh ra để hỗ trợ.
  - **Quyết định:** thêm prop `submitWhenAuto` (mặc định `true`, giữ nguyên hành vi `TransactionForm` — ở đó schema dùng `.default("0")` nên field vắng mặt sẽ thành 0, không phải "số app tự tính"). `BondCouponFields` đặt `false`. Kèm guard server chặn `taxAmount > grossAmount` (`netAmount` là dòng tiền **dương** vào XIRR, giá trị âm sẽ trôi vào như thể trái tức làm mất tiền).
  - **Quy tắc rút ra:** schema nhận field kiểu "prefill sửa được" phải để `.optional()`, **KHÔNG** `.default()` — "vắng mặt" phải mang nghĩa "dùng số server tự tính", không phải "bằng 0".

- **(4) Không prefill con số mà form không hiển thị.** `settleMaturity` prefill `feeAmount` từ `TRANSACTION_FEE_SELL_BOND` "cho nhất quán", nhưng màn tất toán không có ô phí nào — một `Setting` khác `0` sẽ trừ vào `Cashflow.amount` một khoản user không thấy, lệch với dòng "Thực nhận" vừa xác nhận. Bỏ hẳn (mặc định `0`), khớp đúng lập luận nghiệp vụ "đáo hạn không qua lệnh khớp CTCK". Seed hiện là `0` nên chưa ai gặp — sửa trước khi có người chỉnh Setting.

- **(5) Bất biến "type X ⇒ field Y có mặt" biểu diễn bằng union, không bằng `!`.** `RecordDividendTxCtx` chuyển từ object phẳng (`bond?: BondCouponContext` + 4 dấu `!` ở call site) sang union theo `type`. Dựng union đặt trong `buildRecordDividendTxCtx()` với `switch` — chỉ ở đó `type` mới thu hẹp về literal trong từng nhánh, viết inline bằng `if`/ternary thì TypeScript không giữ được liên hệ qua một biến `let` (đúng chỗ 4 dấu `!` cũ đã nấp). Cùng tinh thần union `RecordedDividend` không có `priceAdjustment` ở nhánh `BOND_COUPON`.
  - **Còn treo:** `percent!` ở cuối `recordDividend` chưa bỏ được — `percent` bắt buộc theo `type` bằng `.refine()`, mà refine của zod không thu hẹp kiểu suy ra. Bỏ hẳn `!` đòi chuyển `recordDividendSchema` sang `z.discriminatedUnion("type", ...)`, kéo theo đổi đường lỗi + test, ngoài phạm vi lần sửa này. Tạm thời thêm guard runtime thật ngay đầu hàm để `!` dựa trên một kiểm tra đã chạy chứ không chỉ dựa vào refine ở file khác.

- **(6) `assertBondHoldingType(holding.type)` trong `saveBondTerms` là dòng chết** — đứng sau early return `holding.type !== "BOND"` nên TS đã thu hẹp, assertion không thể ném. Xoá; giữ lại chính hàm đó cho các đường ghi không có kênh lỗi hướng user (seed/backfill), comment của nó đã sửa cho khớp thực tế.

- Docs đã sync: `docs/domain/05-returns-xirr-and-pnl.md` (tập Dividend trong chuỗi XIRR + cái bẫy sót call site), `docs/domain/03-dividends.md` (nghĩa của "sửa tay" + chặn `tax > gross`), `docs/domain/07-tax.md` (phí đáo hạn mặc định 0, `MATURITY` không đi ngược vào form giao dịch thường), `src/lib/enums.ts` (comment đếm lại cho đúng), `src/lib/bond-terms.ts` (comment khớp thực tế).

- **Việc còn treo (không chặn phase):**
  - Gộp `getAllCashDividendsForXirr()` về `findCashDividendsForHoldings()` để bỏ hẳn truy vấn song song — cần thêm `userId` vào chữ ký `computeXirrCore()` (bản trong `portfolio-valuation.ts` cũng đang thiếu filter `holding: { userId }` mà bản repository đã có).
  - `recordDividendSchema` → `z.discriminatedUnion("type", ...)`, xoá `percent!`.
  - **e2e bắt buộc trước khi merge** (chỉ chạy được trên Claude Local): (a) ghi bù một kỳ trái tức cũ **sau khi đã mua thêm** — kiểm `gross`/`tax`/`net` cùng một cơ sở SL; (b) trái tức kỳ cuối trả đúng ngày đáo hạn, ghi tất toán **trước** rồi mới ghi trái tức — bất biến `SETTLEMENT_RANK`.

---

## 2026-08-08 — Mở rộng override thủ công sang `grossAmount` cho trái tức

**Status:** Accepted

**Mở rộng override thủ công sang `grossAmount` cho trái tức (`BOND_COUPON`) — theo đúng pattern `taxAmount` đã có (issue #58), cộng thêm 1 quyết định khác tiền lệ.**

- **Bối cảnh:** `grossAmount` trái tức tính hoàn toàn tự động từ `BondTerms` (mệnh giá × lãi suất × kỳ hạn × SL replay tại ngày trả lãi). Bond lãi suất thả nổi (đã ghi nhận ngoài phạm vi Phase 7 — model giả định coupon rate cố định) khiến số tự tính lệch số thực nhận trên sao kê phát hành, không có lối sửa.
- **(a) Mở rộng override sang gross theo đúng cơ chế tax đã có:** field `grossAmount` mới trong `recordDividendSchema`, cùng refine "chỉ nhận khi `type === BOND_COUPON`", cùng nguyên tắc "prefill sửa được" (`.optional()`, KHÔNG `.default()` — vắng mặt = dùng số server tự tính, xem mục 2026-07-29 (3)). `AutoFilledAmountCard` (`submitWhenAuto={false}`) đảm bảo field chỉ có mặt trong FormData khi user THẬT SỰ gõ, tránh đúng bug (3) ở trên (client tính theo SL hiện tại, server tính theo SL-tại-ngày-trả-lãi).
- **(b) Thêm cờ `Dividend.grossAmountOverridden Boolean @default(false)` dù `taxAmount` không có tiền lệ (không có `taxAmountOverridden`).** Lý do khác biệt có chủ đích: `grossAmount` là số **gốc** dùng cho XIRR và báo cáo thuế (thuế/net đều tính từ nó), trong khi `taxAmount` chỉ là một khoản trừ. Khi audit lịch sử về sau, cần phân biệt được một `grossAmount` lệch so với công thức chuẩn là do (i) lãi suất coupon thật đổi (thả nổi), (ii) SL replay tại ngày trả lãi lệch (ghi bù/sửa giao dịch cũ), hay (iii) user tự sửa tay — thiếu cờ này thì không tài nào tách được 3 nguyên nhân chỉ từ con số đã lưu.
- **(c) Đổi guard `taxAmount > grossAmount` sang so với `grossAmount` CUỐI CÙNG (đã qua override), không phải `computed.grossAmount` (số tự tính) — coi là bug fix ẩn trong tính năng mới, không phải hành vi mới độc lập.** Guard cũ vô tình đúng khi gross không override được (computed = final), nhưng giờ có override thì so với số tự tính sẽ để lọt ca user hạ gross xuống thấp hơn thuế đã prefill mà không bị chặn — `netAmount` âm trôi vào XIRR y hệt lỗ hổng gốc mà guard này sinh ra để chặn (docs/domain/03-dividends.md). `netAmount = grossAmount.minus(taxAmount)` và giá trị ghi DB đều đổi theo số cuối cùng tương ứng; `computed.grossAmount` gốc vẫn giữ nguyên biến riêng, không xoá (không dùng cho tính toán tài chính nữa, nhưng còn có thể cần cho UI so sánh "số tự tính vs số đã sửa").
- **`parValueApplied`/`couponRatePercentApplied`/`couponFrequencyMonthsApplied` giữ nguyên hành vi cũ** — luôn đóng băng theo `BondTerms` gốc tại thời điểm ghi, độc lập hoàn toàn với việc `grossAmount` có bị sửa tay hay không (đây là 3 field mô tả ĐIỀU KHOẢN áp dụng, không phải SỐ TIỀN cuối cùng).
- Docs đã sync: `docs/domain/03-dividends.md` (mục "Cách tính" nhánh `BOND_COUPON`), `prisma/schema.prisma` (comment field mới).
- **Việc còn treo:** UI badge "đã chỉnh tay" ở lịch sử (`DividendRowsFilter.tsx`) và card `AutoFilledAmountCard` thứ hai cho gộp ở `BondCouponFields.tsx` đã hoàn thành trong cùng lượt này. Chỉ còn treo: soi UI qua Playwright + `pnpm e2e` cho luồng ghi trái tức có override gross — tạm hoãn (hết usage AI lượt này), làm ở lượt sau.

---

## Quyết định liên quan ở file khác

- Thêm Phase 7 vào roadmap + Phase 8 (lịch dòng tiền), và quyết định "lưu cố định trên Holding" ban đầu — [`roadmap-and-scope.md`](./roadmap-and-scope.md), mục 2026-07-16 (3) và 2026-07-17 (5).
- `SALE_TAX_BOND = 0.1%` (bán thứ cấp) — [`tax-and-fees.md`](./tax-and-fees.md), mục 2026-07-18 (5) điểm (1).
- Rule enum (điểm (8) của 2026-07-25 (2)) được ghi thành rule chung — [`architecture-and-code-quality.md`](./architecture-and-code-quality.md).
- Thứ tự sự kiện `rank` trong `sortByPositionTrailOrder()` — [`transactions-and-cost-basis.md`](./transactions-and-cost-basis.md).
