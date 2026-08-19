# UI digest — Tách 2 nhánh `NewHoldingForm` (issue #140)

Kéo từ Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 11 Screens.dc.html`, đúng 5
artboard `vta`–`vte`. Nhận từ export zip user gửi (không qua DesignSync), fetch
2026-08-19. Cache cục bộ tại
`.claude/design-cache/raw/Phase 11 Screens.dc.html` +
`.claude/design-cache/index.json` (entry `issue-140`).

Issue này **không** gắn với `process/phase-N.md` nào — digest đặt tên theo
slug, theo đúng tiền lệ `UI_stock-allocation-detail.md`/`UI_allocation-group-pnl.md`/
`UI_nav-trend-by-asset-type.md`. Nguồn nghiệp vụ: nguyên văn issue #140 (xem
prompt) + 5 khối mockup.

Chỉ **Presentational** — component nhận props hiển thị/dữ liệu đã tính sẵn,
không tự gọi domain/Prisma. Props dưới đây **đã CHỐT khi hiện thực** (xem từng
mục "ĐÃ CHỐT khi hiện thực" bên dưới khớp code thật trong
`src/features/holdings/components/NewHoldingForm/`); phần nghiệp vụ còn treo
— tính phí tự động và kiểm tra trùng mã — vẫn để ngỏ cho
`business-implementer` chốt khi wiring (đó là nghiệp vụ, không phải UI).

## Tóm tắt màn hình → component → trạng thái wiring

| # | Nội dung | Component dự kiến | Đã wiring vào route thật? |
|---|---|---|---|
| vta | Bộ chọn nhánh đầu form (2 lựa chọn, caption đổi theo lựa chọn) | `NewHoldingSourceToggle` (trong `NewHoldingForm`) | **Đã wiring** — `NewHoldingForm.tsx` render `NewHoldingSourceToggle` ngay trên "Loại tài sản", mặc định `"EXISTING"` (giữ hành vi e2e cũ) |
| vtb | Nhánh "Đã có từ trước" — giữ field cũ + hint mới dưới giá vốn | `ExistingPositionFields` | **Đã wiring** |
| vtc | Nhánh "Vừa mua hôm nay" — Giá khớp lệnh, card Phí giao dịch, box breakdown | `NewPurchaseFields` + `TotalCostBreakdownCard` | **Đã wiring** — card Phí giao dịch mặc định `status="computed"` với `computedAmount="0"` (tự tính phí thật chưa tồn tại, người dùng nhập tay được ngay — xem "Điểm lệch" #7 bên dưới) |
| vtd | Khối lỗi trùng mã (biến thể vtc khi mã đã có Holding mở) | `DuplicateHoldingAlert` | Component đã dựng, **CHƯA render trong `NewHoldingForm`** — đúng phạm vi issue #140 (chỉ UI, chưa có cơ chế phát hiện trùng mã, xem "Điểm cần xác nhận" #3). Soi qua `/preview/new-holding-form-branches` |
| vte | Trạng thái đang tính phí prefill (loading trên card Phí) | Mở rộng `AutoFilledAmountCard` (prop `status` mới) | Component đã hỗ trợ `status="loading"`, **CHƯA có nơi nào trong `NewHoldingForm` set trạng thái này** — chưa có Server Action tính phí thật để trigger. Soi qua `/preview/new-holding-form-branches` |

## Quyết định đã có sẵn trong mockup (tham khảo, KHÔNG phải đã chốt cho Navtrack)

Ghi lại nguyên văn khối "Quyết định thiết kế của phase này" ở đầu file mockup
— đây là **gợi ý của Claude Design**, chưa qua xác nhận với user Navtrack, nên
liệt ở đây để người implement biết mockup nghĩ gì, KHÔNG coi là quyết định cuối
(xem thêm mục "Điểm cần xác nhận"):

- Mặc định nhánh theo **ngữ cảnh mở form** (không cố định): vào từ luồng
  onboarding/"Nhập từ Sheet" → mặc định "Đã có từ trước"; vào từ nút `+` trên
  Danh mục/Dashboard → mặc định "Vừa mua hôm nay". Nhánh chọn lần trước được
  nhớ trong session.
- Bộ chọn dùng **`SegmentedControl`** sẵn có (2 ô, icon + nhãn ngắn), đứng
  **trước cả "Loại tài sản"**, cao đúng 1 field, kèm 1 dòng caption mờ đổi
  theo lựa chọn.
- Card **Phí giao dịch** ở nhánh mua tái dùng nguyên khối `AutoFilledAmountCard`
  của Phase 5 — chỉ đổi icon/nhãn/hằng số công thức.
- **Không có ô thuế** ở nhánh mua (đã khớp `buyHasNoTax()` — bất biến domain
  đã chốt, không phải điểm mới). Bố cục "đặc": card Phí nối liền box tổng,
  không để khoảng trắng chỗ ô thuế từng đứng ở form bán.
- Trùng mã là **sai luồng, không phải sai định dạng** → khối lỗi có **hàng
  hành động bấm được** dẫn sang ghi giao dịch mua thêm đúng mã đó (mở rộng
  `Alert` error thêm 1 hàng action), khoá submit tới khi đổi mã.

## Từng màn hình

### vta — `NewHoldingSourceToggle`

Đứng ngay trên "Loại tài sản" trong `NewHoldingForm`. Dùng `SegmentedControl`
đã có (`stretch`, `thumbClassName`) — 2 option, icon trái (`Archive` cho "Đã
có từ trước", `ShoppingCart` cho "Vừa mua hôm nay" — xem mục icon bên dưới),
1 dòng caption mờ (`text-muted-faint text-[11.5px]`) đổi theo lựa chọn ngay
dưới thanh.

```ts
type PositionSource = "EXISTING" | "NEW_PURCHASE";
// "Đã có từ trước" | "Vừa mua hôm nay" — tên field/giá trị enum PHÁC THẢO,
// business-implementer chốt tên cuối (không có ở domain hiện tại, đây là
// state UI thuần, KHÔNG phải cột DB mới — mỗi lần submit vẫn chỉ ghi
// Cashflow{BUY} như cũ, "nguồn" chỉ quyết định field nào hiển thị + có card
// phí hay không).

