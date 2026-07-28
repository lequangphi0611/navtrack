# Phase 7 — UI digest (trái tức & đáo hạn trái phiếu)

Kéo từ Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 7 Screens.dc.html`, đủ 8 màn
7a–7h. Cache cục bộ tại `.claude/design-cache/raw/Phase-7-Screens.dc.html` +
`.claude/design-cache/index.json`. Fetch lần đầu 2026-07-28 (issue #57).

Digest này vừa là **đầu vào cho việc dựng UI** vừa là **biên bản chốt Props**
của các component đã dựng trong issue #57 — phần "Props đã chốt" bên dưới phản
ánh code thật đang có, không phải phác thảo.

## Tóm tắt màn hình

| # | Tên | Nội dung chính |
|---|---|---|
| 7a | Nhập điều khoản trái phiếu | Nhóm field trong form Sửa/Tạo vị thế loại BOND — segmented **Doanh nghiệp/Chính phủ** (BẮT BUỘC, quyết định thuế lãi 5% vs 0%), **Mệnh giá một trái phiếu** (BẮT BUỘC), nhóm "Coupon định kỳ" (TUỲ CHỌN · bỏ trống được: lãi suất %/năm, kỳ trả lãi tháng, ngày trả lãi kỳ đầu, ngày đáo hạn) + note zero-coupon; card **"Từ điều khoản này, app suy ra"** (trái tức mỗi kỳ, số kỳ còn lại, kỳ kế tiếp) kèm note "app không tự ghi theo lịch" |
| 7b | Ghi trái tức · doanh nghiệp | `DividendForm` tab thứ ba **Trái tức** — thẻ **"Điều khoản đã lưu · chỉ đọc"** (mệnh giá/lãi suất/kỳ trả lãi/đang giữ + link "Sửa điều khoản"), field **Ngày trả lãi** tự điền kèm badge `KỲ n · TỰ ĐIỀN`, Ngày tiền về (tuỳ chọn), breakdown gộp → thuế 5% (sửa được) → **Thực nhận**, note pháp lý + note XIRR |
| 7c | Ghi trái tức · chính phủ | Cùng 7b, `issuerType=GOVERNMENT` → dòng thuế hiện **0 ₫ + badge "Miễn thuế · NĐ 253/2026"**, thực nhận = đúng lãi gộp; note pháp lý đổi tông teal, khẳng định "thuế 0 ₫ là đúng quy định, không phải app thiếu cấu hình" |
| 7d | Lịch sử cổ tức & trái tức | `DividendHistoryList` — **3 thẻ tổng hợp** (Tiền về net / Trái tức / CP thưởng), **4 chip lọc** (Tất cả · Tiền mặt · Cổ phiếu · Trái tức), dòng trái tức có badge `TRÁI TỨC` (+ `MIỄN THUẾ` khi thuế 0), **dòng phụ đọc điều khoản đã đóng băng** `15/07/2026 · 9%/năm · kỳ 6 tháng` + dòng `gộp 9,00 − thuế 5% 0,45`; footnote giải thích các kỳ đã ghi không đổi khi sửa điều khoản |
| 7e | Tất toán đáo hạn · đúng mệnh giá | Màn mới — banner "Đã tới ngày đáo hạn dd/MM/yyyy", **mọi field prefill & sửa được** (ngày = maturityDate, số lượng = toàn bộ đang giữ `2 / 2 TP`, giá = mệnh giá kèm badge `= MỆNH GIÁ`), card **Thuế `0 ₫`** + badge "Không phải chuyển nhượng" + giải thích không chịu 0,1%, breakdown Tiền nhận về (gốc / lợi tức chịu thuế / thuế / **Thực nhận**); sau khi ghi hiện **toast gợi ý "Bạn đã ghi trái tức kỳ cuối chưa?"** với 2 nút |
| 7f | Tất toán đáo hạn · mua chiết khấu | Cùng 7e, giá vốn 92tr < mệnh giá 100tr → thêm card **"Vì sao lần này có thuế"** (giá vốn / nhận về / **chênh lệch = lãi** — tông amber) + card **Thuế lợi tức** `800.000 ₫` tự-điền-sửa-được kèm công thức `2 × 8.000.000 × 5%`; breakdown có thêm dòng **"Thuế chuyển nhượng 0,1% · không áp dụng"** |
| 7g | Rỗng · chưa có điều khoản | Bấm **Trái tức** trên vị thế BOND chưa có `BondTerms` → nền form mờ, sheet chặn: "Chưa có điều khoản trái phiếu … app **không thể tính trái tức**. App sẽ không đoán các con số này", checklist 3 mục cần nhập (2 bắt buộc đỏ + 1 tuỳ chọn), nút **"Nhập điều khoản ngay"** → 7a, nút phụ "Để sau" |
| 7h | Cảnh báo quá đáo hạn | Danh mục — callout amber "1 trái phiếu đã qua ngày đáo hạn" (giải thích vị thế **vẫn đang tính vào NAV theo mệnh giá**), card vị thế viền amber + badge `⚠ QUÁ ĐÁO HẠN`, dòng phụ `Đáo hạn 15/01/2029 · trễ 12 ngày`, 2 nút **Tất toán đáo hạn** (amber) / **Ghi trái tức**, note "app chỉ nêu sự thật dữ liệu — không tự ghi tất toán thay bạn" |

## Điểm lệch giữa mockup và code — đã xử lý thế nào

1. **`BOND_MATURITY` vs `MATURITY`.** Mockup (khối "Điểm vào", note cuối) gọi
   enum là `BOND_MATURITY`. Schema đã chốt ở issue #56 là
   **`CashflowType.MATURITY`** (`prisma/schema.prisma`, `src/lib/enums.ts`).
   Code theo schema; mockup chỉ là cách gọi trong bản vẽ.

2. **Thuế trái tức lấy từ Setting, không hardcode 5%.** Mockup ghi thẳng "5%".
   Code nhận `taxRatePercent` qua props (Server Action #58 sẽ resolve
   `BOND_INTEREST_TAX_RATE_CORPORATE`/`_GOVERNMENT` theo ngày) — UI không tự
   quyết con số, chỉ hiển thị cái được truyền xuống. Biến thể miễn thuế nhận
   biết bằng `issuerType`, không bằng việc so `taxRatePercent === "0"`.

3. **7a: ĐÃ ĐẢO ở #58 — là route riêng `/holdings/[id]/bond-terms`.**
   ~~Dự kiến ban đầu (issue #57): `BondTermsFields` lắp vào `NewHoldingForm`/form
   sửa vị thế khi `type === "BOND"`, không dựng route mới.~~ Lúc wiring mới thấy
   7a là **đích** của mọi chỗ báo thiếu điều khoản (màn chặn 7g, link "Sửa điều
   khoản" ở thẻ tóm tắt 7b/7c) nên phải có URL ổn định — trỏ vào một form vị thế
   dài rồi mong user tự cuộn tới đúng nhóm field là trải nghiệm tệ hơn hẳn.
   `BondTermsFields` giữ nguyên (Presentational thuần), thêm `BondTermsForm` bọc
   state + gọi `saveBondTerms`. Xem `process/DECISION.md` 2026-07-28 (2) mục (4).

4. **Không đụng Server Action/Prisma trong issue #57.** Mọi component ở đây
   nhận số đã tính qua props hoặc tự tính **preview client-side minh hoạ**
   (cùng cách `CashDividendFields` đang làm) — Server Action #58/#101 tính lại
   độc lập khi lưu, không tin số của UI.

5. **7h gắn ở CHI TIẾT VỊ THẾ, chưa gắn vào màn Danh mục.** Mockup vẽ badge nằm
   trong card vị thế của màn Danh mục. Issue #57 dựng `OverdueMaturityCallout` +
   `OverdueMaturityCard` như component độc lập có preview; #101 gắn callout vào
   **chi tiết vị thế** (`getBondHoldingActions`, kèm dòng "Đáo hạn dd/MM/yyyy ·
   trễ N ngày"). Bản ở màn Danh mục cần batch `BondTerms.maturityDate` cho toàn
   bộ vị thế mở — **còn treo**, ghi ở `process/phase-7.md` mục "Việc còn treo".

## Component đã dựng + Props đã chốt

Tất cả nằm dưới `src/features/`, mỗi component một thư mục + `index.ts` theo
`docs/rules/component-architecture.md`.

### `features/holdings/components/BondTermsFields` (7a)

```ts
type BondTermsFieldsProps = {
  issuerType: BondIssuerType;              // "CORPORATE" | "GOVERNMENT"
  onIssuerTypeChange: (v: BondIssuerType) => void;
  parValue: string;                        // chuỗi số thô, chưa format
  onParValueChange: (v: string) => void;
  couponRatePercent: string;               // "" = zero-coupon
  onCouponRatePercentChange: (v: string) => void;
  couponFrequencyMonths: string;           // "6" | "12" | "3" | ""
  onCouponFrequencyMonthsChange: (v: string) => void;
  firstCouponDate: string;                 // yyyy-MM-dd, "" = bỏ trống
  onFirstCouponDateChange: (v: string) => void;
  maturityDate: string;
  onMaturityDateChange: (v: string) => void;
  disabled?: boolean;
};
```

Client component (có state ở cha). Card "app suy ra" tự tính từ 4 field coupon,
ẩn hẳn khi thiếu dữ liệu (zero-coupon) — không hiện card rỗng.

### `features/dividends/components/DividendForm/BondCouponFields` (7b/7c)

Variant component thứ ba, song song `CashDividendFields`/`StockDividendFields`
(rule "Biến thiên theo enum nghiệp vụ lặp lại"). Dùng lại nguyên các atom sẵn
có: `FieldLabel`, `PaymentDateField`, `PreviewBreakdownCard`, `InfoNote`.

```ts
type BondCouponFieldsProps = {
  holding: DividendHolding;
  terms: BondTermsSummary;      // null → DividendForm render BondTermsMissingNotice thay
  taxRatePercent: string;       // "5" | "0" — resolve ở tầng server
  couponDate: string;
  onCouponDateChange: (v: string) => void;
  couponPeriodLabel?: string;   // "KỲ 2 · TỰ ĐIỀN"
  paymentDate: string;
  onPaymentDateChange: (v: string) => void;
  isPending: boolean;
};

