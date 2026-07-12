# Phase 2 — UI/Presentational layer (design-implementer)

Deliverable của agent `design-implementer` cho Phase 2 ("Lõi XIRR + giá tự động").
**Chỉ Presentational** — không business logic, không `queries.ts`, không Server
Action, không sửa `lib/xirr.ts`/Prisma. Mọi Props dưới đây là **hợp đồng** mà
`business-implementer` cần khớp khi wiring dữ liệu thật.

Mockup nguồn: Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 2 Screens.dc.html` (6 màn
2a-2f) + `Design System.dc.html`.

## Tóm tắt trạng thái wiring

| Màn | Component | Đã wiring vào route thật? |
|---|---|---|
| 2a Dashboard | `DashboardScreen` | **Chưa** — `/` vẫn `redirect(ROUTES.holdings)` (Phase 1, cố ý không sửa theo chỉ thị) |
| 2b Danh mục có định giá | `HoldingsGroupCard` + `HoldingsList` (mở rộng) | Đã wiring khung, **chưa có dữ liệu valuation thật** (props optional, rơi về Phase 1 khi thiếu) |
| 2b (dòng tổng) | `HoldingsSummaryCard` | **Chưa** — component mới, chưa thay `TotalInvestedSection` trong `HoldingsOverviewScreen` |
| 2c Chi tiết vị thế | `HoldingDetailScreen` | Đã wiring khung vào `/holdings/[id]`, **chưa có `valuation`** (prop optional) |
| 2d Nhập giá tay | `NavOverrideForm` | **Chưa** — không có route thật (đúng yêu cầu) |
| 2e Cài đặt · Mốc chốt | `SettingsScreen` + `CutoffPicker` | Đã wiring khung vào `/settings`, **chưa có `cutoff` data** (prop optional) |
| 2f Không tính được XIRR | `DashboardScreen` (biến thể, cùng component 2a) | Chung trạng thái với 2a — chưa wiring |

---

## A. 6 màn Phase 2

### 1. 2a Dashboard — `DashboardScreen`

- File: `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` (+ `DashboardScreenSkeleton.tsx`, `index.ts`)
- Cũng là component cho **2f** (biến thể "không tính được XIRR") — cùng Props, khác nhánh hiển thị theo `xirr.status`/`missingPriceHoldings`, không tách 2 component.

```ts
type DashboardScreenProps = {
  displayName: string;
  cutoffLabel: string;
  cutoffDate: string;
  cutoffHref: string;
  navValue: string;
  navValueIsPartial: boolean;
  navDeltaAmount: string;
  navDeltaPercent: number;
  xirr: XirrResult; // từ @/components/ReturnMetrics
  absolutePnl: string;
  absolutePnlIsPartial: boolean;
  allocation: AllocationSlice[]; // từ AllocationBar
  priceFreshnessNote: string;
  missingPriceHoldings: MissingPriceHolding[]; // từ MissingPriceList
  hidden?: boolean;
};
```

**Sample data đã dùng để tự kiểm** (2a happy path):

```ts
{
  displayName: "Minh Quân",
  cutoffLabel: "Hôm nay",
  cutoffDate: "11/07/2026",
  cutoffHref: "/settings",
  navValue: "3723986000",
  navValueIsPartial: false,
  navDeltaAmount: "448486000",
  navDeltaPercent: 13.7,
  xirr: { status: "OK", percentPerYear: 18.4 },
  absolutePnl: "448486000",
  absolutePnlIsPartial: false,
  allocation: [
    { type: "STOCK", percent: 46 },
    { type: "FUND", percent: 22 },
    { type: "BOND", percent: 14 },
    { type: "GOLD", percent: 18 },
  ],
  priceFreshnessNote: "Giá tự động cập nhật EOD hôm nay 15:05 · 2 mã dùng giá nhập tay",
  missingPriceHoldings: [],
}
```

**Sample 2f (biến thể không tính được)**: giống trên nhưng
`navValueIsPartial: true`, `xirr: { status: "NO_CONVERGE" }`,
`absolutePnlIsPartial: true`, `missingPriceHoldings` có 2 phần tử (VPB 2027 —
BOND, Vàng PNJ — GOLD), `allocation: []` (mockup 2f không hiện phân bổ).

**Query/Server Action business-implementer cần tạo:**
- `getPortfolioValuation(cutoffDate?: Date): PortfolioValuation` — tổng NAV +
  XIRR (dùng `lib/xirr.ts` + dòng tiền giả định NAV tại mốc, xem
  `docs/domain/05-returns-xirr-and-pnl.md`) + lãi/lỗ tuyệt đối + phân bổ theo
  `AssetType` + danh sách holding thiếu giá (`docs/domain/04` "Thiếu giá").
- Cần gom giá theo tập `symbol` một lần (tránh N+1) — xem `process/phase-2.md`
  mục cache `PriceQuote`.
- `priceFreshnessNote` cần nguồn: thời điểm chạy job Python gần nhất + đếm số
  mã đang dùng `NavOverride`.
- **`cutoffHref`**: quyết định thiết kế của tôi — trỏ tạm về `ROUTES.settings`
  vì lựa chọn mốc chốt thật nằm ở màn Cài đặt (2e); nếu muốn Dashboard tự chọn
  mốc inline thì cần thiết kế lại (không có trong mockup 2a, chỉ có chip
  hiển thị + điều hướng).
- **Props giả định** — `DashboardScreen` chưa wiring vào route thật (route `/`
  vẫn redirect theo Phase 1, cố ý không sửa). Khi business-implementer tạo
  dashboard route thật, cần đổi `src/app/(dashboard)/page.tsx`.

---

### 2. 2b Danh mục có định giá — mở rộng `HoldingsGroupCard` + `HoldingsList` + `HoldingsSummaryCard` mới

- File sửa: `src/features/holdings/components/HoldingsGroupCard/HoldingsGroupCard.tsx` (+ `index.ts`)
- File sửa: `src/features/holdings/components/HoldingsList/HoldingsList.tsx`
- File mới: `src/features/holdings/components/HoldingsSummaryCard/HoldingsSummaryCard.tsx` (+ Skeleton, `index.ts`)

```ts
// HoldingsGroupCard.tsx
type HoldingValuationExtras = {
  marketValue: string;
  currentPricePerUnit: string;
  annualReturnPercent: number;
};
type HoldingWithValuation = HoldingSummary & Partial<HoldingValuationExtras>;
type GroupValuation = {
  priceSource: PriceSource; // "AUTO" | "MANUAL", từ @/components/PriceSourceBadge
  changePercent: number;
};
type HoldingsGroupCardProps = {
  type: AssetType;
  holdings: HoldingWithValuation[];
  totalCostBasis: string;
  groupValuation?: GroupValuation; // vắng mặt = Phase 1 (chỉ vốn), có = Phase 2 (NAV/nguồn giá/%)
  className?: string;
};

