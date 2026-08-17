# UI digest — NAV ròng + lãi/lỗ theo nhóm tài sản (issue #130)

Kéo từ Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → file **"Phase 9 Screens.dc.html"**
("9" chỉ là số thứ tự file bên Claude Design, KHÔNG phải Phase 9 của Navtrack
roadmap). Nhận từ **export zip user gửi trực tiếp**, không qua DesignSync.
Cache cục bộ tại `.claude/design-cache/raw/Phase-9-Screens.dc.html` +
`.claude/design-cache/index.json` (entry `issue-130`). Fetch 2026-08-17.

Issue này **không** gắn với `process/phase-N.md` nào (giống #131/#132) —
digest đặt tên theo slug thay vì số phase. Nguồn nghiệp vụ: nguyên văn issue
#130 (xem prompt) + 3 khối mockup 130a/130b/130c.

Chỉ **Presentational** — component nhận props hiển thị số đã tính sẵn. Props
dưới đây là **phác thảo**, `design-implementer`/`business-implementer` chốt
khi hiện thực.

## Tóm tắt màn hình → component → trạng thái wiring

| # | Nội dung | Component dự kiến | Đã wiring vào route thật? |
|---|---|---|---|
| 130a | `/allocation` đầy đủ dữ liệu — donut + 4 dòng nhóm giữ bố cục cũ, mỗi dòng thêm NAV ròng trái + lãi/lỗ theo vốn VND+% phải, thẻ tổng NAV/tổng lãi-lỗ trên đầu, nút mắt header | `AllocationScreen` (mở rộng props hiện có, `src/features/dashboard/components/AllocationScreen/`) | Chưa — hiện tại `AllocationScreen` **không nhận VND nào cả**, `page.tsx` ghi rõ "không cần prop hidden" |
| 130b | NAV nhóm chưa đầy đủ do mã thiếu giá — nhóm Cổ phiếu ghi "NAV ròng · 2/3 mã có giá", ghi chú amber, viền thẻ amber, thẻ tổng NAV mang badge "Chưa đầy đủ" | Cùng `AllocationScreen`, biến thể theo dữ liệu (`navIsPartial=true` cho 1+ nhóm) | Chưa |
| 130c | Anatomy 1 dòng nhóm — thứ tự đọc, 3 biến thể chip lãi/lỗ, bảng ẩn-tiền cái gì ẩn/không | Không phải màn thật — tài liệu quy tắc cho dòng nhóm + chip `PercentChange` (atom **đã có sẵn**, xem mục Atom/molecule) | Không áp dụng |

130a/130b dùng **chung một component** vì cùng khối "donut + danh sách nhóm",
chỉ khác props theo dữ liệu (nhóm nào `navIsPartial`) — biến thiên theo **dữ
liệu**, không phải theo enum nghiệp vụ, không cần tách variant component
(cùng lý luận đã áp dụng cho `StockAllocationDetail` ở
`process/UI_stock-allocation-detail.md`).

## Quy ước bắt buộc (mockup + issue #130, dễ hiểu sai nhất)

- **Lãi/lỗ là THEO VỐN** (NAV nhóm − vốn đã bỏ vào nhóm), **KHÔNG PHẢI so với
  kỳ trước** — nhãn phải ghi rõ "theo vốn" để không bị đọc nhầm thành biến
  động phiên/kỳ trước (khác cảm giác mũi tên lên/xuống thường gợi ý).
- **Công thức phải khớp `groupValuations.changePercent`** ở
  `getOpenHoldingsWithValuation()` (`src/features/holdings/queries/holdings-valuation.ts`
  dòng ~125): `(sumMarketValue − sumCostBasis) / sumCostBasis × 100`, mẫu số
  **chỉ tính trên các mã ĐÃ định giá trong nhóm** — để `/holdings` và
  `/allocation` luôn khớp số cho cùng một nhóm tài sản.
- **Mã thiếu giá (`MISSING_PRICE`) bị loại khỏi CẢ NAV lẫn lãi/lỗ nhóm — không
  mặc định 0.** Dòng nhóm bị ảnh hưởng bắt buộc có ghi chú amber "chưa đầy đủ"
  ngay dưới hàng số, viền thẻ đổi sang amber; thẻ tổng NAV đầu trang cũng phải
  mang badge "Chưa đầy đủ" nếu **bất kỳ** nhóm nào thiếu.
- **Nút mắt chỉ ẩn VND** (NAV, lãi/lỗ tiền, tổng NAV/tổng lãi-lỗ). **% phân bổ
  và % lãi/lỗ LUÔN hiện**, không bao giờ bị ẩn — đúng quy tắc đã có ở
  `component-architecture.md` mục "Đặc thù Navtrack" và đã áp dụng cho
  `AllocationScreen`/`StockAllocationDetail` hiện tại.
- **Lãi/lỗ đúng bằng 0** (mockup: Trái phiếu) → chip dùng **biến thể trung
  tính** (icon gạch ngang, xám), khác hẳn lãi/lỗ nhẹ — **atom `PercentChange`
  đã tự làm đúng việc này** (`value === 0` → `bg-muted text-muted-foreground` +
  icon `Minus`), không cần dựng logic mới.

## Từng màn hình

### `AllocationScreen` (mở rộng, 130a/130b)

File hiện có: `src/features/dashboard/components/AllocationScreen/AllocationScreen.tsx`
(+ `AllocationDonutChart.tsx` colocate). Route: `src/app/(dashboard)/allocation/page.tsx`.

**Thay đổi kiến trúc cần lưu ý trước khi phác thảo Props:** hiện tại
`AllocationPage` gọi thẳng `AllocationScreen` (Server Component thuần), có
comment tường minh "% không bị ẩn bởi chế độ ẩn số tiền — AllocationScreen
không nhận/không cần prop `hidden`". Vì màn mới **có** VND (NAV, lãi/lỗ), cần
`hidden`/`onToggleHidden` — tiền lệ đã có nguyên hình mẫu ở
`StockAllocationDetailClient` (`src/features/dashboard/components/StockAllocationDetail/StockAllocationDetailClient.tsx`):
client wrapper `"use client"` giữ `useState(initialHidden)` (đọc từ
`getHideAmountsByDefault()`), `onToggleHidden` gọi Server Action
`setHideAmountsByDefault()` (optimistic update, revert nếu action fail), rồi
mới render `AllocationScreen` (Server Component gốc) như hiện tại. Rất có thể
cần thêm `AllocationScreenClient` tương tự, thay `page.tsx` gọi
`Promise.all([getAllocationDetail(), getHideAmountsByDefault()])` giống
`StockAllocationPage` đã làm — **không tự chốt, để design-implementer/business-implementer
quyết định theo đúng tiền lệ này**.

```ts
// Mở rộng AllocationDonutSlice hiện có (KHÔNG đổi tên field percent/type/note
// đã dùng ở AllocationDonutChart) — mọi field MỚI optional-ish theo trạng thái
// thiếu giá, giữ tương thích ngược với chỗ gọi hiện tại (StockAllocationDetail
// dùng field khác, không đụng).
type AllocationDonutSlice = {
  type: AssetType;
  percent: number; // 0-100, KHÔNG bị ẩn — giữ nguyên
  note?: string; // "· gồm CCQ" cho FUND — giữ nguyên

  // MỚI (issue #130):
  navAmount: string; // NAV ròng nhóm, Decimal đã serialize; ẨN theo `hidden`
  pnlAmount: string; // lãi/lỗ theo vốn (VND, CÓ dấu) — cùng công thức groupValuations.changePercent; ẨN theo `hidden`
  pnlPercent: number; // lãi/lỗ theo vốn (%), mẫu số = cost basis CÁC MÃ ĐÃ ĐỊNH GIÁ trong nhóm — KHÔNG bị ẩn
  navIsPartial: boolean; // true khi nhóm có ≥1 mã MISSING_PRICE (loại khỏi navAmount/pnlAmount/pnlPercent)
  pricedCount?: number; // "2/3 mã có giá" — chỉ có khi navIsPartial
  totalCount?: number; // tổng số mã trong nhóm (kể cả thiếu giá) — chỉ có khi navIsPartial
  missingSymbolsLabel?: string; // "MWG" — ghép câu ghi chú amber "1 mã thiếu giá (MWG)"
};

type AllocationScreenProps = {
  backHref: string;
  slices: AllocationDonutSlice[];
  concentrationWarningCount: number;

  // MỚI (issue #130):
  hidden?: boolean; // cờ ẩn số tiền — chỉ ảnh hưởng navAmount/pnlAmount/totalNavAmount/totalPnlAmount
  onToggleHidden?: () => void; // client leaf, tái dùng MoneyValueToggleButton nếu khớp props
  totalNavAmount: string; // Σ navAmount các nhóm KHÔNG partial (= navSum hiện có ở getAllocationDetail/buildAllocation)
  totalNavIsPartial: boolean; // true khi ≥1 slices[].navIsPartial — badge "Chưa đầy đủ" ở thẻ tổng
  totalPnlAmount: string;
  totalPnlPercent: number; // xem "Điểm cần xác nhận" #1 — mẫu số CHƯA rõ khớp field nào đã có
};
```

State cần có trong 1 component (theo dữ liệu, không phải `sc-if` cứng ở
mockup):

- **Đầy đủ dữ liệu** (130a): mọi `slices[].navIsPartial === false`.
- **1+ nhóm NAV chưa đầy đủ** (130b): nhóm đó `navIsPartial === true` → viền
  thẻ amber, dòng nhãn "NAV ròng" đổi thành "NAV ròng · {pricedCount}/{totalCount}
  mã có giá", card giải thích amber "{N} mã thiếu giá ({missingSymbolsLabel}) —
  NAV nhóm {tên} chưa đầy đủ..." ngay dưới hàng số, `totalNavIsPartial = true`
  kéo theo badge "Chưa đầy đủ" ở thẻ tổng đầu trang.
- **Lãi/lỗ = 0 đúng bằng 0** (mockup: Trái phiếu): `pnlPercent === 0` →
  `PercentChange` tự chuyển biến thể trung tính, không cần state riêng.
- **Ẩn số tiền** (`hidden = true`): `navAmount`/`pnlAmount`/`totalNavAmount`/
  `totalPnlAmount` hiện "••••••", `percent`/`pnlPercent` giữ nguyên hiện —
  giống hệt pattern `formatMoney(value, { hidden })` đã dùng khắp app.
- **Rỗng** (`slices.length === 0`): đã có sẵn ở component hiện tại (nhánh
  "Chưa có vị thế nào có giá để tính phân bổ"), không đổi.

### Sample data (bám đúng số trong mockup để soi UI ra giống bản vẽ)

```
Cổ phiếu   — asset-stock — 52,2% — NAV 60.000.000 ₫ — lãi/lỗ +8.000.000 ₫ (+15,4%) — drill-down có
Quỹ        — asset-fund  — 21,7% — NAV 25.000.000 ₫ — lãi/lỗ −2.500.000 ₫ (−9,1%)
Trái phiếu — asset-bond  — 17,4% — NAV 20.000.000 ₫ — lãi/lỗ 0 ₫ (0,0%) — chip trung tính
Vàng       — asset-gold  —  8,7% — NAV 10.000.000 ₫ — lãi/lỗ +1.800.000 ₫ (+22,0%)

Tổng NAV ròng: 115.000.000 ₫ (donut center rút gọn "115tr ₫")
Tổng lãi/lỗ theo vốn: +7.300.000 ₫ (+6,8%)
```

Biến thể **130b** (NAV nhóm chưa đầy đủ): giữ nguyên 3 nhóm Quỹ/Trái
phiếu/Vàng ở trên, đổi nhóm **Cổ phiếu**:

```
Cổ phiếu — navIsPartial: true — pricedCount: 2, totalCount: 3
  NAV ròng · 2/3 mã có giá: 60.000.000 ₫ (chỉ 2 mã đã có giá)
  Lãi/lỗ theo vốn: +8.000.000 ₫ (+15,4%) — của riêng 2 mã đã có giá
  missingSymbolsLabel: "MWG"
  Ghi chú amber: "1 mã thiếu giá (MWG) — NAV nhóm cổ phiếu chưa đầy đủ. Số
  trên là NAV và lãi/lỗ của 2 mã đã có giá; MWG chưa được tính vào (không mặc
  định 0 ₫)."
totalNavIsPartial: true → thẻ tổng có badge "Chưa đầy đủ · 1 mã thiếu giá"
```

## Atom/molecule dùng lại (đối chiếu `docs/rules/ui-ux-design.md` mục "Kho atoms & molecules")

| Cần | Tái dùng được? | Ghi chú |
|---|---|---|
| Nút back + tiêu đề + subtitle | ✅ `PageHeader` | Đã dùng ở `AllocationScreen` hiện tại; mockup đổi subtitle thành "NAV ròng & lãi/lỗ theo vốn · 4 nhóm" — xem "Điểm cần xác nhận" #6 |
| Nút mắt ẩn/hiện tiền ở header | ✅ `MoneyValueToggleButton` (export từ `MoneyValue`, dùng lại từ Phase 6/`StockAllocationDetailClient`) | Kiểm props khớp trước khi dùng thẳng |
| Chip lãi/lỗ 3 biến thể (gain/loss/trung tính khi = 0) | ✅ `PercentChange` (`variant: "gain-loss"`) | **Khớp NGUYÊN VĂN** 3 biến thể mockup 130c yêu cầu — `isZero` đã tự dùng `bg-muted text-muted-foreground` + icon `Minus`, không cần code mới. Precedent nhúng gọn trong dòng: `HoldingsGroupCard` dùng `className="bg-transparent px-0 py-0"` để bỏ nền chip khi cần |
| Format tiền + màu theo dấu | ✅ `formatMoney` (`lib/format.ts`) + `signColorClass` | `signColorClass` cho màu chữ `pnlAmount`/`totalPnlAmount` (0 → `text-foreground`, khác biến thể trung tính xám của `PercentChange` — xem "Điểm cần xác nhận" #5) |
| Donut chart | ✅ `AllocationDonutChart` (đã có, Recharts `PieChart`) | Center label hiện tại là "{n} nhóm / dù đang ẩn tiền" — mockup 130a/b muốn "Tổng NAV" + giá trị rút gọn, xem "Điểm cần xác nhận" #2 |
| Card viền amber + note "chưa đầy đủ" | ✅ Pattern có sẵn (`border-warning/28 bg-warning/8`, đã dùng cho callout cảnh báo tập trung trong chính `AllocationScreen`) | Tái dùng token, không cần atom mới |
| Dot màu theo loại tài sản | ✅ `ASSET_TYPE_DOT_CLASS` (từ `AssetTypeBadge`) | Đã dùng nguyên trong `AllocationScreen` hiện tại |
| Client wrapper đọc/ghi `hidden` qua Server Action | ✅ Pattern `StockAllocationDetailClient` (`initialHidden` từ `getHideAmountsByDefault()`, `onToggleHidden` gọi `setHideAmountsByDefault()`) | Cần dựng `AllocationScreenClient` tương tự — xem mục "Từng màn hình" |
| "Thẻ tổng NAV/tổng lãi-lỗ" đầu trang | ⚠️ `StatCard` được liệt kê trong `docs/rules/ui-ux-design.md` là molecule **đã có**, nhưng **không tìm thấy file `src/components/StatCard/` nào trong repo hiện tại** | Có thể tài liệu đã lệch so với code (đã bị đổi tên/refactor thành `NavHeroCard` riêng cho Dashboard mà chưa cập nhật bảng kho?) — **design-implementer xác nhận trước khi dựng**, đừng import `StatCard` nếu không tồn tại. `NavHeroCard` (`features/dashboard/components/NavHeroCard/`) là ví dụ gần nhất về "label + tiền lớn + delta màu theo dấu" nếu cần tham khảo cấu trúc |
| Icon mới cần map | — | `help` → `HelpCircle` (đã có, Phase 6), `functions` → `Sigma` (đã có), `remove` → `Minus` (đã dùng trong `PercentChange`), `price_change` → `CircleDollarSign` (đã có, issue #131). Không có icon Material Symbols nào MỚI cần thêm bảng mapping |

## Điểm lệch/cần xác nhận (KHÔNG tự chốt)

1. **Nguồn dữ liệu NAV/cost-basis theo nhóm CHƯA đủ ở `lib/portfolio-valuation.ts`.**
   `buildAllocation()` hiện tại (`src/lib/portfolio-valuation.ts` dòng ~234)
   chỉ nhận `holdings`/`valuations`/`navSum` và trả **percent** (đã bỏ NAV
   tuyệt đối sau khi chia). Cần mở rộng để **giữ lại NAV tuyệt đối theo nhóm**
   VÀ **nhận thêm cost basis theo nhóm** để tính `pnlAmount`/`pnlPercent` —
   công thức mẫu đã có sẵn ở `getOpenHoldingsWithValuation()`
   (`features/holdings/queries/holdings-valuation.ts` dòng ~96-141,
   `groupValuations`) nhưng hàm đó hiện chỉ trả `changePercent` (không có
   `pnlAmount` VND) và được viết cho context khác (`/holdings`, không phải
   `/allocation`). `business-implementer` cần quyết định: sửa `buildAllocation()`
   để trả đủ (NAV + pnlAmount + pnlPercent + partial flag mỗi nhóm), hay viết
   hàm mới cạnh nó tái dùng cùng vòng lặp — không tự chốt ở digest này.

2. **Mẫu số của `totalPnlPercent` (thẻ tổng đầu trang) CHƯA rõ khớp field nào
   đã có.** `PortfolioValuation.navDeltaPercent` (đã có ở
   `getPortfolioValuation()`) tính `absolutePnl.div(totalInvested)` với
   `totalInvested` = **tổng vốn ròng của TẤT CẢ holding** (không lọc theo mã
   đã định giá) — khác hẳn cách `groupValuations.changePercent` chỉ lấy cost
   basis của **các mã ĐÃ định giá** trong nhóm. Nếu thẻ tổng ở `/allocation`
   phải "khớp công thức chip lãi/lỗ ở trang Danh mục" (như mockup ghi chú cuối
   130a/130b) thì **không thể tái dùng thẳng `navDeltaPercent` hiện có** khi
   danh mục có mã thiếu giá — cần công thức tổng hợp riêng (Σ pnlAmount các
   nhóm / Σ cost basis các mã đã định giá) để nhất quán với từng dòng nhóm bên
   dưới. Cần `business-implementer` xác nhận trước khi implement.

3. **Donut center đổi nội dung — có đổi hay không?** Hiện tại
   `AllocationDonutChart` hiện "{n} nhóm / % chỉ hiện / dù đang ẩn tiền" (đã
   là một lệch có chủ đích so với mockup Phase 6 gốc, ghi ở
   `process/UI_phase_6.md`). Mockup 130a/130b vẽ center hiện "Tổng NAV" +
   giá trị rút gọn (vd "115tr ₫"). Issue #130 không yêu cầu tường minh đổi
   donut center — chỉ mockup thể hiện vậy. Design-implementer chốt: đổi center
   theo mockup mới (mất thông điệp "dù đang ẩn tiền" hiện có) hay giữ nguyên
   center cũ và chỉ thêm phần thẻ tổng NAV/lãi-lỗ bên cạnh (mockup 130a vẽ 2
   thứ cạnh nhau — donut + card tổng riêng, không nhất thiết đổi bên trong
   donut).

4. **NAV nhóm chưa đầy đủ có tính vào donut/percent của nhóm đó không?**
   Mockup 130b vẫn hiện `52,2%` cho Cổ phiếu (tức % phân bổ KHÔNG đổi so với
   130a dù mã thiếu giá) — cần xác nhận đây có phải chủ đích (percent phân bổ
   dùng logic khác, có thể đã tính trước khi phát hiện thiếu giá trong mockup,
   chỉ để giữ visual đơn giản) hay **percent cũng phải giảm theo NAV nhóm mới
   loại trừ mã thiếu giá** (nhất quán với cách `buildAllocation()` hiện tại
   loại NAV holding MISSING_PRICE khỏi `navByType` — nếu vậy % Cổ phiếu ở
   130b lẽ ra phải khác 52,2%, không giữ nguyên như 130a). Đây là điểm mockup
   **có khả năng chưa nhất quán nội bộ** — nêu để business-implementer xác
   nhận công thức thật, không tự sửa số mockup.

5. **Màu chữ `pnlAmount` khi = 0 khác biến thể trung tính của chip
   `PercentChange`.** `signColorClass(0)` trả `text-foreground` (không xám),
   trong khi `PercentChange` ở `isZero` dùng `text-muted-foreground` trên nền
   `bg-muted`. Mockup 130c chỉ vẽ rõ 3 biến thể của **chip**, không nói màu
   chữ số VND bên trái chip khi lãi/lỗ = 0 — design-implementer tự quyết định
   có đồng bộ 2 màu này hay giữ khác nhau (tiền lệ `NavHeroCard` đã chấp nhận
   `signColorClass` độc lập với `PercentChange`).

6. **Copy subtitle `PageHeader` đổi.** Bản hiện có: "Theo nhóm · % giá trị thị
   trường". Mockup: "NAV ròng & lãi/lỗ theo vốn · 4 nhóm". Đổi hẳn theo mockup
   hay giữ bản cũ (ngắn gọn hơn, không nêu số nhóm cứng "4" — số nhóm có thể
   < 4 khi danh mục thiếu loại tài sản nào đó) — cần xác nhận, tránh hardcode
   "4 nhóm" khi thực tế `slices.length` biến thiên.

7. **Định dạng số tiền có dấu `+`/`−` tường minh.** Mockup (`fmtSigned()`
   trong script canvas) luôn thêm dấu `+`/`−` rõ ràng trước số tiền dương/âm.
   Pattern hiện có (`NavHeroCard`) **không** thêm dấu `+` tường minh cho
   `formatMoney()` — chỉ dựa vào icon mũi tên + `signColorClass` để truyền đạt
   hướng. Nếu giữ nguyên pattern cũ cho `navAmount`/`pnlAmount`/`totalPnlAmount`
   thì lệch mockup (mockup có `+` tường minh); nếu thêm `+` tường minh thì cần
   sửa `formatMoney()` hoặc thêm helper mới — cần design-implementer chốt,
   ưu tiên nhất quán với `NavHeroCard` (cùng khái niệm "lãi/lỗ theo vốn") hơn
   là đúng tuyệt đối mockup.