type BondTermsSummary = {
  issuerType: BondIssuerType;
  parValue: string;
  couponRatePercent: string | null;
  couponFrequencyMonths: number | null;
  editHref: string;             // link "Sửa điều khoản" → 7a
};
```

### `features/dividends/components/DividendForm/BondTermsSummaryCard` (7b/7c)

Thẻ "Điều khoản đã lưu · chỉ đọc" — 4 ô (mệnh giá, lãi suất, kỳ trả lãi, đang
giữ) + link sửa. Không biết `DividendType`, chỉ nhận `terms` + `quantityLabel`.

### `features/dividends/components/BondTermsMissingNotice` (7g)

Trạng thái chặn khi `terms === null`: tiêu đề, checklist 3 mục (2 bắt buộc, 1
tuỳ chọn), CTA "Nhập điều khoản ngay" + "Để sau". Props: `symbol`,
`bondTermsHref`, `onDismiss?`.

### `features/holdings/components/MaturitySettlementForm` (7e/7f)

Màn tất toán. Prefill từ props, **mọi field sửa được** (đúng nguyên tắc "tự
điền · sửa được" của Phase 5). Tự quyết biến thể par/discount bằng so sánh
`avgCost` với `parValue` — không nhận cờ boolean từ ngoài.

```ts
type MaturitySettlementFormProps = {
  holding: { id; symbol; quantity; unit; avgCost };
  parValue: string;
  maturityDateLabel: string;             // "15/01/2029" cho banner
  defaultDateInputValue: string;         // yyyy-MM-dd = maturityDate
  interestTaxRatePercent: string;        // "5" | "0"
  closeHref: string;
  isPending?: boolean;
};
```

Card "Vì sao lần này có thuế" (`MaturityInterestExplainCard`) chỉ render khi
`avgCost < parValue`; thẻ thuế đổi giữa 2 biến thể theo cùng điều kiện đó.

### `features/holdings/components/MaturityCouponReminder` (7e — toast)

Gợi ý "Bạn đã ghi trái tức kỳ cuối chưa?" + 2 nút. Presentational thuần.

### `features/holdings/components/OverdueMaturityCallout` + `OverdueMaturityBadge` (7h)

Callout amber tổng hợp (`count`) và badge gắn vào dòng vị thế
(`maturityDateLabel`, `lateDays`).

## Sample data dùng trong preview

Bám đúng số của mockup để soi UI ra kết quả giống bản vẽ:

- **TCB2528** · Techcombank · doanh nghiệp — mệnh giá `100.000.000`, coupon
  `9`%/năm, kỳ `6` tháng, kỳ đầu `15/01/2026`, đáo hạn `15/01/2029`, đang giữ
  `2`. Trái tức mỗi kỳ `4.500.000`; gộp `9.000.000` − thuế 5% `450.000` =
  **`8.550.000`**.
- **TPCP 2029** · Kho bạc Nhà nước · chính phủ — cùng thông số, thuế `0` →
  thực nhận **`9.000.000`**.
- **Đáo hạn đúng mệnh giá** (TCB2528): 2 × `100.000.000` = `200.000.000`, lợi
  tức `0`, thuế `0`, thực nhận **`200.000.000`**.
- **Đáo hạn chiết khấu** (VIC2429): giá vốn `92.000.000`/TP → lợi tức
  `8.000.000`/TP, tổng lợi tức `16.000.000`, thuế 5% **`800.000`**, thực nhận
  **`199.200.000`**; lãi/lỗ vị thế mua `184,00 tr` → nhận `199,20 tr` =
  `+15,20 tr (+8,3%)`.
- **Quá đáo hạn**: TCB2528, đáo hạn `15/01/2029`, trễ `12` ngày, giá trị
  `200,00 tr`.

## Ràng buộc hệ thiết kế (giữ nguyên từ các phase trước)

- Tông trái phiếu dùng biến `asset-bond` (`#5b6b8c` trong mockup); chính phủ
  dùng tông teal (`#5fd9c4`) cho badge miễn thuế; cảnh báo quá hạn dùng
  `warning` (`#e0b34c`).
- Mọi field ngày dùng `DatePicker` (`components/ui/date-picker.tsx`), **không**
  `<input type="date">`.
- Tiền format qua `lib/format.ts` (`formatMoney`), nhận `string`, tôn trọng cờ
  `hidden`. Số lượng qua `formatQuantity`.
- Thuế bằng 0 vì luật thì **vẫn hiện thẻ kèm badge lý do**, không ẩn thẻ — tiền
  lệ màn bán vàng (Phase 5).
- Giá trị app tự tính là **gợi ý, sửa tay được** — badge `TỰ ĐIỀN · SỬA ĐƯỢC`
  + link "Đặt lại".