type NewHoldingSourceToggleProps = {
  value: PositionSource;
  onChange: (value: PositionSource) => void;
  disabled?: boolean;
};
```

**ĐÃ CHỐT khi hiện thực:** `SegmentedControlOption<T>` (`src/components/SegmentedControl`)
được thêm 1 field optional mới `icon?: LucideIcon` để render icon trái nhãn
— digest không có sẵn cách nào cho icon trong `SegmentedControl` (label chỉ
nhận `string`), nên đây là mở rộng thật cần cho vta. Không đổi hành vi mọi
option không truyền `icon` (Mua/Bán ở `TransactionForm`, các
`SegmentedControl` khác) — button chỉ thêm `flex items-center justify-center
gap-1.5` (không đổi layout khi không có icon).

Caption mẫu (đúng mockup):
- `EXISTING`: "Khai báo một vị thế đang giữ sẵn — gõ giá vốn bình quân đã
  gộp nhiều lần mua trước đây."
- `NEW_PURCHASE`: "Ghi một lệnh mua thật cho mã chưa có trong danh mục — phí
  giao dịch tự tính vào giá vốn."

### vtb — `ExistingPositionFields`

File dự kiến: `src/features/holdings/components/NewHoldingForm/ExistingPositionFields.tsx`.
Giữ nguyên field/JSX hiện có trong `NewHoldingForm.tsx` (Loại tài sản, Mã,
Tên tuỳ chọn, Số lượng+Đơn vị, Giá vốn bình quân/đơn vị, Ngày chốt vị thế, box
dashed "Tổng vốn ban đầu = số lượng × giá vốn") — **chỉ thêm 1 hint mới**
dưới field "Giá vốn bình quân / đơn vị":

> "Nên là giá vốn đã gồm mọi chi phí đã trả cho các lần mua trước (phí, thuế
> nếu có) — app không hỏi riêng phí ở nhánh này."

```ts
type ExistingPositionFieldsProps = {
  quantity: string;
  onQuantityChange: (value: string) => void;
  unit: string;
  onUnitChange: (value: string) => void;
  unitOptions: string[]; // UNIT_OPTIONS[assetType] hiện có
  avgCostPerUnit: string;
  onAvgCostPerUnitChange: (value: string) => void;
  date: string; // yyyy-MM-dd, DatePicker
  onDateChange: (value: string) => void;
  disabled?: boolean;
};
```

State: `avgCostPerUnit` rỗng → box "Tổng vốn ban đầu" ẩn hẳn (đã đúng hành vi
hiện tại của `NewHoldingForm.tsx` dòng ~275-285, giữ nguyên).

Sample data (đúng số mockup vtb2 — FPT):
```
Mã: FPT · Tên: FPT Corp · Số lượng: 4.200 · Đơn vị: cổ phần
Giá vốn bình quân/đơn vị: 163.100 ₫ · Ngày chốt vị thế: 09/07/2026
→ Tổng vốn ban đầu = 685.020.000 ₫
```

### vtc — `NewPurchaseFields` + `TotalCostBreakdownCard`

File dự kiến: `src/features/holdings/components/NewHoldingForm/NewPurchaseFields.tsx`.
Cùng bố cục field Loại tài sản/Mã/Tên/Số lượng+Đơn vị như nhánh kia, nhưng:

- Nhãn đổi thành **"Giá khớp lệnh / đơn vị"** (không phải "Giá vốn bình
  quân"), hint dưới field: "Giá khớp thật trên sao kê, chưa gồm phí — phí
  tính riêng bên dưới."
- Nhãn "Số lượng" → "Số lượng mua"; "Ngày chốt vị thế" → "Ngày mua" (không
  có hint phụ ở field ngày trong nhánh này).
- **Không có ô thuế** (khớp `buyHasNoTax()`, `src/features/holdings/schemas.ts`
  dòng 116-121 — bất biến đã có, không phải việc mới).
- Card **Phí giao dịch** kiểu `AutoFilledAmountCard` (xem mục riêng bên dưới)
  — có **3 trạng thái con** khác mockup Phase 5, không chỉ 2 (tự tính/sửa
  tay): **idle** (chưa đủ SL/giá/ngày để tính — vtc1), **computed** (đã tính
  xong — vtc2), **loading** (đang tính — vte, xem mục riêng).
- Box tổng đổi thành `TotalCostBreakdownCard` (mới, thay cho box dashed đơn
  giản của nhánh kia) — 3 dòng: "Giá trị lệnh" (SL × giá), "Phí giao dịch"
  (+phí), "Tổng tiền đã chi" (tổng, nổi bật), thêm dòng note cuối "Giá vốn
  bình quân lưu lại `X ₫/CP` — đã gồm phí."

```ts
type NewPurchaseFieldsProps = {
  quantity: string;
  onQuantityChange: (value: string) => void;
  unit: string;
  onUnitChange: (value: string) => void;
  unitOptions: string[];
  matchedPricePerUnit: string; // "Giá khớp lệnh / đơn vị"
  onMatchedPricePerUnitChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  feeCard: React.ReactNode; // slot — AutoFilledAmountCard (idle/computed/loading), xem mục riêng
  totalBreakdown: React.ReactNode | null; // slot — TotalCostBreakdownCard, null khi chưa đủ SL+giá
  disabled?: boolean;
};