// HoldingsList.tsx
type HoldingsListProps = {
  holdings: HoldingWithValuation[];
  groupValuations?: Partial<Record<HoldingSummary["type"], GroupValuation>>;
};

// HoldingsSummaryCard.tsx
type HoldingsSummaryCardProps = {
  navValue: string;
  totalCostBasis: string;
  absolutePnl: string;
  absolutePnlPercent: number;
  xirr: XirrResult;
  hidden?: boolean;
  className?: string;
};
```

**Quyết định thiết kế quan trọng:** giữ **backward-compatible** — khi Container
chưa cấp `groupValuation`/`marketValue`, `HoldingsGroupCard` tự rơi về đúng
hiển thị Phase 1 (chỉ vốn đã bỏ vào). Vì vậy **chưa cần sửa gì ở
`HoldingsPositionsSection`/`queries.ts` để không phá vỡ Phase 1 hiện có** —
business-implementer chỉ cần mở rộng dữ liệu khi sẵn sàng.

**Sample data (2b happy path, nhóm Cổ phiếu):**

```ts
{
  type: "STOCK",
  holdings: [
    {
      id: "h1", symbol: "FPT", name: "FPT Corp", type: "STOCK", unit: "cổ phần",
      quantity: "4200", avgCost: "163100", totalCostBasis: "685020000",
      marketValue: "751380000", currentPricePerUnit: "178900", annualReturnPercent: 9.7,
    },
    {
      id: "h2", symbol: "HPG", name: "Hòa Phát", type: "STOCK", unit: "cổ phần",
      quantity: "16500", avgCost: "24700", totalCostBasis: "407550000",
      marketValue: "450450000", currentPricePerUnit: "27300", annualReturnPercent: 10.3,
    },
  ],
  totalCostBasis: "1092570000",
  groupValuation: { priceSource: "AUTO", changePercent: 10.1 },
}
```

**Sample `HoldingsSummaryCard`:**

```ts
{
  navValue: "3723986000",
  totalCostBasis: "3275500000",
  absolutePnl: "448486000",
  absolutePnlPercent: 13.7,
  xirr: { status: "OK", percentPerYear: 18.4 },
}
```

**Query business-implementer cần tạo:**
- Mở rộng `getOpenHoldings()`/`getHoldingsRaw()` (`src/features/holdings/queries.ts`)
  trả thêm `marketValue`, `currentPricePerUnit`, `annualReturnPercent` per
  holding (đọc `PriceQuote`/`NavOverride`, gom theo `symbol`, xem
  `process/phase-2.md` mục cache/N+1).
- `getPortfolioValuation()` (dùng chung với Dashboard) để cấp dữ liệu cho
  `HoldingsSummaryCard` — **chưa wiring vào `HoldingsOverviewScreen`** (còn
  dùng `TotalInvestedSection` cũ), business-implementer tự quyết định thay thế
  khi có dữ liệu.
- **Props giả định** cho toàn bộ field `*Extras`/`GroupValuation` — types.ts
  (`HoldingSummary`) **không bị sửa** (chủ ý, ngoài phạm vi), business-implementer
  mở rộng field ở tầng `queries.ts`/view model riêng, không bắt buộc sửa
  `HoldingSummary` gốc vì `HoldingWithValuation` compose qua `Partial<>`.

---

### 3. 2c Chi tiết vị thế — `HoldingDetailScreen` (mới) + `CashflowTimeline` (mới)

- File mới: `src/features/holdings/components/HoldingDetailScreen/HoldingDetailScreen.tsx` (+ `index.ts`)
- File mới: `src/features/holdings/components/CashflowTimeline/CashflowTimeline.tsx` (+ `index.ts`)
- Sửa: `src/app/(dashboard)/holdings/[id]/page.tsx` — trỏ sang organism mới
  (trước đó JSX nhồi trực tiếp trong page, > 40 dòng, đã vi phạm checklist
  `component-architecture.md` từ Phase 1; nhân dịp Phase 2 tách luôn).

```ts
// HoldingDetailScreen.tsx
type HoldingDetailScreenHolding = {
  id: string; symbol: string; name: string | null; type: AssetType;
  unit: string; quantity: string; avgCost: string; totalCostBasis: string;
};
type HoldingValuation = {
  navValue: string;
  priceSource: PriceSource;
  priceSourceLabel: string; // hiện KHÔNG dùng trong render (PriceSourceBadge tự suy label từ source) — giữ lại cho Container tham khảo, có thể bỏ khi wiring thật
  priceNote: string; // "Giá EOD 10/07: 178.900 · vốn TB 163.100"
  xirr: XirrResult;
  absolutePnl: string;
  timeline: CashflowTimelineRow[];
  timelineFootnote?: string;
};
type HoldingDetailScreenProps = {
  holding: HoldingDetailScreenHolding;
  cashflows: CashflowRow[]; // từ @/features/holdings/types, giữ nguyên (TransactionHistoryList không đổi)
  valuation?: HoldingValuation; // vắng mặt = giữ nguyên hiển thị Phase 1
  hidden?: boolean;
};

