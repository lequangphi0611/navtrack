# UI digest — Stock allocation detail (issue #131)

Kéo từ Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 8 Screens.dc.html`, 6 khối
131a–131f. Cache cục bộ tại `.claude/design-cache/raw/phase-8-screens.html` +
`.claude/design-cache/index.json` (entry `issue-131`). Fetch lần đầu
2026-08-16.

Issue này **không** gắn với `process/phase-N.md` nào (phase-8.md hiện có là
"Lịch dòng tiền trái phiếu", không liên quan) — digest đặt tên theo slug thay
vì số phase.

Chỉ **Presentational** — component nhận props hiển thị số đã tính sẵn. Props
dưới đây là **phác thảo**, `design-implementer`/`business-implementer` chốt
khi hiện thực.

## Tóm tắt màn hình → component → trạng thái wiring

| # | Nội dung | Component dự kiến | Đã wiring vào route thật? |
|---|---|---|---|
| 131a | Danh sách 4 mã có giá, sort %↓ mặc định + nút đổi sort, badge "% danh mục" cạnh tên mã khi có, footer tổng 100% | `StockAllocationDetail` (organism) + `StockAllocationRow` (row con) | Chưa |
| 131b | 1 mã thiếu giá (VIC) — loại khỏi mẫu số, tách khu vực riêng dưới đường kẻ, CTA "Cập nhật giá" | Cùng `StockAllocationDetail`, biến thể có `missingPricedRows` | Chưa |
| 131c | Nhóm chỉ 1 mã = 100%, callout giải thích + đối chiếu % toàn danh mục | Cùng `StockAllocationDetail`, `rows.length === 1` | Chưa |
| 131d | Rỗng — không mã nào có giá | Cùng `StockAllocationDetail`, `rows.length === 0` | Chưa |
| 131e | Tham khảo — gộp mã nhỏ vào dòng "Khác" mở rộng được (KHÔNG phải mặc định) | Biến thể `StockAllocationRow` dạng "OTHERS" — **không dựng ở lần đầu**, chỉ ghi nhận cho tương lai | Không áp dụng (chưa chốt có làm hay không) |
| 131f | Đối chiếu trực quan 2 mẫu số cạnh nhau (tài liệu giải thích, không phải màn thật) | Không dựng component — dùng để soi lại layout badge trong `StockAllocationRow` | Không áp dụng |

131a–131d dùng **chung một component** vì cùng khối "header + danh sách", chỉ
khác props theo dữ liệu (đúng ghi chú trong mockup: khối này "dùng chung được
cho cả 2 phương án mở" — xem mục "Điểm chưa chốt"). Đây là biến thể theo
**dữ liệu** (rows rỗng/1 phần tử/có phần tử thiếu giá), không phải biến thiên
theo enum nghiệp vụ — không cần tách variant component riêng theo quy tắc
`component-architecture.md`; tiền lệ đã có ở `AllocationScreen.tsx` (rẽ nhánh
`slices.length === 0` ngay trong cùng component).

## Bối cảnh nghiệp vụ bắt buộc phản ánh đúng (dễ sai nhất)

- **Hai con số % khác mẫu số cùng tồn tại trên một dòng:**
  - Số **MỚI** của component này = mẫu số **NAV nhóm cổ phiếu** — luôn màu
    indigo (`text-asset-stock`/tương đương), đặt cột phải mỗi dòng, luôn kèm
    chữ "trong nhóm cổ phiếu" (header) / "trong nhóm CP" (dòng), **không bao
    giờ hiện % trần** không có mô tả mẫu số.
  - Badge **CŨ** đã có (`ConcentrationBadge`, mẫu số = **NAV toàn danh mục**)
    — giữ nguyên màu amber/pill, nhưng đổi **vị trí**: cạnh tên mã ở dòng
    trên (mockup), khác cách dùng hiện tại (`HoldingsGroupCard` đặt badge này
    ở cột phải, dưới % market value).
- **Mã thiếu giá:** loại khỏi mẫu số hoàn toàn, **không** mặc định 0% — hiện
  `—` + trạng thái riêng ("chưa tính được"), tách xuống khu vực riêng dưới
  đường kẻ "Không tính vào tỉ trọng", không có ô % nào cả (kể cả 0%).
- **Không khuyến nghị hành động** — chỉ số liệu. Ngoại lệ duy nhất: CTA trung
  tính "Cập nhật giá" khi thiếu giá/rỗng (trỏ `ROUTES.navOverrideNew(holdingId)`
  — route sửa giá tay đã có, xem `src/lib/routes.ts`).
- **Ẩn số tiền:** chỉ ẩn NAV bằng `₫` (`hidden` flag qua `formatMoney`), %
  **luôn hiện** — đúng quy ước `component-architecture.md` mục "Đặc thù
  Navtrack".

## Từng màn hình

### `StockAllocationDetail` (131a/131b/131c/131d)

File dự kiến: `src/features/dashboard/components/StockAllocationDetail/StockAllocationDetail.tsx`
(cùng `features/dashboard` với `AllocationScreen`/`AllocationBar` — điểm vào
là dòng legend "Cổ phiếu" trong `AllocationScreen`, không phải từ `holdings`).

```ts
type StockAllocationDetailProps = {
  backHref: string; // PageHeader variant="back" — ĐỔI nếu chốt hướng accordion (xem "Chưa chốt")
  groupNavLabel: string;       // "404.000.000 ₫" | "••••••" (hidden) | "chưa tính được" (131d)
  hidden?: boolean;            // cờ ẩn tiền — chỉ ảnh hưởng *NavLabel, KHÔNG ảnh hưởng percent
  onToggleHidden?: () => void; // client leaf, tái dùng MoneyValueToggleButton nếu khớp props
  sortLabel: string;           // "% giảm dần" | "Theo mã A→Z" — container tự format, component không biết enum sort
  onToggleSort?: () => void;
  rows: StockAllocationRowData[];              // mã ĐÃ có giá, đã sort sẵn theo sortLabel hiện tại
  missingPricedRows: MissingPricedStockRow[];  // mã thiếu giá — [] = không hiện khu vực này (131a/c)
};