// TotalCostBreakdownCard — mới, chưa có trong kho atoms/molecules.
type TotalCostBreakdownCardProps = {
  orderValue: string; // SL × giá, Decimal serialize
  orderValueFormula: string; // "100 × 100.000" — đã compose sẵn bởi caller
  feeAmount: string; // giá trị HIỆU LỰC của card phí (manualValue ?? computedAmount)
  feePercentLabel: string; // "0,3%" — đã compose sẵn
  total: string; // orderValue + feeAmount
  avgCostPerUnit: string; // total / quantity — hiển thị ở note cuối
  className?: string;
};
```

Sample data (đúng số mockup vtc2 — MWG, khớp `TRANSACTION_FEE_BUY_STOCK = 0.3%`
đã seed sẵn ở `prisma/seed.ts`, không lệch domain):
```
Mã: MWG · Tên: Thế Giới Di Động · Số lượng mua: 100 · Đơn vị: cổ phần
Giá khớp lệnh/đơn vị: 100.000 ₫ · Ngày mua: 19/08/2026
Giá trị lệnh: 100 × 100.000 = 10.000.000 ₫
Phí giao dịch (0,3%): +30.000 ₫ — công thức "10.000.000 × 0,3% — TRANSACTION_FEE_BUY_STOCK @ 19/08/2026"
Tổng tiền đã chi: 10.030.000 ₫
Giá vốn bình quân lưu lại: 100.300 ₫/CP — đã gồm phí
```

### Card Phí giao dịch — 3 trạng thái (vtc1 idle / vtc2 computed / vte loading)

`AutoFilledAmountCard` (đã có, `src/components/AutoFilledAmountCard`) khớp
gần đúng trạng thái **computed** (vtc2) — dùng nguyên props hiện có:
`icon={Percent}` `label="Phí giao dịch"` `fieldName="feeAmount"`
`computedAmount` `formulaLabel="10.000.000 × 0,3% — TRANSACTION_FEE_BUY_STOCK @ 19/08/2026"`.

Hai trạng thái còn lại **CHƯA có trong `AutoFilledAmountCardProps` hiện tại**,
cần mở rộng hoặc dựng biến thể mới — nêu ở "Điểm cần xác nhận" #1:

- **idle (vtc1):** chưa đủ Số lượng/Giá/Ngày để tra biểu phí. Mockup hiện
  `—` thay vì số, **không có** icon bút chì/"Đặt lại", note đổi thành
  "cần Số lượng · Giá · Ngày để tra biểu phí" (icon `function`/`Sigma`, khác
  icon `Lightbulb` mặc định). Badge "TỰ ĐIỀN · SỬA ĐƯỢC" vẫn hiện.
- **loading (vte):** badge đổi thành "ĐANG TÍNH" (icon quay `Loader2`
  `animate-spin` — khớp mapping `progress_activity → Loader2` ở bảng icon
  bên dưới, KHÔNG phải `RefreshCw`), số lớn + dòng công thức thay bằng khối
  `Skeleton` (atom `skeleton.tsx` sẵn có, không phải `animate-pulse` rời
  rạc), note cuối đổi thành "Đang tra biểu phí theo loại tài sản + ngày mua —
  xong sẽ tự điền và vẫn sửa được.", **không có** nút "Đặt lại" (input đang
  khoá).

**ĐÃ CHỐT khi hiện thực (design-implementer, issue #140):** mở rộng
`AutoFilledAmountCardProps` đúng như phác thảo — thêm `status?: "idle" |
"loading" | "computed"` (mặc định `"computed"` = hành vi cũ, không đổi gì
cho `TransactionForm`/mọi chỗ khác không truyền prop này). KHÔNG tách
`AutoFilledAmountCardSkeleton` riêng — nhồi cả 3 trạng thái vào 1 component
vì dùng chung khung card/badge/vị trí, đúng option 1 mà digest đã nêu (mục
"Điểm cần xác nhận" #1).

```ts
// PHÁC THẢO — mở rộng AutoFilledAmountCardProps, KHÔNG đổi field cũ.
type AutoFilledAmountCardExtraProps = {
  // "idle" = chưa đủ input để tính (ẩn pencil/Đặt lại, đổi note+icon);
  // "loading" = đang chờ Server Action tính phí (skeleton thay số+công thức,
  // badge đổi ĐANG TÍNH, input khoá); mặc định "computed" = hành vi hiện tại.
  status?: "idle" | "loading" | "computed";
};
```

Sample idle: `note="cần Số lượng · Giá · Ngày để tra biểu phí"`.
Sample loading: card fee-skeleton, `note="Đang tra biểu phí theo loại tài sản
+ ngày mua — xong sẽ tự điền và vẫn sửa được."`; nút submit khoá + dòng chú
thích chân form "Chờ tính phí xong (~1 giây) để tránh lưu sai giá vốn."
(giữ nguyên spinner `progress_activity`/`RefreshCw`).

