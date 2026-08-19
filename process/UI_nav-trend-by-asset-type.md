# UI digest — Biến động NAV theo loại tài sản (issue #139)

Kéo từ Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 10 Screens.dc.html`, 7 khối
`139a`–`139f` + `139x` (tham khảo, không phải màn thật). Cache cục bộ tại
`.claude/design-cache/raw/phase-10-screens.dc.html` +
`.claude/design-cache/raw/design-system.dc.html` (token tham chiếu, không cần
đối chiếu sâu — không phát hiện token mới) +
`.claude/design-cache/index.json` (entry `issue-139`). Orchestrator copy sẵn
(không qua DesignSync), fetch 2026-08-18.

Issue này **không** gắn với `process/phase-N.md` nào (bổ sung độc lập cho
Dashboard) — digest đặt tên theo slug, theo đúng tiền lệ
`UI_stock-allocation-detail.md`/`UI_allocation-group-pnl.md`. Nguồn nghiệp vụ:
nguyên văn issue #139 (xem prompt) + 7 khối mockup.

Chỉ **Presentational** — component nhận props hiển thị số đã tính sẵn. Props
dưới đây là **phác thảo**, `design-implementer`/`business-implementer` chốt
khi hiện thực.

## Quyết định đã chốt (không phải điểm cần xác nhận)

- **Chú thích "gồm cả tiền nạp/rút" dùng Kiểu 2** — khối có icon `info` +
  viền, tông **primary/indigo cố định** (không đổi theo màu loại tài sản đang
  lọc — 139c lọc Vàng nhưng note box vẫn indigo, không vàng). Đặt **dưới bộ
  chọn kỳ**, ngoài vùng vẽ biểu đồ 160px. Luôn hiện khi có đường vẽ được
  (139a–139d); **không** bật/tắt theo điều kiện nào khác.
- **Một đường · một trục Y tại một thời điểm.** Đường tô đúng màu `asset-*`
  của loại đang lọc (`asset-stock`/`asset-fund`/`asset-bond`/`asset-gold`),
  `primary` khi xem "Tất cả". Mỗi loại có thang trục Y **riêng, tự co giãn**
  theo quy mô của chính nó (không dùng domain cố định chung).
- **Ẩn số tiền chỉ che VND** (NAV cuối kỳ, nhãn trục Y, tooltip số tiền).
  **% đổi kỳ và hình dạng đường giữ nguyên tuyệt đối** — không đổi 1 pixel.
- **Loại chưa từng có vị thế → trạng thái rỗng riêng** (139e), **tuyệt đối
  không vẽ đường phẳng ở 0 ₫** (dễ đọc nhầm thành "không sinh lời").
- **Entry point từ Dashboard (chốt 2026-08-18 trong issue, không có mockup
  riêng):** chỉ phần **header "Giá trị tài sản"** của card `NavTrendChart` là
  link (kèm chevron) dẫn vào route mới — **không** biến cả card thành link
  (vùng biểu đồ giữ nguyên tương tác chạm-giữ xem NAV theo ngày).

## Tóm tắt màn hình → component → trạng thái wiring

| # | Nội dung | Component dự kiến | Đã wiring vào route thật? |
|---|---|---|---|
| 139a | Xem "Tất cả" mặc định — đường primary, gộp toàn danh mục, giữ 3 kỳ | `NavTrendByAssetTypeChart` (trong `NavTrendByAssetTypeScreen`) | Chưa |
| 139b | Lọc Cổ phiếu — đường `asset-stock`, thêm card XIRR nhóm + nạp thêm trong kỳ | Cùng component, biến thể theo `assetType` + dữ liệu nhóm | Chưa |
| 139c | Lọc Vàng — đường `asset-gold`, trục Y co giãn theo scale nhỏ, thêm card Cao nhất/Thấp nhất kỳ | Cùng component | Chưa |
| 139d | Ẩn số tiền (nền 139b) — VND ẩn, % và hình dạng đường giữ nguyên | Cùng component + `NavTrendByAssetTypeScreenClient` (state `hidden`) | Chưa |
| 139e | Rỗng — Trái phiếu chưa từng có vị thế | Cùng component, biến thể `EmptyState` riêng + gợi ý 3 loại còn lại | Chưa |
| 139f | Skeleton loading | `NavTrendByAssetTypeChartSkeleton` | Chưa (route mới chưa có `loading.tsx`) |
| 139x | KHÔNG phải màn thật — đã chốt Kiểu 2 (xem mục "Quyết định đã chốt") | — | Không áp dụng |
| Dashboard | Card `NavTrendChart` — header "Giá trị tài sản" thêm chevron dẫn route mới | `NavTrendChart` (mở rộng props hiện có, KHÔNG mockup riêng — dựng theo mô tả issue + pattern chevron `AllocationScreen`) | Chưa |

139a–139e dùng **chung một component** vì cùng khối "filter chip + thẻ biểu
đồ" — chỉ khác props theo `assetType` đang chọn + dữ liệu (có/không có vị thế
loại đó). Biến thiên theo **dữ liệu**, không phải enum nghiệp vụ cố định cấu
trúc lặp lại ở nhiều vùng rời rạc — không cần tách variant component riêng,
cùng lý luận đã áp dụng ở `UI_stock-allocation-detail.md`/`UI_allocation-group-pnl.md`.

## Từng màn hình

### `NavTrendByAssetTypeScreen` + `NavTrendByAssetTypeChart` (139a–139e)

File dự kiến: `src/features/dashboard/components/NavTrendByAssetType/`
(feature `dashboard`, cùng nhóm với `NavTrendChart`/`AllocationScreen` —
không phải `holdings`, vì đây vẫn là góc nhìn portfolio-wide).

**Tách 2 lớp giống tiền lệ `AllocationScreen`/`StockAllocationDetailClient`,
nhưng lưu ý khác biệt quan trọng:** phần thân màn (filter loại + biểu đồ + kỳ)
có QUÁ NHIỀU state client liên đới nhau (loại đang lọc, kỳ đang chọn, ẩn/hiện
tiền đều cùng ảnh hưởng một khối UI duy nhất) — không tách gọn theo mẫu "server
render tĩnh + 1 client leaf nút mắt" như `AllocationScreen`. Đề xuất:

- `NavTrendByAssetTypeScreen` (Server Component) — `PageHeader` (title "Biến
  động NAV", `backHref`, `trailing` = `MoneyValueToggleButton` nếu có
  `onToggleHidden`) + render `NavTrendByAssetTypeChart`.
- `NavTrendByAssetTypeScreenClient` (Client wrapper "use client") — mirror
  `StockAllocationDetailClient`: giữ `useState(initialHidden)` (đọc từ
  `getHideAmountsByDefault()`), `onToggleHidden` gọi Server Action
  `setHideAmountsByDefault()` (optimistic + revert khi fail), render
  `NavTrendByAssetTypeScreen`.
- `NavTrendByAssetTypeChart` (Client leaf "use client", **không** đặt hậu tố
  `Screen`/`Section` vì đây là component tương tác thật — đúng tiền lệ chính
  `NavTrendChart` hiện tại cũng đã `"use client"` trực tiếp, không phải server)
  — giữ `useState` nội bộ cho **cả** `assetType` (`"ALL"|"STOCK"|"FUND"|"BOND"|"GOLD"`)
  **và** `period` (`"MONTH"|"YEAR"|"ALL"`, tái dùng type `NavTrendPeriod` đã
  export từ `NavTrendChart`) — dữ liệu **tải sẵn hết mọi tổ hợp** từ container,
  đúng tinh thần comment hiện có ở `NavTrendChart.tsx` dòng ~24-28 ("data đã
  tải sẵn cả 3 kỳ ... chart chỉ đổi state client"), mở rộng thêm chiều loại
  tài sản.

```ts
import type { AssetType } from "@/components/AssetTypeBadge";
import type { NavTrendPeriod, NavTrendPoint } from "@/features/dashboard/components/NavTrendChart";