// CashflowTimeline.tsx
type CashflowTimelineRow = {
  id: string;
  kind: "BUY" | "SELL" | "CUTOFF_NAV"; // CUTOFF_NAV = dòng giả định NAV tại mốc chốt
  label: string;    // "Mua 3.000 CP" / "NAV tại mốc chốt"
  dateNote: string; // "09/07/2024 · giá 158.000" / "11/07/2026 · dòng tiền giả định"
  amount: string;   // mang dấu — BUY âm, SELL/CUTOFF_NAV dương
};
```

**LƯU Ý:** `HoldingValuation.priceSourceLabel` được khai trong Props nhưng
component hiện dùng `PriceSourceBadge` (tự suy nhãn từ `priceSource`) thay vì
field này — giữ lại field vì domain doc gợi ý "Tự động (vnstock)" khác với
"Tự động" thuần (badge dùng chung không phân biệt vnstock cụ thể). Business-implementer
có thể bỏ field này nếu không cần phân biệt.

**Sample data (2c):**

```ts
{
  holding: {
    id: "h1", symbol: "FPT", name: "FPT Corp", type: "STOCK", unit: "cổ phần",
    quantity: "4200", avgCost: "163100", totalCostBasis: "685020000",
  },
  cashflows: [/* 3 CashflowRow thật từ getHoldingDetail() */],
  valuation: {
    navValue: "751380000",
    priceSource: "AUTO",
    priceSourceLabel: "Tự động · vnstock",
    priceNote: "Giá EOD 10/07: 178.900 · vốn TB 163.100",
    xirr: { status: "OK", percentPerYear: 14.2 },
    absolutePnl: "66400000",
    timeline: [
      { id: "cf1", kind: "BUY", label: "Mua 3.000 CP", dateNote: "09/07/2024 · giá 158.000", amount: "-474000000" },
      { id: "cf2", kind: "BUY", label: "Mua 1.200 CP", dateNote: "14/02/2025 · giá 175.500", amount: "-210600000" },
      { id: "cf3", kind: "SELL", label: "Bán 200 CP", dateNote: "03/11/2025 · giá 171.000", amount: "34200000" },
      { id: "cutoff", kind: "CUTOFF_NAV", label: "NAV tại mốc chốt", dateNote: "11/07/2026 · dòng tiền giả định", amount: "751400000" },
    ],
    timelineFootnote: "Dòng tiền giả định = NAV mốc chốt, tính lúc chạy — không lưu vào sổ.",
  },
}
```

**Query business-implementer cần tạo:**
- Mở rộng `getHoldingDetail()` (`src/features/holdings/queries.ts`) trả thêm
  `valuation` — cần: giá hiện tại (`PriceQuote`/`NavOverride`), XIRR riêng
  holding (ghép dòng tiền = `cashflows` + dòng CUTOFF_NAV = NAV tại mốc chốt,
  xem `docs/domain/05`), lãi/lỗ tuyệt đối.
- **Bất biến cần giữ khi wiring:** vị thế đã đóng (SL=0) → XIRR "chốt", KHÔNG
  ghép dòng CUTOFF_NAV (xem `docs/domain/05` "Vị thế đã đóng").
- **Props giả định** — `page.tsx` hiện gọi `HoldingDetailScreen` **không
  truyền `valuation`** (đã xác nhận: component tự rơi về Phase 1). Business-implementer
  cần sửa `page.tsx` thêm `valuation={...}` sau khi mở rộng query.

---

### 4. 2d Nhập giá tay — `NavOverrideForm` (mới)

- File: `src/features/holdings/components/NavOverrideForm/NavOverrideForm.tsx` (+ `index.ts`)
- **Không có route thật** (đúng yêu cầu) — client component, `action` là điểm
  nối Server Action thật.

```ts
type NavOverrideFormState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