### vtd — `DuplicateHoldingAlert`

File dự kiến: `src/features/holdings/components/NewHoldingForm/DuplicateHoldingAlert.tsx`
(colocate cạnh `NewHoldingForm`, chỉ dùng ở đây — chưa cần promote lên
`components/`). **`Alert` hiện tại (`src/components/Alert/Alert.tsx`) không
có action slot** — cần mở rộng `AlertProps` với `action?: ReactNode` (đủ để
tái dùng `Alert` variant="error" làm nền), hoặc dựng hẳn component riêng như
đề xuất dưới đây (mockup có bố cục riêng: khối cảnh báo → hàng nút hành động
nền riêng → dòng "Hoặc đổi sang nhánh..." — nhiều hơn 1 action, `Alert` hiện
tại chỉ có `title`/`description` phẳng).

```ts
type DuplicateHoldingAlertProps = {
  symbol: string; // "FPT"
  existingQuantity: string; // "8.000" — ĐÃ FORMAT sẵn bởi cha (dấu chấm nghìn), KHÔNG phải Decimal thô
  existingUnit: string; // "CP" (mockup rút gọn "CP", field Holding.unit thật có thể là "cổ phần")
  existingAvgCost: string; // "92.400" — ĐÃ FORMAT sẵn, component chỉ nối thêm " ₫" ở cuối câu
  addTransactionHref: string; // ROUTES.newTransaction(existingHoldingId) — business-implementer resolve holdingId
  onSwitchToExisting: () => void; // đổi PositionSource sang "EXISTING" tại chỗ, không điều hướng
};
```