type AssetTypeFilter = "ALL" | AssetType;

// Mở rộng NavTrendPeriodData hiện có (points + changePercent) — field MỚI cho
// issue #139, optional theo loại vì chỉ áp dụng khi assetType !== "ALL".
type NavTrendByAssetTypePeriodData = {
  points: NavTrendPoint[]; // rỗng/1 phần tử = "chưa vẽ được đường" (khác nghĩa "chưa từng có vị thế" — xem state rỗng riêng)
  changePercent: number;
  navAmount: string; // NAV cuối kỳ của LOẠI/TẤT CẢ đang lọc, Decimal serialize — ẨN theo `hidden`

  // Card insight riêng khi assetType !== "ALL" — xem "Điểm cần xác nhận" #1,
  // mockup 139b/139c hiện 2 loại card KHÁC NHAU, chưa rõ quy tắc chọn card nào.
  groupXirrPercent?: number; // "XIRR nhóm Cổ phiếu +9,7%/năm" — 139b
  depositedInPeriod?: string; // "Nạp thêm trong kỳ", Decimal serialize CÓ dấu — 139b, ẨN theo `hidden`
  periodHigh?: string; // "Cao nhất kỳ" — 139c, ẨN theo `hidden`
  periodLow?: string; // "Thấp nhất kỳ" — 139c, ẨN theo `hidden`
};