type NavOverrideFormProps = {
  holdingId: string;
  symbol: string;
  name: string | null;
  assetType: AssetType;
  unit: string;
  quantity: string;
  totalCostBasis: string;
  lastManualPrice?: { price: string; appliedDate: string };
  defaultDateInputValue: string; // yyyy-MM-dd
  closeHref: string;
  action: (
    prevState: NavOverrideFormState,
    formData: FormData,
  ) => Promise<NavOverrideFormState>;
};
```

**Sample data:**

```ts
{
  holdingId: "h4",
  symbol: "SJC",
  name: "Vàng SJC",
  assetType: "GOLD",
  unit: "chỉ",
  quantity: "45",
  totalCostBasis: "279675000",
  lastManualPrice: { price: "7720", appliedDate: "30/06/2026" },
  defaultDateInputValue: "2026-07-11",
  closeHref: "/holdings/h4",
  action: async (_prev, _formData) => ({ ok: true }), // demo only
}
```

**Server Action business-implementer cần tạo:**
- `saveNavOverride(input): ActionResult<NavOverride>` — validate `price > 0`
  (Decimal), `date`, upsert `NavOverride` theo `(holdingId, date)`. Field
  `name="price"`, `name="date"`, `name="holdingId"` (hidden input) trong form.
- **Quyết định thiết kế của tôi cần xác nhận:**
  - Bỏ scale "nghìn ₫" của mockup (mockup hiện `7.850` = 7.850.000₫/chỉ) —
    dùng raw VND để nhất quán với `TransactionForm`/`NewHoldingForm` hiện có
    (không có tiền lệ scale trong codebase). Nếu giữ scale theo mockup, cần
    sửa `formatMoney`/label và validate ở Server Action.
  - `closeHref` chưa có đích thật — tạm gợi ý trỏ về `ROUTES.holdingDetail(id)`.
  - Nguồn giá selector trong form hiện là **tĩnh, không tương tác** (luôn ở
    chế độ "Nhập tay", "Tự động" chỉ disabled hiển thị) — vì form này CHỈ
    dùng để ghi `NavOverride`, không có ý nghĩa "chọn tự động" trong chính
    form này.

---

### 5. 2e Cài đặt · Mốc chốt — `SettingsScreen` (mới, tách từ page.tsx) + `CutoffPicker` (mới)

- File mới: `src/features/settings/components/SettingsScreen/SettingsScreen.tsx` (+ `index.ts`)
- File mới: `src/features/settings/components/CutoffPicker/CutoffPicker.tsx` (+ `index.ts`)
- Sửa: `src/app/(dashboard)/settings/page.tsx` — tách JSX inline (Phase 1) sang
  organism, giữ nguyên logic đăng xuất (`"use server"` inline gọi `signOut()`).

```ts
// CutoffPicker.tsx
type CutoffKey = "TODAY" | "END_OF_MONTH" | "END_OF_YEAR";
type CutoffOption = {
  key: CutoffKey;
  label: string;
  date: string;
  xirrLabel: string; // "+18,4%/năm" — đã tính trước cho từng mốc cố định
  href: string; // vd `${ROUTES.settings}?cutoff=TODAY`
};
type CutoffPickerProps = {
  selected: CutoffKey | "CUSTOM";
  options: CutoffOption[];
  customHref: string;
  customDateLabel?: string;
  className?: string;
};