**ĐÃ CHỐT khi hiện thực:** dựng `DuplicateHoldingAlert` **độc lập, KHÔNG mở
rộng `Alert`** (đúng hướng nghiêng đã nêu ở "Điểm cần xác nhận" #6) — 2 tầng
hành động (nút Link chính + dòng phụ bấm được) không khớp cấu trúc phẳng của
`Alert`. `existingQuantity`/`existingAvgCost` là chuỗi **đã format sẵn**
(không chạy qua `formatMoney` lần nữa trong component, tránh double-format
kiểu "92.400 ₫ ₫") — cha (Container thật khi wiring) chịu trách nhiệm format
trước khi truyền prop. Component **chưa được `NewHoldingForm` render** ở đâu
cả — đúng phạm vi issue #140 (chỉ dựng UI, không thêm cơ chế phát hiện trùng
mã), phần "mã field đổi trạng thái visual + card Phí khoá + submit khoá" mô
tả bên dưới vẫn là **phác thảo cho business-implementer**, chưa hiện thực.

Mã field cũng đổi trạng thái visual (viền đỏ + icon `error`/`AlertTriangle`,
xem `src/components/ui/input.tsx` có prop lỗi sẵn dùng được không, hoặc
truyền `className` viền đỏ tại chỗ) — card Phí giao dịch bị khoá luôn
(`opacity-50`, note "tạm dừng tính — mã đang bị chặn"), 2 nút submit đều
`disabled`, thêm dòng khoá ở chân form "Đổi mã khác để tiếp tục lưu ở nhánh
này." (icon `Lock`).

Sample data (đúng mockup vtd — FPT):
```
Đang giữ 8.000 CP · giá vốn 92.400 ₫
"Bạn đã có vị thế FPT trong danh mục"
Nút: "Ghi giao dịch mua thêm FPT →"
Dòng phụ: "Hoặc đổi sang nhánh 'Đã có từ trước' nếu đang khai báo vị thế cũ."
```

## Atom/molecule dùng lại (đối chiếu `docs/rules/ui-ux-design.md` mục "Kho atoms & molecules")

| Cần | Tái dùng được? | Ghi chú |
|---|---|---|
| Bộ chọn nhánh (vta) | ✅ `SegmentedControl` | `stretch`, 2 option, icon trái — pattern y hệt tab Mua/Bán `TransactionForm` |
| Loại tài sản (lưới 4 ô) | ✅ `AssetTypeTiles` (đã có, nội bộ `NewHoldingForm.tsx`) | Không đổi cả 2 nhánh |
| Input/Select/DatePicker | ✅ `Input`, `Select`, `DatePicker` (atoms sẵn có) | Không đổi |
| `FieldLabel`/`FieldHint` | ✅ (nội bộ `NewHoldingForm.tsx`, chưa export riêng) | Tái dùng cho cả 2 variant; cân nhắc export nếu variant tách file riêng cần import lại |
| Card Phí giao dịch (computed) | ✅ `AutoFilledAmountCard` | Cần mở rộng thêm `status` (idle/loading) — xem mục riêng, KHÔNG phải dựng mới từ đầu |
| Box tổng đơn giản (vtb) | ✅ Giữ nguyên JSX dashed box hiện có trong `NewHoldingForm.tsx` | Không đổi |
| Box tổng breakdown 3 dòng (vtc) | ❌ Chưa có — `TotalCostBreakdownCard` mới | Không giống `AutoFilledAmountCard` (không sửa tay được, chỉ hiển thị tổng hợp) |
| Khối lỗi trùng mã + hành động (vtd) | ⚠️ `Alert` GẦN khớp nhưng thiếu action slot | Mở rộng `AlertProps.action?: ReactNode` HOẶC dựng `DuplicateHoldingAlert` riêng — xem mục vtd |
| Badge "TỰ ĐIỀN · SỬA ĐƯỢC" / "ĐANG TÍNH" | ✅ `Badge` atom (`badge.tsx`) | Biến thể "ĐANG TÍNH" cần variant mới hoặc className tuỳ biến tại chỗ (không có variant `loading` sẵn) |
| Skeleton số/công thức (vte) | ✅ `Skeleton` (`skeleton.tsx`) | Dùng đúng quy ước "dựng từ atom Skeleton, không animate-pulse rời rạc" |
| Icon lỗi trên field Mã (vtd) | ⚠️ Kiểm `input.tsx` có prop trạng thái lỗi sẵn chưa | Nếu chưa, viền đỏ + icon truyền qua `className`/composition tại chỗ, không sửa `input.tsx` gốc |