type AssetTypeFilterOption = {
  type: AssetTypeFilter;
  hasData: boolean; // false = loại chưa từng có vị thế nào (139e) — chip vẫn bấm được
  // % đổi của kỳ ĐANG chọn cho loại này — dùng cho gợi ý "3 loại còn lại đã
  // có dữ liệu" ở trạng thái rỗng (139e); undefined khi !hasData.
  latestChangePercent?: number;
};

type NavTrendByAssetTypeChartProps = {
  filters: AssetTypeFilterOption[]; // LUÔN 5 phần tử, thứ tự cố định: ALL, STOCK, FUND, BOND, GOLD
  // Preload sẵn CẢ 5 loại x 3 kỳ (15 bộ) — xem "Điểm cần xác nhận" #2 về việc
  // preload hết có hợp lý hay cần chốt lại cách tải.
  dataByFilter: Record<AssetTypeFilter, Record<NavTrendPeriod, NavTrendByAssetTypePeriodData>>;
  hidden?: boolean;
  // href tạo vị thế mới, dùng cho CTA ở trạng thái rỗng (139e) — xem "Điểm
  // cần xác nhận" #4 (route hiện có `ROUTES.newHolding` không nhận sẵn loại).
  newHoldingHrefByType: Record<AssetType, string>;
};