// SettingsScreen.tsx
type SettingsScreenProps = {
  cutoff?: CutoffPickerProps; // vắng mặt = ẩn khối "Mốc chốt định giá" (Phase 1 fallback)
  onSignOut: () => Promise<void>;
};
```

**Quyết định kiến trúc quan trọng — KHÁC với mockup (cần business-implementer xác nhận):**
Mockup 2e cho phép **cycle qua các mốc bằng client state** trong 1 màn demo.
Tôi đã đổi sang **Link thật + query param** (`?cutoff=TODAY` v.v.), theo đúng
pattern đã có ở `HoldingsSegmentedNav`/rule "Tab điều hướng nội dung trang →
tách route, không giữ state client" (`component-architecture.md`) — vì đổi mốc
chốt làm NAV/XIRR tính lại khác nhau (tương đương "2 tập dữ liệu khác nhau").
**Điều này có nghĩa route `/settings` cần đọc `searchParams.cutoff` ở
`page.tsx`/`queries.ts` để tính lại `CutoffOption[]` theo mốc đang chọn** —
business-implementer cần thiết kế phần này (`Setting` KHÔNG lưu mốc chốt theo
`docs/domain/09-settings.md`, cần xác nhận nơi lưu lựa chọn: query param
thuần/cookie/field `User` mới).

**Sample data:**

```ts
{
  cutoff: {
    selected: "TODAY",
    options: [
      { key: "TODAY", label: "Hôm nay", date: "11/07/2026", xirrLabel: "+18,4%/năm", href: "/settings?cutoff=TODAY" },
      { key: "END_OF_MONTH", label: "Cuối tháng này", date: "31/07/2026", xirrLabel: "+17,9%/năm", href: "/settings?cutoff=END_OF_MONTH" },
      { key: "END_OF_YEAR", label: "Cuối năm nay", date: "31/12/2026", xirrLabel: "+15,2%/năm", href: "/settings?cutoff=END_OF_YEAR" },
    ],
    customHref: "/settings?cutoff=CUSTOM",
  },
}
```

**Query/action business-implementer cần tạo:**
- `getCutoffOptions(selected): CutoffOption[]` — tính XIRR cho 3 mốc cố định
  (tốn kém, cân nhắc cache/tính lười theo mốc đang chọn thay vì luôn tính cả 3).
- Cơ chế lưu `selected` — **TBD**, domain doc chưa định nghĩa (xem đoạn trên).
- **Props giả định** — `page.tsx` hiện gọi `SettingsScreen` **không truyền
  `cutoff`** → khối "Mốc chốt định giá" đang ẩn trên route thật.

---

### 6. 2f Không tính được XIRR

Xem mục **1 (`DashboardScreen`)** — cùng component, khác data (`xirr.status`,
`missingPriceHoldings`, `navValueIsPartial`, `absolutePnlIsPartial`).

`MissingPriceList` (mới, dùng trong `DashboardScreen`):

```ts
// src/features/dashboard/components/MissingPriceList/MissingPriceList.tsx
type MissingPriceHolding = {
  id: string; symbol: string; name: string; type: AssetType;
  reasonLabel: string; // "Trái phiếu · chưa có giá nhập tay"
  href: string; // CTA "Nhập giá"
};
```

**Quyết định thiết kế cần xác nhận:** nút "Nhập giá" hiện trỏ tạm về
`ROUTES.holdingDetail(id)` (route thật duy nhất liên quan hiện có) thay vì một
route NavOverride thật (chưa tồn tại theo yêu cầu). Khi business-implementer
tạo route thật cho `NavOverrideForm` (vd `/holdings/[id]/price`), cần đổi
`href` này và thêm `ROUTES` entry tương ứng.

`AllocationBar` (mới, dùng trong `DashboardScreen`):

```ts
// src/features/dashboard/components/AllocationBar/AllocationBar.tsx
type AllocationSlice = { type: AssetType; percent: number };
type AllocationBarProps = { slices: AllocationSlice[]; className?: string };
```

---

## B. BottomNav dùng chung (mới)

- File mới: `src/components/BottomNav/BottomNav.tsx` (+ `index.ts`).

```ts
type BottomNavTab = "dashboard" | "holdings" | "settings";
type BottomNavProps = { active: BottomNavTab; className?: string };
```

Server Component thuần (chỉ `<Link>`, không state) — nhận `active` **tường
minh từ parent** (khác `HoldingsSegmentedNav` vốn tự suy từ `usePathname()`),
theo đúng cách wiring đã chốt trong chỉ thị nhiệm vụ.

**File sửa để wiring (4 chỗ theo phạm vi đã chốt — route gốc/tab, không phải
component cố định):**
1. `src/features/holdings/components/HoldingsOverviewScreen/HoldingsOverviewScreen.tsx`
   → thêm `<BottomNav active="holdings" />`, đổi padding `p-5` → `p-5 pb-28`,
   đổi FAB `bottom-6` → `bottom-24` (nổi trên BottomNav cố định đáy màn hình).
2. `src/features/holdings/components/HoldingsEmptyState/HoldingsEmptyState.tsx`
   → thêm `<BottomNav active="holdings" />` + `pb-28` (nhánh rỗng của cùng
   route `/holdings`, xem layout ở trên — bổ sung sau khi user xác nhận).
3. `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx`
   (mới) → có sẵn `<BottomNav active="dashboard" />` trong component.
4. `src/features/settings/components/SettingsScreen/SettingsScreen.tsx` (mới)
   → có sẵn `<BottomNav active="settings" />` trong component.

**Route mới cần thiết:** thêm `dashboard: "/"` vào `src/lib/routes.ts` (rule
`typescript-style.md` cấm hardcode route rải rác — BottomNav cần trỏ tab
"Tổng quan" về `/`).

**Xác nhận phạm vi:** KHÔNG thêm BottomNav vào `/holdings/new`,
`/holdings/[id]`, `/holdings/[id]/transactions/*`, `/settings/members`,
`/settings/members/invite`, `/sign-in` — đã kiểm tra, không file nào trong các
route này bị đụng tới.

**Đã xác nhận với user (sau khi design-implementer bàn giao):**
`HoldingsEmptyState`
(`src/features/holdings/components/HoldingsEmptyState/HoldingsEmptyState.tsx`,
hiển thị khi `/holdings` chưa có vị thế nào) **cũng đã thêm `<BottomNav
active="holdings" />`** — component này thay thế hoàn toàn
`HoldingsOverviewScreen` ở tầng layout khi rỗng (xem
`holdings/(overview)/layout.tsx`), nên vẫn thuộc route gốc `/holdings`, không
phải màn con. Vậy phạm vi wiring BottomNav thực tế là **4 chỗ** (xem mục B).

---

## C. Token mới

`--warning` / `--warning-foreground` (`src/app/globals.css` + `@theme inline`
+ `docs/rules/ui-ux-design.md`) — dùng cho badge "Nhập tay", "thiếu giá",
"không tính được XIRR", CTA màu vàng trong `NavOverrideForm`. Trùng hex với
`--asset-gold` (`#e0b34c`) một cách ngẫu nhiên theo mockup — token ngữ nghĩa
riêng, không phải alias. Thêm `warning` variant vào `Badge`
(`src/components/ui/badge.tsx`).

## D. File đã tạo/sửa — tổng hợp

**Tạo mới:**
- `src/components/BottomNav/{BottomNav.tsx,index.ts}`
- `src/components/ReturnMetrics/{ReturnMetrics.tsx,index.ts}`
- `src/components/PriceSourceBadge/{PriceSourceBadge.tsx,index.ts}`
- `src/features/dashboard/components/DashboardScreen/{DashboardScreen.tsx,DashboardScreenSkeleton.tsx,index.ts}`
- `src/features/dashboard/components/AllocationBar/{AllocationBar.tsx,index.ts}`
- `src/features/dashboard/components/MissingPriceList/{MissingPriceList.tsx,index.ts}`
- `src/features/holdings/components/HoldingsSummaryCard/{HoldingsSummaryCard.tsx,HoldingsSummaryCardSkeleton.tsx,index.ts}`
- `src/features/holdings/components/CashflowTimeline/{CashflowTimeline.tsx,index.ts}`
- `src/features/holdings/components/HoldingDetailScreen/{HoldingDetailScreen.tsx,index.ts}`
- `src/features/holdings/components/NavOverrideForm/{NavOverrideForm.tsx,index.ts}`
- `src/features/settings/components/CutoffPicker/{CutoffPicker.tsx,index.ts}`
- `src/features/settings/components/SettingsScreen/{SettingsScreen.tsx,index.ts}`

**Sửa:**
- `src/app/globals.css` (token `--warning`)
- `src/components/ui/badge.tsx` (variant `warning`)
- `src/lib/routes.ts` (thêm `dashboard: "/"`)
- `src/features/holdings/components/HoldingsGroupCard/{HoldingsGroupCard.tsx,index.ts}`
- `src/features/holdings/components/HoldingsList/HoldingsList.tsx`
- `src/features/holdings/components/HoldingsOverviewScreen/HoldingsOverviewScreen.tsx`
- `src/app/(dashboard)/holdings/[id]/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`

**Không sửa (đúng chỉ thị):**
- `src/app/(dashboard)/page.tsx` (vẫn `redirect(ROUTES.holdings)`)
- `src/features/holdings/types.ts`, `group-holdings.ts`, `queries.ts`,
  `actions.ts` — mọi field/valuation mới compose qua `Partial<>`/prop optional,
  không sửa domain type gốc.

## E. Kết quả kiểm tra

- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm test` (vitest, 7 file / 58 test có sẵn) — pass, không có test nào vỡ.
- Prettier: đã `--write` đúng các file mình tạo/sửa; không đụng file khác đang
  có nợ format sẵn có (vd `HoldingsGroupCardSkeleton.tsx`,
  `HoldingsOverviewScreen/index.ts` — không nằm trong phạm vi thay đổi).