### Mapping icon Material Symbols → lucide (bổ sung mới cho phase này)

| Material Symbols (mockup) | lucide-react |
|---|---|
| `inventory_2` | `Archive` (đã có trong bảng, tái dùng cho nhánh "Đã có từ trước") |
| `shopping_cart_checkout` | `ShoppingCart` |
| `swap_horiz` | `ArrowLeftRight` (đã có trong bảng cho FAB Mua/Bán, tái dùng cho icon khối lỗi trùng mã) |
| `progress_activity` | `Loader2` (spin) — khác `sync`→`RefreshCw` đã map cho Phase 5 (banner tính lại thuế/phí, không phải spinner liên tục) |
| `block` | `Ban` (đã có, map từ issue #131) |
| `lock` | `Lock` (đã có trong bảng) |
| `function` | `Sigma` (đã có trong bảng) |
| `tips_and_updates` | `Lightbulb` (đã có trong bảng) |
| `error` (icon field Mã khi trùng) | `AlertTriangle` (đã có trong bảng) |
| `calculate` | `Calculator` (đã có trong bảng) |

## Điểm lệch/cần xác nhận — KHÔNG tự chốt

1. **Trạng thái `idle`/`loading` của card Phí — mở rộng `AutoFilledAmountCard`
   hay dựng component riêng?** Digest đề xuất thêm prop `status` (xem mục
   "Card Phí giao dịch — 3 trạng thái") vì cả 3 trạng thái dùng chung khung
   card + badge + vị trí — nhưng đây là quyết định cấu trúc, `design-implementer`
   tự chốt lúc hiện thực (có thể tách `AutoFilledAmountCardSkeleton` riêng
   theo đúng quy ước skeleton ở `component-architecture.md` thay vì nhồi
   `status` vào 1 component, nếu thấy phần loading khác biệt đủ nhiều).

2. **Nhánh mặc định khi mở form — CHƯA CHỐT, mockup vta chỉ là gợi ý.**
   Mockup đề xuất mặc định theo ngữ cảnh entry point (onboarding/"Nhập từ
   Sheet" → "Đã có từ trước"; nút `+` trên Danh mục/Dashboard → "Vừa mua hôm
   nay") + nhớ lựa chọn trong session. Navtrack **hiện chưa có** luồng
   onboarding hay "Nhập từ Sheet" nào — 2 entry point hiện có (nút `+` ở
   Holdings và Dashboard, theo `issue-139`/#141 đã thêm `?type=<AssetType>`
   query param cho `/holdings/new`) đều là cùng một ngữ cảnh "thêm nhanh".
   Cần `business-implementer`/user xác nhận: (a) giữ mặc định cố định
   `"NEW_PURCHASE"` (ca dùng thường ngày, đơn giản hơn) cho MỌI entry point
   hiện có, hay (b) thêm query param mới (`?source=EXISTING|NEW_PURCHASE`)
   cho lối vào tương lai, và (c) có cần nhớ lựa chọn qua session
   (`sessionStorage`) như mockup đề xuất không — đây là hành vi mới, chưa có
   tiền lệ trong form nào khác của app.

3. **`createHolding` hiện tại KHÔNG báo lỗi trùng mã — tự gộp giao dịch vào
   Holding cũ** (xem `src/features/holdings/actions.ts` dòng ~139-143, comment
   "Mua trùng mã đang giữ tự gộp vào Holding đã có, không tạo bản ghi thứ
   hai"). Mockup vtd muốn **chặn hẳn** submit ở nhánh "Vừa mua hôm nay" khi mã
   trùng, kèm link chuyển hướng — đây là **thay đổi hành vi nghiệp vụ**, không
   phải chỉ thêm UI: cần (a) một query/Server Action mới để kiểm tra tồn tại
   Holding theo `symbol`+`type` **trước khi submit** (hiện chỉ kiểm tra bên
   trong transaction lúc ghi, không expose ra client để check sống khi gõ),
   và (b) quyết định `createHolding`/`addTransactionSchema` có cần đổi gì để
   khớp hành vi chặn mới, hay chặn chỉ ở tầng UI (nhánh "Đã có từ trước" vẫn
   cho phép trùng mã như cũ, không đổi). Việc của `business-implementer` khi
   nhận issue phí giao dịch — digest chỉ nêu để không bị bỏ sót, không tự
   chốt cách chặn.

4. **Debounce/thời điểm gọi kiểm tra trùng mã + tính phí tự động** — mockup
   vte cho thấy phí được tính "khi đủ SL/Giá/Ngày", còn vtd cho thấy việc
   kiểm tra mã trùng chạy riêng (mockup ghi "Đang kiểm tra mã đã có trong
   danh mục…" gắn ở chính field Mã, không phải field SL/Giá/Ngày). Có thể là
   2 lần gọi async độc lập (check mã khi rời field Mã hoặc debounce gõ; tính
   phí khi đủ SL+Giá+Ngày) — cần `business-implementer` xác nhận cơ chế cụ
   thể (bao nhiêu ms debounce, gọi qua Server Action hay route handler).

5. **Field `existingUnit` ở `DuplicateHoldingAlert` mockup rút gọn "CP"**
   trong khi `Holding.unit` thật lưu tự do (vd "cổ phần") — cần xác nhận hiển
   thị đúng `holding.unit` thật hay rút gọn hiển thị riêng (không phải việc
   UI tự quyết, phụ thuộc dữ liệu Holding cũ có unit gì).

6. **`AlertProps` mở rộng `action?: ReactNode` hay giữ `Alert` nguyên vẹn,
   dựng `DuplicateHoldingAlert` độc lập không dùng chung `Alert`?** Digest
   nghiêng về dựng riêng (bố cục vtd có 2 tầng hành động, khác cấu trúc
   title/description phẳng của `Alert`) nhưng để `design-implementer` chốt —
   nếu mở rộng `Alert` thì cần rà mọi nơi đang dùng `Alert` variant="error"
   khác (`NewHoldingForm` hiện tại, `TransactionForm`...) không bị ảnh hưởng.
   **CHỐT:** dựng riêng, xem "ĐÃ CHỐT khi hiện thực" ở mục vtd.

7. **ĐÃ SỬA (rà lại sau khi implement):** card Phí giao dịch ở
   `NewPurchaseFields` ban đầu dựng với `status="idle"` + note "tạm thời nhập
   tay theo phí thực trên sao kê" — nhưng `status="idle"` tự khoá input
   (đúng đặc tả), nên user KHÔNG gõ được dù note nói vậy. Sửa lại: bỏ hẳn prop
   `status` ở lần gọi này (rơi về mặc định `"computed"`), giữ nguyên
   `computedAmount="0"` + note cũ. `"computed"` cho phép sửa tay bình thường
   (bút chì + "Đặt lại" hoạt động, "Đặt lại" đưa về `0`) — đúng ý đồ "tạm thời
   nhập tay" mà không cần trạng thái `idle`/`loading` giả. `feeAmount` khởi
   tạo `"0"`, đổi theo `onValueChange` khi user gõ, `TotalCostBreakdownCard`
   phản ánh đúng số đã gõ. Khi business-implementer gắn Server Action tính phí
   thật, đổi `computedAmount`/`formulaLabel` theo kết quả tính và có thể dùng
   `status="loading"` trong lúc chờ — `status="idle"` chỉ còn ý nghĩa đúng cho
   ca "chưa đủ Số lượng/Giá/Ngày để tính", không dùng cho ca "chưa có tính
   năng tự tính".

## File nguồn
- `Phase 11 Screens.dc.html` (project `fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) →
  cache `.claude/design-cache/raw/Phase 11 Screens.dc.html`.