type NavTrendByAssetTypeScreenProps = {
  backHref: string;
  chart: NavTrendByAssetTypeChartProps;
  hidden?: boolean; // truyền tiếp cho MoneyValueToggleButton ở PageHeader
  onToggleHidden?: () => void;
};
```

State cần có trong `NavTrendByAssetTypeChart` (theo dữ liệu, không phải
`sc-if` cứng ở mockup):

- **"Tất cả" mặc định** (139a): `assetType = "ALL"`, đường màu `primary`,
  nhãn "NAV cuối kỳ · toàn danh mục", note box copy chung chung (không nêu %
  cụ thể trong câu mở đầu), phía dưới note box là banner trung tính "Đang xem
  gộp toàn bộ 4 loại — đường màu thương hiệu..." (icon `filter_list` xám, không
  phải chip insight nào).
- **Lọc 1 loại, có dữ liệu** (139b/139c): `assetType !== "ALL"`, đường/tên
  nhãn/chấm màu đổi theo `asset-*` tương ứng, note box interpolate % + tên
  nhóm vào câu mở đầu ("+15,8% này gồm cả tiền bạn nạp thêm..."), thêm **1
  trong 2 loại card insight** dưới note box (xem "Điểm cần xác nhận" #1).
- **Trục Y — MỚI so với `NavTrendChart` hiện tại** (`NavTrendChart` hiện KHÔNG
  render `<YAxis>`, chỉ có badge NAV compact góc phải). Mockup vẽ cột nhãn 4
  mốc bên trái biểu đồ, tự co giãn theo scale riêng từng loại (139c minh hoạ
  đối lập chủ đích: Vàng 17,4–19,5tr trong khi Cổ phiếu 340–430tr) — đề xuất
  dùng Recharts `<YAxis>` thật với `tickFormatter` qua `formatMoney(value,
  {compact: true, hidden})`, domain tự động theo min/max `points` của kỳ+loại
  đang chọn (không cần field data riêng cho nhãn trục — chart tự tính).
- **Ẩn số tiền** (139d, trên nền lọc Cổ phiếu): `hidden = true` → `navAmount`,
  nhãn trục Y, `depositedInPeriod`/`periodHigh`/`periodLow` hiện "••••••";
  `changePercent`, hình dạng đường (`points[].value` dùng để vẽ, KHÔNG ẩn giá
  trị dùng cho toạ độ), filter chip, bộ chọn kỳ giữ nguyên. Note box
  **không** bị ảnh hưởng bởi `hidden` (mockup ghi rõ "Chú thích không bị ảnh
  hưởng bởi chế độ ẩn tiền").
- **Rỗng — loại chưa từng có vị thế** (139e, mockup minh hoạ Trái phiếu):
  `filters.find(f => f.type === assetType)?.hasData === false` → **không**
  vẽ chart/Y-axis/note box, thay bằng `EmptyState` (icon `Wallet` hoặc tương
  đương, tiêu đề "Bạn chưa có vị thế {Tên loại} nào", mô tả "Chưa có giao dịch
  {loại} nào được ghi nhận, nên không có đường NAV để vẽ cho loại này.", 2 CTA:
  primary "+ Thêm vị thế {Tên loại}" (href = `newHoldingHrefByType[assetType]`),
  secondary text-only "Xem lại toàn danh mục" (**không phải link** — action nội
  bộ set lại `assetType = "ALL"`) + banner cảnh báo "Không vẽ biểu đồ trống hay
  đường phẳng ở 0 ₫..." + card liệt kê tối đa 3 loại còn lại `hasData=true`
  kèm `latestChangePercent` (lọc `filters` bỏ loại đang chọn).
- **Skeleton** (139f, `NavTrendByAssetTypeChartSkeleton`): 5 chip pill skeleton
  (rộng khác nhau, cao 31px), block header (nhãn 130×9 + số lớn 172×24 +
  badge % 66×23), cột Y-axis 4 dòng skeleton, khối chart skeleton full, 5 nhãn
  trục X, khối bộ chọn kỳ skeleton full-width cao 41px, khối note 3 dòng.
  Server Component thuần, khớp `component-architecture.md` mục "Quy ước
  skeleton".

### Card insight riêng loại (dưới note box, chỉ khi `assetType !== "ALL"`)

Hai biến thể xuất hiện trong mockup, **chưa rõ quy tắc chọn** (xem "Điểm cần
xác nhận" #1):

- **139b (Cổ phiếu):** card 2 cột "XIRR nhóm Cổ phiếu +9,7%/năm" | "Nạp thêm
  trong kỳ +24.000.000 ₫" + câu giải thích "Hai con số trên là cách tách bạch
  hai nguyên nhân: XIRR = hiệu quả, nạp thêm = phần NAV tăng do dòng tiền."
- **139c (Vàng):** callout amber "Vì sao mỗi loại một trục riêng" (icon
  `unfold_more`, giải thích lý do trục riêng dùng đúng số của Vàng/Cổ phiếu
  làm ví dụ — **có thể là copy tĩnh dùng chung mọi loại phi-ALL, không phải
  riêng Vàng**, cần xác nhận) + card 2 cột "Cao nhất kỳ 19.400.000 ₫" | "Thấp
  nhất kỳ 17.500.000 ₫".

### Dashboard — card `NavTrendChart` (mở rộng, không có artboard riêng)

File hiện có: `src/features/dashboard/components/NavTrendChart/NavTrendChart.tsx`.
**Không dựng theo raw mockup** (raw không có màn Dashboard này) — dựng theo mô
tả issue #139 (chốt 2026-08-18) + đối chiếu pattern chevron dòng legend "Cổ
phiếu" đã có ở `AllocationScreen.tsx` (`isDrillable` → bọc `<Link
href={ROUTES.allocationStock}>` + `ChevronRight`).

```ts
type NavTrendChartProps = {
  data: Record<NavTrendPeriod, NavTrendPeriodData>;
  hidden?: boolean;
  snapshotCardId?: string;
  className?: string;
  // MỚI (issue #139) — href cho header "Giá trị tài sản" dẫn tới màn NAV
  // theo loại tài sản. Vắng mặt = ẨN HẲN link (giữ header dạng text tĩnh như
  // hiện tại) — mirror cách `onToggleHidden` optional điều khiển hiện/ẩn nút
  // mắt ở các component khác (AllocationScreen, StockAllocationDetail).
  navTrendHref?: string;
};
```

Chỉ phần `<div className="text-[12.5px] font-semibold text-muted-foreground">
Giá trị tài sản</div>` (dòng 108-110 hiện tại) đổi thành `<Link>` kèm
`ChevronRight` nhỏ cạnh chữ khi `navTrendHref` có giá trị — **KHÔNG** bọc toàn
bộ `<div className="rounded-2xl border ...">` card thành link (biểu đồ bên
dưới giữ nguyên `Tooltip`/tương tác chạm-giữ hiện có).

### Sample data (bám đúng số trong mockup để soi UI ra giống bản vẽ)

```
Tất cả (139a):     NAV 438.000.000 ₫  +12,4%/năm  trục Y: 450tr/420tr/390tr/360tr
Cổ phiếu (139b):   NAV 420.000.000 ₫  +15,8%/năm  trục Y: 430tr/400tr/370tr/340tr
                   XIRR nhóm +9,7%/năm · Nạp thêm trong kỳ +24.000.000 ₫