type StockAllocationRowData = {
  holdingId: string;
  symbol: string;
  name: string;
  navLabel: string;   // đã format qua formatMoney(), tôn trọng hidden
  percent: number;     // 0-100, mẫu số = NAV nhóm cổ phiếu (KHÔNG hidden theo cờ ẩn tiền)
  concentrationBadge?: ConcentrationBadgeState; // tái dùng type có sẵn lib/concentration.ts — undefined = dưới ngưỡng, không hiện badge
};

type MissingPricedStockRow = {
  holdingId: string;
  symbol: string;
  name: string;
  quantityLabel: string;   // "1.200 CP" — đã format qua formatQuantity()
  updatePriceHref: string; // ROUTES.navOverrideNew(holdingId)
};
```

State cần có trong 1 component (theo dữ liệu, không phải theo `sc-if` cứng ở
mockup):

- **Bình thường** (131a): `rows.length > 1`, `missingPricedRows = []`.
- **Có mã thiếu giá** (131b): `missingPricedRows.length > 0` → hiện khu vực
  riêng dưới đường kẻ "Không tính vào tỉ trọng" + card giải thích + CTA. Nhãn
  đếm đổi từ "4 mã có giá · mẫu số 404tr" → "Có tỉ trọng · 4 mã".
- **1 mã duy nhất** (131c): `rows.length === 1` → thêm callout `Info`
  "không phải lỗi hiển thị" NGAY dưới dòng đó, và card đối chiếu % toàn danh
  mục (dùng `concentrationBadge.percent` của chính mã đó nếu có, tránh hard
  code lại "27,3%" — mockup ghi cứng con số này chỉ để minh hoạ).
- **Rỗng** (131d): `rows.length === 0` → **không** render danh sách/footer
  tổng, thay bằng `EmptyState` (icon cảnh báo, tiêu đề "Chưa tính được tỉ
  trọng", mô tả nêu rõ bao nhiêu mã đang thiếu giá) + CTA "Cập nhật giá" +
  liệt kê `missingPricedRows` bên dưới (đổi label section thành "Mã đang giữ
  · chưa định giá"). Mockup còn ghi chú: nếu **không giữ mã cổ phiếu nào**
  (khác với "giữ nhưng thiếu giá") thì đổi câu mô tả — `EmptyState` cần thêm 1
  biến thể câu chữ nữa (container tự chọn description theo
  `missingPricedRows.length === 0 && rows.length === 0`).
- Không có skeleton riêng trong mockup phase này — dùng `Skeleton` atom theo
  khung `StockAllocationRow` thật, cùng quy ước `component-architecture.md`
  mục "Quy ước skeleton" (chưa có file mockup skeleton, design-implementer tự
  suy hình dạng từ layout row thật, đúng tiền lệ các skeleton khác trong repo).

### `StockAllocationRow` (con của `StockAllocationDetail`, dùng lại ở 131e nếu làm)

Dòng danh sách: avatar mã + tên + badge concentration (nếu có) + NAV (dòng
phụ) + số % lớn (indigo, cột phải) + label "trong nhóm CP" + thanh tỉ lệ
ngang (6px, gradient indigo) bên dưới. Colocate trong cùng thư mục
`StockAllocationDetail/` (sub-part nội bộ, không cần thư mục riêng — tương tự
`HoldingRowSkeleton` colocate với `HoldingRow`).

### Sample data (bám đúng mockup để soi UI ra giống bản vẽ)

- **Nhóm cổ phiếu (131a), mẫu số 404.000.000 ₫:**
  FPT · FPT Corp · NAV 180.000.000 · 44,6% · badge "27,3% danh mục".
  HPG · Hoà Phát · NAV 95.000.000 · 23,5% · không badge.
  VNM · Vinamilk · NAV 74.000.000 · 18,3% · không badge.
  MWG · Thế Giới Di Động · NAV 55.000.000 · 13,6% · không badge.
- **131b:** cùng 4 mã trên (mẫu số vẫn 404tr) + VIC · Vingroup · 1.200 CP ·
  thiếu giá, tách riêng.
- **131c:** chỉ FPT · NAV 180.000.000 · 100,0% "trong nhóm CP" · badge
  "27,3% danh mục" (đối chiếu vì NAV toàn danh mục ở ví dụ này khác 404tr).
- **131d:** VIC · 1.200 CP · thiếu giá, SSI · 800 CP · thiếu giá — cả 2 đều
  chưa có giá, mẫu số = 0, KHÔNG vẽ 0%.
- **131f (đối chiếu, không phải state thật):** FPT NAV 180.000.000; Panel A
  "44,6% trong nhóm cổ phiếu" = 180tr ÷ 404tr (chỉ mã cổ phiếu có giá); Panel
  B "27,3% danh mục" (badge cũ) = 180tr ÷ 660tr (toàn danh mục CP+quỹ+TP+vàng).
  Dùng làm ảnh tham chiếu khi cần chứng minh 2 mẫu số khác nhau, không cần
  dựng lại y hệt UI 131f (chỉ là tài liệu giải thích trong mockup).
- **131e (tham khảo, không mặc định):** FPT 44,6%, HPG 23,5%, dòng "Khác · 2
  mã · VNM, MWG" = 129.000.000 ₫ = 31,9% (màu trung tính, không indigo, có
  `expand_more` để mở rộng).

## Atom/molecule dùng lại (đối chiếu `docs/rules/ui-ux-design.md` mục "Kho atoms & molecules")

| Cần | Tái dùng được? | Ghi chú |
|---|---|---|
| Nút back + tiêu đề + subtitle | ✅ `PageHeader` | `variant="back"`, `subtitle` = "% trong nhóm cổ phiếu · NAV nhóm {label}", `trailing` = nút mắt |
| Nút mắt ẩn/hiện tiền ở header | ✅ `MoneyValueToggleButton` (export từ Phase 6, xem `ui-ux-design.md` mục `MoneyValue`) | Kiểm props khớp trước khi dùng thẳng — nếu lệch, bọc lại thay vì tự vẽ mới |
| Avatar mã cổ phiếu | ✅ `SymbolAvatar` | Dùng `colorClassName={ASSET_TYPE_TINT_CLASS.STOCK}` giống `HoldingsGroupCard` cho đồng bộ tông indigo |
| Badge "% danh mục" (amber) | ✅ `ConcentrationBadge` (`showNote={false}`) | Tái dùng ĐÚNG component + type `ConcentrationBadgeState` (`lib/concentration.ts`) — chỉ đổi **vị trí** đặt (cạnh tên mã, không phải cột phải cuối dòng) so với `HoldingsGroupCard`. Cần xác nhận layout `flex-col items-end` của badge không vỡ khi nhúng inline cạnh text (xem mục "Điểm cần xác nhận") |
| Badge "Thiếu giá" | ✅ `Badge` (`variant="warning"`) | Atom sẵn, đúng pattern `HoldingsGroupCard` dùng cho market value thiếu |
| Dot màu theo loại tài sản (header "Cổ phiếu") | ✅ `ASSET_TYPE_DOT_CLASS.STOCK` (từ `AssetTypeBadge` export) | Không cần badge đầy đủ, chỉ chấm màu như `HoldingsGroupCard` |
| Format tiền/%/số lượng | ✅ `formatMoney`, `formatPercent`, `formatQuantity` (`lib/format.ts`) | Có sẵn, đúng cờ `hidden` |
| CTA "Cập nhật giá" | ✅ `Button` (atom) + `ROUTES.navOverrideNew(holdingId)` | Route sửa giá tay đã có, không cần route mới |
| Trạng thái rỗng (131d) | ✅ `EmptyState` | Khớp gần như nguyên layout mockup (icon tròn + tiêu đề + mô tả + action) |
| Khối "tổng nhóm cổ phiếu 100,0%" (footer) | ⚠️ Gần giống `StatCard` nhưng không khớp hẳn (StatCard = label + MoneyValue + PercentChange, ở đây là card tint indigo 2 cột label/giá trị) | Dựng mới cục bộ trong `StockAllocationDetail`, không đủ lý do promote thành molecule (chỉ dùng 1 chỗ) |
| Thanh tỉ lệ % theo dòng (6px, indigo) | ❌ Chưa có atom | Khác `AllocationBar` (thanh nhiều-segment theo loại tài sản, ở `features/dashboard/components/AllocationBar`) — đây là 1 thanh đơn/dòng. Dựng mới trong `StockAllocationRow`, không cần tách atom riêng (dùng 1 chỗ) |
| Ghi chú giải thích (icon + đoạn văn, không tiêu đề) | ⚠️ `Alert` (atom `variant: "info"/"error"`) không khớp — `Alert` bắt buộc `title`, mockup dùng dạng chỉ đoạn văn không tiêu đề, có cả tông amber/muted-neutral chưa có ở `Alert` | Có tiền lệ private `InfoNote` (`features/dividends/components/DividendForm/InfoNote.tsx`) đúng shape hơn nhưng **chưa export** — cân nhắc promote lên `components/InfoNote` nếu dùng lần 2 (xem "Điểm cần xác nhận") |
| Nút đổi sort (chip pill "swap_vert + label") | ❌ Chưa có atom đúng hình | Không phải `SegmentedControl` (2 lựa chọn cố định dạng pill trượt) — mockup là 1 nút bấm đổi nhãn qua lại. Dựng mới, style tái dùng token sẵn có (`bg-white/5`, `border-border`) |
| Icon mới cần map Material Symbols → lucide | — | `price_change` (badge/banner thiếu giá), `block` (giải thích "không tính vào tỉ trọng"), `expand_more`/`more_horiz` (chỉ 131e, chưa cần nếu không làm dòng "Khác"), `alt_route`/`rule` (chỉ dùng trong khối ghi chú của mockup, không phải UI thật). Bổ sung bảng mapping ở `ui-ux-design.md` khi hiện thực, theo quy tắc "Cập nhật thiết kế về sau" |

## Điểm lệch/cần xác nhận (KHÔNG tự chốt)

1. **Cách mở màn — CHƯA CHỐT (ghi rõ trong mockup, khối "Điểm vào — và điểm
   chưa chốt"):** accordion tại chỗ trong `AllocationScreen` (mở rộng dòng
   legend "Cổ phiếu" ngay tại `/allocation`) hay route riêng (`/allocation/stock`
   hoặc tương tự, theo tiền lệ `ROUTES.allocation` đã là route riêng full-screen
   — xem `process/DECISION.md` 2026-07-21). Khối "header + danh sách"
   (`StockAllocationDetail`) mockup thiết kế dùng chung được cho cả 2 hướng —
   nhưng `backHref` (route riêng) vs không cần `backHref`/dùng `onClose` toggle
   (accordion) là 2 props shape khác nhau → **planner/business-implementer
   chốt hướng trước khi implement**, ảnh hưởng trực tiếp tới Props thật của
   `StockAllocationDetail` (và liệu `AllocationScreen` cần sửa gì thêm để dòng
   legend "Cổ phiếu" trở thành entry point — hiện tại chỉ là `<div>` tĩnh,
   không phải `<Link>`/`<button>`).
2. **Gộp dòng "Khác" — CHƯA CHỐT.** Mặc định mockup (131a-d) liệt kê đủ từng
   mã, KHÔNG gộp. 131e chỉ là biến thể tham khảo, tự nhận "không phải mặc
   định". Khuyến nghị trong mockup nếu chọn hướng gộp: ngưỡng theo **số dòng**
   (ví dụ từ mã thứ 6), không theo % tuyệt đối, để danh mục ít mã không bao
   giờ bị gộp — **chưa chốt có làm ở lần đầu hay để dành** (issue #131 không
   nhắc dòng "Khác").
3. **`ConcentrationBadge` đổi vị trí — cần soi UI thật để xác nhận không vỡ
   layout.** Component hiện có (`flex flex-col items-end gap-1.5`) được thiết
   kế để đặt ở cột phải cuối dòng (`HoldingsGroupCard`); mockup 131a đặt pill
   này **cạnh tên mã** trên cùng dòng với `symbol`/`name` (dùng `flex-wrap`).
   Về mặt props không đổi gì (`showNote={false}` vẫn ẩn hộp giải thích), chỉ
   là vị trí render trong layout cha — design-implementer tự kiểm khi dựng,
   không cần sửa `ConcentrationBadge` nếu wrap được bằng `flex-wrap` như
   mockup đã style.
4. **`InfoNote` đang là private sub-part của `DividendForm`** — nếu
   `StockAllocationDetail` cần đúng shape này (icon + đoạn văn không tiêu đề,
   nhiều tông màu), đây sẽ là lần dùng thứ 2 → cân nhắc promote thành
   `components/InfoNote` (molecule dùng chung) thay vì copy lại logic. Không
   tự quyết ở digest này vì thuộc phạm vi `design-implementer`.
5. **`groupNav`/mẫu số hiển thị khi rỗng (131d):** mockup ghi "chưa tính
   được" thay vì "0 ₫" hay "—" — cần `business-implementer` xác nhận query
   trả về giá trị nào khi `rows.length === 0` (`groupNavLabel` optional
   `null` hay luôn là string đã format sẵn "chưa tính được"?).
6. **Nguồn dữ liệu (`queries.ts`) chưa có** — hiện `getAllocationDetail()`
   (`src/lib/portfolio-valuation.ts`) chỉ tính % theo **loại tài sản**
   (STOCK/FUND/BOND/GOLD), không có hàm tính % theo **từng mã trong nhóm
   STOCK**. `business-implementer` cần viết hàm mới (có thể đặt cạnh
   `getAllocationDetail`, tái dùng `getOpenHoldings()` + `valuateHoldings()`
   đã có, lọc `type === "STOCK"`) — không đụng trong digest này, chỉ ghi nhận
   để planner biết đây là việc business-layer thật sự, không chỉ UI.