Vàng (139c):       NAV  18.000.000 ₫   -3,2%/năm  trục Y: 19,5tr/18,8tr/18,1tr/17,4tr
                   Cao nhất kỳ 19.400.000 ₫ · Thấp nhất kỳ 17.500.000 ₫
Trái phiếu (139e): chưa từng có vị thế — 3 loại còn lại: Cổ phiếu +15,8%,
                   Quỹ +8,1%, Vàng -3,2%
```

Trục thời gian (X) dùng chung 5 mốc mẫu cho kỳ Năm: T9/25, T12/25, T3/26,
T6/26, T8/26 — khớp định dạng `formatDayMonth` hiện có ở `NavTrendChart`.

## Atom/molecule dùng lại (đối chiếu `docs/rules/ui-ux-design.md` mục "Kho atoms & molecules")

| Cần | Tái dùng được? | Ghi chú |
|---|---|---|
| Nút back + tiêu đề + nút mắt trailing | ✅ `PageHeader` + `MoneyValueToggleButton` | Giống hệt pattern `AllocationScreen`/`StockAllocationDetail` |
| Bộ chọn kỳ Tháng/Năm/Tất cả | ✅ `SegmentedControl` | Y hệt `PERIOD_OPTIONS` đã export nội bộ `NavTrendChart.tsx` — cân nhắc export riêng để dùng chung 2 nơi thay vì khai lại |
| Dot/label/tint theo loại tài sản | ✅ `ASSET_TYPE_DOT_CLASS`, `ASSET_TYPE_LABEL`, `ASSET_TYPE_TINT_CLASS` (từ `AssetTypeBadge`) | Dùng cho chấm màu chip filter + nhãn "NAV cuối kỳ · {Loại}" |
| Format tiền compact cho trục Y + card | ✅ `formatMoney(value, {compact: true, hidden})` | Đã có sẵn, cho ra đúng dạng "450tr"/"19,5tr" như mockup — không cần field data riêng cho nhãn trục |
| Chart Area/gradient/Tooltip | ✅ Tái dùng nguyên logic `NavTrendChart` (AreaChart, ChartTooltip, gradient theo `stroke`) | Chỉ cần tham số hoá màu (`stroke`/`fill` hiện hardcode `var(--color-primary)`) theo `assetType` — xem "Điểm cần xác nhận" #3 |
| Trạng thái rỗng (139e) | ✅ `EmptyState` (icon + tiêu đề + mô tả + `action` slot) | `action` nhận 2 nút (primary + text) trong 1 `<div>` — khớp pattern đã dùng ở `StockAllocationDetail`/131d |
| Note box "gồm cả tiền nạp/rút" (Kiểu 2 đã chốt) | ⚠️ `Alert` (`variant="info"`) GẦN khớp (nền/viền `primary/8`+`primary/20` gần đúng token mockup, icon `Info`) | Khác biệt nhỏ: mockup có 1 từ **bold giữa câu mô tả** ("XIRR") mà `Alert.description` hiện chỉ nhận `string` phẳng — cần nới `description` thành `ReactNode` hoặc chấp nhận bỏ bold đó |
| Callout amber "vì sao trục riêng" (139c) | ✅ Pattern có sẵn (`border-warning/28 bg-warning/8`, đã dùng ở `AllocationScreen` cho cảnh báo tập trung) | Tái dùng token, không cần atom mới |
| Banner trung tính "đang xem gộp" (139a) | ❌ Chưa có atom khớp (icon xám + text xám, không phải `Alert` info/error, không phải warning) | Dựng inline trong `NavTrendByAssetTypeChart`, dùng 1 chỗ, không cần tách atom |
| Chip filter loại tài sản (cuộn ngang, không phải slider 2 lựa chọn cố định) | ❌ Chưa có atom — khác `SegmentedControl` (pill trượt nền, số lượng lựa chọn cố định, không cuộn ngang) | Dựng mới `AssetTypeFilterChips`, colocate trong `NavTrendByAssetType/`, không promote lên `components/` (chỉ 1 chỗ dùng ở lần đầu) |
| Trục Y (`<YAxis>` Recharts) | ❌ `NavTrendChart` hiện tại KHÔNG có `<YAxis>` | Thêm mới, xem chi tiết ở mục "Từng màn hình" |
| Icon mới cần map Material Symbols → lucide | — | `filter_list` → `ListFilter`, `unfold_more` → `ChevronsUpDown` (đã có, Phase 4), `account_balance` (icon empty state Trái phiếu) → `Landmark`, `do_not_disturb_on` (banner cảnh báo đường phẳng) → `CircleSlash`, `rule` (chỉ trong khối "Quy ước áp dụng", không phải UI thật) — bổ sung bảng mapping ở `ui-ux-design.md` khi hiện thực |

## Điểm lệch/cần xác nhận — ĐÃ CHỐT 2026-08-18 (interview trực tiếp với user)

Digest ban đầu để ngỏ 7 điểm, không tự chốt. Đã hỏi lại user từng điểm (không
suy đoán thay) trước khi bàn giao cho issue wiring — kết quả:

1. **Card insight dưới note box — GIỮ data-driven, không hardcode theo loại.**
   Component chỉ render "XIRR + nạp thêm" khi `groupXirrPercent`/
   `depositedInPeriod` có giá trị, render "Cao nhất/Thấp nhất kỳ" khi
   `periodHigh`/`periodLow` có giá trị — quyết định "loại nào dùng card nào"
   thuộc về `business-implementer` khi điền props thật, không phải quy tắc
   cứng trong UI. Đã hiện thực đúng hướng này.
2. **Preload 5 loại × 3 kỳ = 15 bộ — GIỮ preload hết**, nhưng thêm ràng buộc
   mới: **tránh double-fetch với Dashboard.** User tự nêu lo ngại hiệu năng —
   Dashboard (`NavTrendChart`) đã fetch NAV trend cho toàn danh mục, `/nav-chart`
   fetch thêm 15 tổ hợp khi bấm sang là 2 round-trip DB liên tiếp cho cùng nhu
   cầu xem NAV. Cơ chế dùng chung (cache theo `userId`+ngày, hay tính sẵn cả 5
   loại dùng chung nguồn cho cả 2 màn) **chưa chốt cụ thể** — xem
   `process/decisions/pricing-and-valuation.md` 2026-08-18, việc của
   `business-implementer` ở issue "Query + route biến động NAV theo loại tài
   sản" khi wiring.
3. **Tách component riêng — GIỮ, không gộp vào `NavTrendChart` gốc.** Đã dựng
   `NavTrendByAssetTypeChart` độc lập (chấp nhận trùng lặp logic Area/
   gradient/Tooltip), `NavTrendChart.tsx` chỉ thêm đúng 1 prop
   `navTrendHref?: string` — không đổi hành vi mặc định, không rủi ro
   Dashboard đang chạy thật.
4. **CTA "+ Thêm vị thế {Loại}" — dùng query param `?type=BOND` trên
   `/holdings/new`**, không giữ route chung không tham số. Form đích tự
   pre-select loại — issue wiring cần đảm bảo `/holdings/new` đọc được param
   này.
5. **Route path — CHỐT `/nav-chart` độc lập, KHÔNG nối `/allocation`.** Đảo
   ngược đề xuất ban đầu trong issue #139 ("nối tiếp convention
   `/allocation/stock`") — xem lý do đầy đủ + cảnh báo phá vỡ tiền lệ
   2026-08-16 ở `process/decisions/pricing-and-valuation.md` 2026-08-18. Tên
   field đề xuất: `ROUTES.navChart`.
6. **Danh sách "loại còn lại đã có dữ liệu" ở trạng thái rỗng — GIỮ render
   động** theo `filters.filter(f => f.hasData && f.type !== assetType).length`,
   không hardcode số lượng cố định. Đã hiện thực đúng hướng này.
7. **Icon empty state — GIỮ dùng chung 1 icon (`Wallet`) cho mọi loại tài
   sản**, không dựng bộ icon riêng từng loại. Đã hiện thực đúng hướng này.
