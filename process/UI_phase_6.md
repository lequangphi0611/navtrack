# Phase 6 — UI digest (tiền-triển khai, đọc trước khi planner/design-implementer vào việc)

Digest do `design-fetcher` sinh, kéo từ Claude Design project "Web app design
mobile first" (`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 6 Screens.dc.html`,
đủ 10 màn 6a-6j. Cache cục bộ tại
`.claude/design-cache/raw/Phase-6-Screens.dc.html` +
`.claude/design-cache/index.json`.

**Đây là digest TIỀN triển khai** (Phase 6 đang ⬜ theo `process/PROCESS.md`) —
khác các file `UI_phase_2/3/4.md` (báo cáo HẬU triển khai của
`design-implementer`). Nội dung dưới đây là quan sát mockup + đối chiếu với
`process/phase-6.md`/`docs/domain/04-pricing-and-valuation.md` ("Cảnh báo tập
trung") hiện có, không phải quyết định đã chốt code — `planner`/
`design-implementer` vẫn tự quyết cấu trúc file/route khi bắt tay vào việc.

**Chỉ Presentational** — Props dưới đây là **phác thảo**, `design-implementer`/
`business-implementer` chốt lại khi hiện thực (theo đúng tiền lệ `UI_phase_5.md`
đã ghi rõ Props thật có thể khác phác thảo ban đầu).

## Tóm tắt trạng thái wiring

| # | Màn | Component dự kiến | Đã wiring vào route thật? |
|---|---|---|---|
| 6a | NAV chart mặc định + tooltip | `NavTrendChart` (mới) trong `DashboardScreen` (`/`) | Chưa — cần snapshot series thật (business-implementer) |
| 6b | NAV chart rỗng (< 2 snapshot) | Nhánh rỗng của `NavTrendChart` | Chưa |
| 6c | NAV chart đang tải | `NavTrendChartSkeleton` (colocate) + `Suspense` riêng | Chưa |
| 6d | Phân bổ tài sản · donut | `AllocationScreen` (mới, route `/allocation` hoặc sheet) | Chưa |
| 6e | Ẩn số tiền toàn app | Hạ tầng state mới (context/cookie) + `MoneyValueToggleButton` đã có | Chưa — chưa có cơ chế "toàn app", hiện `hidden` chỉ là prop rời rạc |
| 6f | Cài đặt · toggle riêng tư | `PrivacyToggle` (mới) trong `SettingsScreen`, nhóm "Riêng tư" | Chưa — cần atom `Switch` mới + `User.hideAmountsByDefault` (đã có trong Prisma schema, chưa đọc/ghi) |
| 6g | Tab "Đã đóng" | Mở rộng `HoldingsPositionsSection`/`HoldingsList` (đã có route `/holdings/closed`, hiện chỉ Phase 1 fallback) | Một phần — route tồn tại, dữ liệu realized PnL/XIRR/thời gian giữ CHƯA có |
| 6h | Tab Đã đóng rỗng + đang tải | `EmptyState` đã có (khác icon/copy) + `HoldingsListSkeleton` đã có (khác hình dạng: cần thêm 2 stat card skeleton) | Một phần |
| 6i | Sheet chi tiết vị thế đã đóng | `ClosedPositionSheet` (mới) | Chưa |
| 6j | Badge cảnh báo tập trung (4 biến thể) | `ConcentrationBadge` (mới, dùng ở `HoldingListItem`/`HoldingsGroupCard`/`AllocationScreen`) | Chưa |

---

## 1. Biểu đồ NAV theo thời gian (6a/6b/6c)

**Vị trí:** card mới **"Giá trị tài sản"** chèn vào `DashboardScreen`, ngay dưới
NAV hero card hiện có (`Giá trị thị trường (NAV)`) và **trên** `PnlCostDragCard`
— khác biểu đồ cột tĩnh `NavHistoryChart` đã có ở `/snapshots` (đó là 8 cột CSS
bar, KHÔNG tương tác, không phải component này — Phase 6 dựng chart MỚI, dùng
**Recharts** theo đúng việc cần làm ở `phase-6.md` dòng 7; `NavHistoryChart` giữ
nguyên, không sửa/xoá).

**⚠️ Chưa có `recharts` trong `package.json`** — `design-implementer` cần thêm
dependency này (`pnpm add recharts`) trước khi dựng `NavTrendChart`.

### 6a — mặc định + tooltip

- Header card: nhãn "Giá trị tài sản" + badge % thay đổi (màu theo dấu, ví dụ
  `+13,7%`) — % này là % thay đổi từ đầu kỳ đang chọn (Tháng/Năm/Tất cả), KHÁC
  `navDeltaPercent` ở NAV hero (đó là so với vốn đã bỏ vào, không phải theo kỳ).
- `SegmentedControl` 3 lựa chọn **Tháng / Năm / Tất cả** — mockup mặc định chọn
  "Năm". Đổi kỳ → refetch/derive lại chuỗi điểm cho khoảng thời gian đó (nguồn
  dữ liệu: `Snapshot` đã đóng băng, Phase 3 — business-implementer quyết định
  cách gộp: Tháng có thể cần điểm trong tháng gần nhất, Năm dùng snapshot theo
  tháng trong năm, Tất cả dùng mọi mốc).
- Chart: đường mượt + vùng tô gradient dưới đường (area+line, kiểu Recharts
  `AreaChart`), lưới ngang mờ 3 vạch, trục X hiện nhãn tháng rút gọn (T1, T4,
  T8, T12 — chỉ vài mốc, không dày đặc), trục Y **ẩn theo mặc định** (chỉ hiện
  2 nhãn giá trị rút gọn ở góc phải khi không ở chế độ ẩn số tiền — xem mục
  privacy bên dưới).
- **Tương tác chạm/giữ (touch/hover):** hiện 1 điểm mốc (dot to hơn) + đường kẻ
  dọc nét đứt + tooltip nổi phía trên chứa: ngày (`dd/MM/yyyy`), NAV tại ngày đó
  (tiền, tôn trọng `hidden`), % thay đổi "từ đầu kỳ" tại điểm đó. Điểm cuối
  cùng (hôm nay) luôn có 1 dot nhỏ hiện sẵn không cần tương tác.
- **Privacy:** nhãn trục Y (giá trị tuyệt đối rút gọn, ví dụ "3,8 tỷ") VÀ số
  tiền trong tooltip đều bị ẩn khi `hidden=true` — mockup dùng CSS `filter:
  blur()` cho số trong tooltip/nhãn trục nhưng **thay hẳn nhãn trục bằng một
  pill "trục ẩn" + icon `visibility_off`** khi ẩn (không chỉ blur mờ chữ số cũ).
  Đường/area chart vẫn vẽ bình thường (hình dạng đường không phải "số tiền
  tuyệt đối" theo nghĩa cần che — chỉ nhãn số mới cần ẩn). Dòng chú thích nhỏ
  dưới chart (`touch_app` icon) đổi câu chữ theo trạng thái ẩn (nội dung câu
  chữ cụ thể là `{{ chartPrivacyNote }}`, mockup không show giá trị runtime —
  gợi ý 2 câu: "Chạm giữ vào đường để xem NAV tại từng ngày." (thường) / "Số
  tiền tạm ẩn — chạm giữ vẫn xem được xu hướng, không xem được số." (khi
  `hidden`)).
- **KHÔNG dùng CSS `filter: blur()` cho số tiền** — mockup 6a/6e minh hoạ bằng
  blur nhưng **khác pattern `formatMoney(value, { hidden })` đã có** (thay hẳn
  chuỗi số bằng `"••••••"`, không blur). Giữ nguyên convention cũ (nhất quán
  toàn app, dễ test hơn CSS filter) — xem mục "Điểm cần xác nhận".

**Props phác thảo:**

```ts
// src/features/dashboard/components/NavTrendChart/NavTrendChart.tsx
type NavTrendPeriod = "MONTH" | "YEAR" | "ALL";

type NavTrendPoint = {
  date: string; // ISO, business-implementer group theo period
  value: string; // NAV Decimal đã serialize
  changePercentFromStart: number; // % so với điểm đầu kỳ đang chọn
};

type NavTrendChartProps = {
  period: NavTrendPeriod;
  onPeriodChange: (period: NavTrendPeriod) => void; // client state — KHÔNG phải
  // route riêng (khác rule "tab đổi dữ liệu -> tách route" vì đây là lọc HIỂN
  // THỊ trên 1 khoảng dữ liệu đã tải, giống ô tìm kiếm HoldingSwitcher — cần
  // planner xác nhận nếu muốn tách hẳn 3 route/query param thay vì client state)
  points: NavTrendPoint[]; // rỗng hoặc 1 phần tử = biến thể 6b
  changePercent: number; // badge header, % theo kỳ đang chọn
  hidden?: boolean;
  className?: string;
};
```

### 6b — rỗng (< 2 snapshot)

- Khi `points.length < 2`: khối dashed border thay cho chart, icon `show_chart`,
  tiêu đề "Chưa vẽ được đường NAV", mô tả "Cần ít nhất **2 mốc snapshot** để nối
  thành đường. Hiện mới có **{n}** mốc (hôm nay)." + 1 dòng hiện mốc duy nhất
  đang có (ngày + giá trị). Nút CTA "Chốt số liệu hôm nay" bên dưới — **tái
  dùng hành động của `SnapshotTodayCard`** (không phải nút mới độc lập, nên
  forward `action`/state từ Container xuống, hoặc đơn giản là `Link`/`scrollTo`
  tới `SnapshotTodayCard` đã có sẵn trên Dashboard — cần `design-implementer`
  quyết định cách nối, tránh 2 nút làm cùng 1 việc trùng lặp trên cùng trang).
- Info strip dưới: giải thích cron cuối tháng/năm sẽ tự chốt thêm mốc.

**⚠️ Điểm cần xác nhận — 6b/6c không khớp bố cục 6a/6e:** mockup 6b/6c vẽ một
header khác hẳn ("Chào buổi sáng" / "Giá trị tài sản" làm tiêu đề lớn, không có
NAV hero card/mốc chốt/privacy strip như 6a/6e) — trông giống một bản Dashboard
rút gọn/cũ hơn thay vì đúng `DashboardScreen` hiện tại. Khả năng cao đây là sơ
suất của công cụ thiết kế (dựng biến thể rỗng/tải độc lập, quên đồng bộ chrome
xung quanh) chứ không phải chủ đích ẩn bớt phần trên khi rỗng/tải. Khuyến nghị:
chỉ lấy **nội dung bên trong card chart** (icon, copy, cấu trúc skeleton) từ
6b/6c, giữ nguyên phần còn lại của `DashboardScreen` (header/NAV hero/mốc
chốt/privacy strip) như 6a/6e — `design-implementer` xác nhận lại hướng này
trước khi code.

### 6c — đang tải

- Skeleton **riêng vùng chart** (khớp checklist `component-architecture.md`:
  mỗi Suspense/skeleton phản ánh đúng hình dạng) — 3 dòng skeleton (nhãn nhỏ,
  số lớn, pill %) rồi khối chart skeleton (nền shimmer + đường dashed mờ minh
  hoạ hình dạng chart sắp hiện) + 4 nhãn trục X skeleton. Dòng ghi chú
  "Đang tải chuỗi snapshot… chỉ vùng biểu đồ chờ, phần khác đã hiện." — xác
  nhận **card XIRR/Vốn KHÔNG phải skeleton** trong ảnh này (context row đã
  resolve độc lập) → đúng pattern `Suspense` tách nhỏ theo vùng data
  (`component-architecture.md` checklist #2): `NavTrendChart` cần Suspense
  RIÊNG với `PortfolioStatsRow`/`PnlCostDragCard` (mỗi cái query snapshot khác
  nhau), không gộp chung 1 Suspense với `PortfolioOverviewSection` hiện tại.

```tsx
// NavTrendChartSkeleton.tsx — colocate cùng thư mục NavTrendChart/
// Không nhận props, Server Component thuần (đúng quy ước skeleton).
```

---

## 2. Phân bổ tài sản · donut (6d)

- Mở từ card "Phân bổ theo loại" ở Dashboard (đã có `AllocationBar`, giữ
  nguyên) — bấm vào mở **màn/route riêng** (mockup có `PageHeader` back +
  subtitle "Theo nhóm · % giá trị thị trường", không phải bottom sheet dù
  entry map ghi "chạm để mở" — cần `design-implementer` xác nhận route mới
  (`/allocation`?) hay `Sheet` giống `HoldingSwitcher`; mockup vẽ full-screen
  nên có khả năng là route, không phải sheet).
- Donut chart (conic-gradient trong mockup, thật ra nên dùng Recharts
  `PieChart` với `innerRadius` để có lỗ giữa) — center label 3 dòng: "{n} nhóm"
  / "% chỉ hiện" / "dù đang ẩn tiền" — xác nhận **% phân bổ KHÔNG bị ẩn bởi chế
  độ ẩn số tiền** (đúng quy tắc `component-architecture.md`: "giữ % và số
  lượng", chỉ ẩn tiền VND tuyệt đối). Card có privacy note tường minh nhắc lại
  điều này ở cuối màn.
- Legend: mỗi nhóm 1 dòng (dot màu + nhãn + %) — nhãn "Quỹ" có ghi chú nhỏ
  "· gồm CCQ" (khớp domain rule "CCQ tính là nhóm Quỹ" ở `phase-6.md`).
- **Callout liên kết cảnh báo tập trung** (khớp việc cần làm `phase-6.md` mục
  "Chú thích liên kết trên biểu đồ phân bổ"): box màu hổ phách, icon
  `donut_large`, dòng 1 "{N} mã đang vượt ngưỡng tập trung", dòng 2 chi tiết
  "{symbol} chiếm {percent}% danh mục — xem bảng vị thế bên dưới" + chevron.
  **Lưu ý:** mockup chỉ vẽ ví dụ 1 mã (không rõ format khi N > 1 mã cùng lúc) —
  `phase-6.md`/`docs/domain` mô tả câu chữ dạng tổng quát "N mã đang vượt
  ngưỡng tập trung — xem bảng vị thế bên dưới" (không nêu tên/% cụ thể). Mockup
  làm giàu thêm bằng tên mã + % khi chỉ có đúng 1 mã — cần xác nhận: giữ câu
  chung chung cho mọi N, hay khi N=1 nêu đích danh mã đó (rõ ràng hơn nhưng cần
  quyết định khi N>1 hiển thị sao, ví dụ liệt kê tối đa 2 mã rồi "và N khác").
- Không xuất hiện badge cảnh báo tập trung trực tiếp trên slice donut (theo
  nhóm asset type, không phải theo mã) — cảnh báo là per-`Holding`, hiển thị ở
  bảng vị thế (6j), donut chỉ có callout liên kết.

**Props phác thảo:**

```ts
// src/features/dashboard/components/AllocationScreen/AllocationScreen.tsx (hoặc
// AllocationSheet nếu chốt dùng Sheet thay vì route riêng)
type AllocationDonutSlice = {
  type: AssetType; // từ @/components/AssetTypeBadge
  percent: number; // 0-100, KHÔNG bị ẩn bởi hidden
  note?: string; // "· gồm CCQ" cho FUND
};

type ConcentrationCalloutProps = {
  warningCount: number; // N mã đang vượt ngưỡng
  // Chi tiết mã đầu tiên (nếu chỉ 1 mã) — optional, xem điểm cần xác nhận trên.
  topSymbol?: string;
  topPercent?: number;
  href: string; // xuống bảng vị thế / route holdings
};

type AllocationScreenProps = {
  backHref: string;
  slices: AllocationDonutSlice[];
  concentrationCallout?: ConcentrationCalloutProps; // vắng = ẩn hẳn callout
};
```

---

## 3. Ẩn số tiền toàn app (6e) + toggle Cài đặt (6f)

**Đây là thay đổi hạ tầng lớn nhất Phase 6** — hiện tại `hidden` chỉ là 1 prop
`boolean` truyền tay xuống từng component (`DashboardScreen.hidden`,
`MoneyValue.hidden`...), KHÔNG có state "toàn app" nào cả. `component-architecture.md`
đã ghi trước quy tắc: "Trạng thái ẩn số tiền lấy từ hai nguồn: mặc định từ
`User.hideAmountsByDefault` (đọc phía server) và một client toggle bật/tắt
nhanh (lưu tạm client, vd context/cookie). Container truyền cờ xuống, không để
từng leaf tự đọc." — Phase 6 là lúc hiện thực đúng cơ chế này lần đầu.

- **6e** chỉ là biến thể tương tác của 6a (cùng cấu trúc `DashboardScreen`) —
  bấm nút mắt ở header đổi `state.hidden`, mọi số tiền trên toàn màn (NAV hero,
  chart tooltip/trục, Lãi/lỗ, Vốn đã bỏ ra mua) đổi theo cùng lúc. Đã có nút
  mắt sẵn trong `MoneyValueToggleButton` — component đã có, chỉ thiếu chỗ đặt
  state dùng chung.
- **6f** (Cài đặt): nhóm mới **"Riêng tư"** (label uppercase, khớp style nhóm
  đã thấy — `SettingsScreen` hiện chưa có khái niệm "nhóm", chỉ list phẳng
  `SettingsMenuItem` + card `CutoffPicker` + nút đăng xuất) — 1 card chứa: icon
  tròn (đổi theo trạng thái, cùng `eyeBtnBg`/`eyeBtnColor` với nút header) +
  label "Chế độ ẩn số tiền" + mô tả "Che mọi số tiền VND tuyệt đối · giữ % &
  XIRR" + **toggle switch** bên phải. Dưới card, 1 dòng ghi chú nhỏ (icon
  `sync`): "Cùng một trạng thái với nút mắt ở header Tổng quan — bật ở đâu cũng
  áp cho cả hai. Hiện đang **{ẩn/hiện}**."
- **Atom `Switch` CHƯA có trong kho** (`components/ui/` hiện chỉ có
  button/badge/input/select/avatar/sheet/skeleton/date-picker) — cần dựng mới
  theo đúng convention `component-architecture.md`/`ui-ux-design.md` ("Component
  primitive dựng trên `@base-ui/react`... `cva` cho variants + primitive
  `@base-ui/react/<name>` nếu có subpath tương ứng"). Kiểm tra `@base-ui/react`
  có export `Switch` không trước khi tự vẽ toggle bằng div+button (mockup vẽ
  thủ công bằng `<button>` + `<span>` tròn dịch chuyển `left`, có thể dùng làm
  fallback nếu `@base-ui/react` không có Switch).
- **⚠️ Điểm cần xác nhận — nhóm "Khác" trong 6f có 3 mục không khớp scope
  Phase 6:** "Biểu thuế & phí" (route chưa tồn tại), "Lịch chốt snapshot" (gần
  khớp `SettingsMenuItem` hiện có "Lịch chốt tự động" — có thể chỉ đổi tên?),
  "Đăng xuất" (đã có). Mockup không nhắc gì thêm về "Biểu thuế & phí" ở nơi
  khác trong Phase 6 Screens — nhiều khả năng là mockup tổng hợp cả các mục
  Settings tương lai (ngoài scope, có thể từ ý tưởng Phase 5/7) chứ không phải
  việc cần làm mới của Phase 6. Khuyến nghị: **chỉ thêm nhóm "Riêng tư" + toggle
  mới**, KHÔNG tự thêm "Biểu thuế & phí" (không có route/dữ liệu), giữ nguyên
  "Lịch chốt tự động" đang có (không đổi tên chỉ vì mockup dùng chữ khác) —
  `design-implementer` xác nhận lại nếu muốn đổi.

**Props phác thảo:**

```ts
// Hạ tầng mới — vị trí file do design-implementer/planner quyết định (gợi ý
// src/lib/privacy-context.tsx hoặc src/features/settings/privacy-context.tsx):
// - Server đọc User.hideAmountsByDefault (mặc định ban đầu) qua queries.ts mới.
// - Client Context/cookie giữ override tạm thời trong phiên (nút mắt bấm nhanh
//   không cần ghi DB mỗi lần, khác toggle trong Cài đặt — cần business-implementer
//   xác nhận: nút mắt header chỉ đổi client state hay có persist DB luôn?
//   Mockup 6f caption "Cùng một trạng thái" gợi ý nên dùng CHUNG 1 nguồn, nhưng
//   toggle Cài đặt có thể là nơi DUY NHẤT ghi hideAmountsByDefault xuống DB
//   (persist mặc định cho lần sau), còn nút mắt header chỉ đổi client-side cho
//   phiên hiện tại — 2 tầng khác nhau nhưng cùng hiển thị 1 giá trị hiệu lực.

// src/components/ui/switch.tsx (atom mới)
type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

// src/features/settings/components/PrivacyToggle/PrivacyToggle.tsx (mới, client)
type PrivacyToggleProps = {
  hidden: boolean;
  onToggle: () => void; // hoặc Server Action nếu persist DB trực tiếp
  className?: string;
};
```

---

## 4. Tab "Đã đóng" mở rộng (6g/6h/6i)

Route `/holdings/closed` **đã tồn tại** (`getClosedHoldings()` trả
`HoldingSummary[]` thuần — chỉ `symbol/name/type/unit/quantity/avgCost/
totalCostBasis`, KHÔNG có lãi/lỗ đã chốt, XIRR chốt, hay thời gian giữ). Phase
6 mở rộng dữ liệu này, không phải dựng route mới.

- **Segmented "Đang mở / Đã đóng" cần thêm đếm số lượng** (`HoldingsSegmentedNav`
  hiện chỉ có 2 label tĩnh, mockup 6g/6h hiện "Đang mở · 5" / "Đã đóng · 3") —
  cần thêm prop đếm, 2 route con (layout dùng chung `(overview)`) đều cần biết
  cả 2 số đếm cùng lúc (không chỉ số của tab đang active) để hiện đủ trên
  thanh, nghĩa là `layout.tsx` (chi phối cả 2 route con) cần query đếm cả open
  VÀ closed — đã có `getHoldingsRaw()` cache theo request trả cả 2 mảng, chỉ
  cần lấy `.length` mỗi mảng, không cần query thêm.
- **Realized summary strip** (2 card ngang): "Lãi/lỗ đã chốt" (tổng lãi/lỗ đã
  chốt của MỌI vị thế đã đóng, tôn trọng `hidden`) + "XIRR bình quân" (theo
  năm) — **⚠️ cần business-implementer xác định công thức "bình quân"**: trung
  bình cộng đơn giản theo số vị thế, hay trọng số theo vốn đã bỏ vào từng vị
  thế? `docs/domain/05-returns-xirr-and-pnl.md`/`phase-6.md` không định nghĩa
  sẵn — ghi rõ vào `process/DECISION.md` khi chốt (không tự suy đoán).
- **Mỗi dòng vị thế đã đóng** (khác `HoldingListItem` hiện tại — cần biến thể
  mới hoặc mở rộng props): avatar màu theo dấu lãi/lỗ (KHÁC `SymbolAvatar` mặc
  định hash-theo-mã — ở đây tô theo `gain`/`destructive`), tên + badge trung
  tính "Đã bán hết", dòng phụ "{Loại tài sản} · nắm {N} tháng" (thời gian giữ),
  bên phải: số tiền lãi/lỗ đã chốt (màu theo dấu) + dòng "XIRR {±X%}" — bấm vào
  mở `ClosedPositionSheet` (6i).
- **Footer info strip:** giải thích "vị thế đã đóng" = SL=0, số liệu đã khoá
  tại lần bán cuối, **"không bao giờ có badge cảnh báo tập trung"** — khớp
  tiêu chí `phase-6.md`: "vị thế đóng không bao giờ bị cảnh báo". Đây là
  ràng buộc UI quan trọng: `ConcentrationBadge` (mục 5) chỉ nhận props từ
  Holding ĐANG MỞ, danh sách closed không truyền badge này vào.
- **6h rỗng:** icon `history_toggle_off`, "Chưa có vị thế đã đóng" + mô tả.
  Khác `EmptyState` hiện dùng ở `HoldingsPositionsSection` (icon `Archive`,
  title "Chưa có vị thế nào đã đóng", description "Vị thế đóng khi bạn bán hết
  số lượng đang giữ.") — nội dung tương tự, có thể giữ nguyên `EmptyState` đã
  có (chỉ đổi icon nếu muốn khớp mockup, không bắt buộc).
- **6h đang tải:** 2 skeleton card (summary strip) + 3 skeleton row — khác
  `HoldingsListSkeleton` hiện có (skeleton hiện tại mô phỏng nhóm theo asset
  type, không có summary strip 2 card riêng cho closed). Cần
  `ClosedHoldingsListSkeleton` mới hoặc mở rộng `HoldingsListSkeleton` để nhận
  biến thể `variant: "closed"` có thêm 2 stat card ở đầu.

**Props phác thảo:**

```ts
// src/features/holdings/components/ClosedHoldingRow/ClosedHoldingRow.tsx (mới)
type ClosedHoldingRow = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  holdingPeriodLabel: string; // "nắm 14 tháng" — business-implementer tính từ
  // ngày mua đầu tiên -> ngày bán hết cuối cùng
  realizedPnl: string; // Decimal serialize, có dấu
  realizedPnlPercent: number;
  xirrRealized: XirrResult; // reuse type từ @/components/ReturnMetrics
  detailHref: string; // mở ClosedPositionSheet — hoặc state client nếu Sheet
  // controlled tại chỗ (giống TransactionHoldingPicker) thay vì route
};

type ClosedHoldingsSummary = {
  totalRealizedPnl: string;
  averageXirrRealized: XirrResult; // hoặc number trực tiếp nếu luôn tính được
  // — cần business-implementer xác nhận có thể "không tính được" hay luôn có
};
```

---

## 5. Sheet chi tiết vị thế đã đóng (6i)

Bottom sheet mở từ 1 dòng ở 6g (dùng atom `Sheet` đã có, tiền lệ
`HoldingSwitcher`/`TransactionHoldingPicker`).

- Header: avatar (tô theo dấu, không hash mã) + tên + badge "Đã bán hết" +
  dòng phụ "{Loại} · {mã}".
- **Headline card** (gradient theo màu dấu — xanh khi lãi, tương tự nếu lỗ
  chắc đổi sang đỏ, mockup chỉ vẽ case lãi): "Lãi/lỗ đã chốt" + số tiền lớn +
  % + chip "XIRR chốt {±X%}/năm".
- **Thời gian nắm giữ:** icon `schedule`, label + giá trị "{N} tháng {M}
  ngày" + cột phải "{MM/yyyy} → {MM/yyyy}" (tháng mua đầu → tháng bán hết).
- **Vốn mua vào vs tiền bán ra** (card 3 dòng): "Tổng vốn mua vào · gồm phí
  mua" / "Tổng tiền bán ra · thực nhận" / "Chênh lệch (đã chốt)" (highlight,
  = 2 dòng trên trừ nhau, khớp số ở headline card).
- **Dòng lệnh của mã** (timeline dọc, mirror style `CashflowTimeline` đã có ở
  `HoldingDetailScreen` — kiểm tra component đó trước khi dựng timeline mới,
  có thể tái dùng gần như nguyên): mỗi lệnh = dot (xanh cho BUY, hổ phách cho
  SELL cuối) + nhãn "Mua {SL} CP"/"Bán hết {SL} CP" + ngày + ghi chú giá + %
  phí/thuế áp dụng.
- **Actions:** nút chính "Mở lại vị thế" (icon `add_shopping_cart`, tô
  `accent`) — chỉ mở **form Mua** điền sẵn mã này (`Link` tới
  `ROUTES.newTransaction(holdingId)` với query/param định hướng tab Mua, tương
  tự cách `TransactionHoldingPicker` điều hướng — KHÔNG đụng lịch sử đã chốt,
  chỉ là entry point tiện lợi); nút phụ "Đóng" (đóng sheet). Footnote nhỏ nhắc
  lại "Mở lại vị thế chỉ mở form Mua... không đụng tới lịch sử đã chốt."

**Props phác thảo:**

```ts
// src/features/holdings/components/ClosedPositionSheet/ClosedPositionSheet.tsx
type ClosedPositionOrderEntry = {
  id: string;
  kind: "BUY" | "SELL";
  isFinalSell?: boolean; // true = lệnh bán hết cuối cùng, tô màu khác trong timeline
  label: string; // "Mua 8.000 CP" / "Bán hết 10.000 CP"
  date: string; // dd/MM/yyyy
  note: string; // "giá 18.100 · phí 0,3%" / "giá 19.200 · thuế 0,1% · phí 0,3%"
};

type ClosedPositionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  name: string | null;
  type: AssetType;
  realizedPnl: string;
  realizedPnlPercent: number;
  xirrRealized: XirrResult;
  holdingPeriodLabel: string; // "14 tháng 6 ngày"
  startMonthLabel: string; // "05/2024"
  endMonthLabel: string; // "12/2025"
  totalInvested: string; // gồm phí mua
  totalProceeds: string; // thực nhận (đã trừ phí/thuế bán)
  orders: ClosedPositionOrderEntry[];
  reopenHref: string; // ROUTES.newTransaction(holdingId), hướng tab Mua
  hidden?: boolean;
};
```

---

## 6. Badge cảnh báo tập trung — 4 biến thể (6j)

Không phải màn hình riêng — panel tham khảo liệt kê 4 trạng thái badge, dùng ở
`HoldingListItem`/dòng trong `HoldingsGroupCard`/vị thế trong `AllocationScreen`
callout. Đối chiếu trực tiếp với `phase-6.md` mục "Cảnh báo tập trung" (A2 thu
hẹp 2026-07-21):

| Biến thể mockup | Điều kiện nghiệp vụ (`docs/domain/04-pricing-and-valuation.md`) | Hiển thị |
|---|---|---|
| **1. Bình thường** | `concentrationPercent > threshold` (mặc định `Setting{CONCENTRATION_WARNING_THRESHOLD}=30`, có hysteresis buffer 3 điểm %), `missingPriceShare` toàn danh mục = 0, VÀ số Holding mở có giá đủ nhiều (`100/n ≤ threshold`, không thuộc case "tự nhiên") | Badge tint hổ phách, icon `donut_large`, text "{percent}% danh mục". KHÔNG icon/text cảnh báo nào khác. |
| **2. Kèm ghi chú "tập trung tự nhiên do ít mã"** | `100 / (số Holding mở có giá) > threshold` — mọi badge trong danh mục (kể cả các mã dưới ngưỡng lẽ ra không bị badge? **cần xác nhận**: mockup chỉ vẽ 1 mã có badge — có khả năng ghi chú "tự nhiên" chỉ áp dụng cho các mã ĐÃ có badge (vượt ngưỡng), không tự thêm badge cho mã dưới ngưỡng) | Badge như biến thể 1 + box phụ (icon `info`) "Tập trung tự nhiên do bạn chỉ giữ **{n}** mã — tỷ trọng cao là bình thường với danh mục nhỏ." (n tính động, không hard-code). |
| **3. NAV thiếu một phần** | `missingPriceShare` toàn danh mục `> 0` nhưng `≤ 5%` (A2 thu hẹp) | Badge % có **dấu `~` phía trước** (vd "~36% danh mục") + box phụ (icon `help`) "NAV đang thiếu một phần — **{missingPriceShare}%** tài sản chưa có giá. Tỷ trọng là ước tính (dấu ~)." |
| **4. Treo toàn bộ + banner** | `missingPriceShare` toàn danh mục `> 5%` (A2 thu hẹp) | Badge % **bị thay hoàn toàn** bằng pill trung tính "tạm ẩn" (icon `visibility_off`, không có số %) + banner đỏ nhạt (icon `warning`) "Tạm ẩn cảnh báo tập trung" + "**{missingPriceShare}%** NAV chưa có giá — tỷ trọng có thể sai lệch, nên tạm không hiển thị %. Cập nhật giá để tính lại." Áp dụng cho **MỌI** Holding trong danh mục (biến thể toàn cục, không phải riêng 1 mã), khớp "treo cảnh báo tập trung toàn danh mục" ở `phase-6.md`. |

- Ngôn ngữ **bắt buộc trung tính** — mockup ghi chú tường minh: "không đỏ gắt /
  ngôn ngữ khuyến nghị", chỉ nêu tỷ trọng thực tế. Icon `warning` (biến thể 4)
  là ngoại lệ DUY NHẤT dùng tông đỏ nhạt (vì là banner "thiếu dữ liệu", không
  phải "cảnh báo rủi ro đầu tư").
- **Hysteresis KHÔNG có biến thể UI riêng** — mockup ghi rõ: "chỉ đổi thời
  điểm bật/tắt, không đổi giao diện, nên không vẽ riêng". Số ví dụ mockup dùng
  ("bật ở ~35%, tắt ở ~30%") chỉ minh hoạ, KHÔNG phải giá trị thật (`phase-6.md`
  chốt `threshold=30`, buffer 3 điểm % → tắt dưới 27) — không lấy số từ mockup.

**Props phác thảo:**

```ts
// src/components/ConcentrationBadge/ConcentrationBadge.tsx (mới — đặt ở
// components/ chung vì dùng cả HoldingListItem, HoldingsGroupCard,
// AllocationScreen callout, không riêng 1 feature)
type ConcentrationBadgeState =
  | { kind: "NORMAL"; percent: number }
  | { kind: "NATURAL_CONCENTRATION"; percent: number; holdingCount: number }
  | { kind: "PARTIAL_NAV"; percent: number; missingPriceSharePercent: number }
  | { kind: "SUPPRESSED"; missingPriceSharePercent: number };

type ConcentrationBadgeProps = {
  state: ConcentrationBadgeState;
  className?: string;
};
```

---

## Component/atom có thể tái dùng

| Có sẵn | Dùng lại cho |
|---|---|
| `AllocationBar` | Giữ nguyên ở Dashboard (thanh ngang) — donut (6d) là component MỚI riêng cho màn chi tiết, không thay thế `AllocationBar` |
| `MoneyValue`/`MoneyValueToggleButton` | Nút mắt header (6e) — đã có sẵn cơ chế hiển thị + toggle, chỉ thiếu state "toàn app" |
| `ReturnMetrics` (export `XirrResult`) | Tái dùng type `XirrResult` cho XIRR chốt (6g/6i), không cần định nghĩa lại union |
| `Sheet` (`components/ui/sheet.tsx`) | `ClosedPositionSheet` (6i) — mirror `HoldingSwitcher`/`TransactionHoldingPicker` |
| `CashflowTimeline` (`features/holdings/components/CashflowTimeline`) | Kiểm tra trước khi dựng "Dòng lệnh của mã" (6i) — có thể tái dùng gần nguyên hoặc mở rộng props thay vì viết timeline mới |
| `EmptyState` | 6h rỗng — nội dung hiện có đã gần khớp mockup, cân nhắc chỉ đổi icon |
| `HoldingsListSkeleton` | 6h đang tải — cần mở rộng thêm 2 stat-card skeleton phía trên, không viết lại từ đầu |
| `SegmentedControl` | Period Tháng/Năm/Tất cả (6a) — atom đã hỗ trợ `stretch`/`thumbClassName`, dùng thẳng được |
| `AssetTypeBadge` (export `ASSET_TYPE_LABEL`, `ASSET_TYPE_TINT_CLASS`...) | Donut slices (6d), avatar tint theo loại |
| `HoldingsSegmentedNav` | Cần SỬA (thêm prop đếm số lượng mỗi tab) — không phải component mới |
| `SettingsMenuItem` | KHÔNG dùng cho toggle riêng tư (6f) — đó là hàng có switch, khác pattern link+chevron của `SettingsMenuItem` |

**Cần dựng mới:** `NavTrendChart` (+ `NavTrendChartSkeleton`), `AllocationScreen`
(hoặc `AllocationSheet`), `PrivacyToggle`, `ClosedHoldingRow`, `ClosedPositionSheet`,
`ConcentrationBadge`, atom `components/ui/switch.tsx`, hạ tầng state "ẩn số
tiền toàn app" (context/cookie — chưa tồn tại).

**Icon mapping mới cần bổ sung vào `docs/rules/ui-ux-design.md`** (kiểm tra
trùng trước khi thêm — vài icon Phase 5 có thể đã đủ):

| Material Symbols (mockup) | lucide-react gợi ý |
|---|---|
| `show_chart` | `LineChart` (6b, chart rỗng) |
| `event` | đã có `Calendar` (Phase 4) |
| `donut_large` | `PieChart` hoặc `ChartPie` (6d/6j — badge tập trung + donut) |
| `history_toggle_off` | `HistoryIcon`/`Undo2`? cần chọn icon lucide gần nghĩa nhất (6h rỗng) |
| `schedule` | đã có `Clock` (Phase 2) |
| `add_shopping_cart` | `ShoppingCart` (6i, nút "Mở lại vị thế") |
| `hourglass_top` | `Hourglass` (6c/6h skeleton note) |
| `rule` | `Ruler`? hoặc `ListChecks` — chỉ dùng trong panel tham khảo 6j, có thể không cần đưa vào UI thật |
| `tune` | `SlidersHorizontal` — đã dùng ở `DashboardScreen` (nút mốc chốt) |
| `touch_app` | `Pointer` hoặc `Hand` (chart privacy note) |

---

## Điểm lệch/cần xác nhận (tổng hợp)

1. **6b/6c dùng bố cục Dashboard khác 6a/6e** (thiếu NAV hero/mốc chốt/privacy
   strip) — khả năng sơ suất mockup, khuyến nghị chỉ lấy nội dung card chart,
   giữ nguyên phần còn lại của `DashboardScreen` (mục 1).
2. **Mockup minh hoạ ẩn số tiền bằng CSS `filter: blur()`** — khác pattern
   `formatMoney(value, {hidden}) → "••••••"` đã dùng toàn app. Khuyến nghị GIỮ
   pattern bullet cũ (nhất quán, dễ test), không tự đổi sang blur chỉ vì mockup
   vẽ vậy (mục 1, 3).
3. **Nút mắt header vs toggle Cài đặt — quan hệ client state ↔ persist DB
   chưa rõ**: bấm nút mắt có ghi `User.hideAmountsByDefault` ngay không, hay
   chỉ đổi phiên hiện tại còn toggle Cài đặt mới là nơi persist? Cần
   business-implementer/planner chốt kiến trúc trước khi code (mục 3).
4. **6f nhóm "Khác" có mục "Biểu thuế & phí" ngoài scope** — không có route/dữ
   liệu tương ứng trong Phase 6 (hoặc phase nào trước đó); khuyến nghị KHÔNG
   thêm, chỉ dựng nhóm "Riêng tư" (mục 3).
5. **"XIRR bình quân" của vị thế đã đóng (6g) chưa có định nghĩa công thức** —
   trung bình đơn giản hay trọng số theo vốn? Cần chốt + ghi `DECISION.md`
   (mục 4).
6. **Callout liên kết cảnh báo tập trung (6d) nêu đích danh mã khi N=1** —
   `phase-6.md` chỉ định nghĩa câu chữ tổng quát "N mã...". Cần xác nhận có
   giữ chi tiết tên mã/% như mockup hay dùng câu chung cho mọi N (mục 2).
7. **Biến thể 2 (badge 6j) áp dụng cho mã nào** — chỉ áp thêm ghi chú cho các
   mã ĐÃ có badge (vượt ngưỡng), hay hiện badge cho MỌI Holding khi rơi vào
   case "tự nhiên"? Mockup chỉ vẽ 1 ví dụ, không đủ để suy luận chắc chắn (mục
   6).
8. **Route/cơ chế mở màn Phân bổ chi tiết (6d)** — route riêng hay `Sheet`?
   Mockup vẽ full-screen với back button (giống route), nhưng entry map dùng
   từ "chạm để mở" (trung tính, có thể là sheet). Cần `design-implementer`
   chốt (mục 2).
9. **`add_shopping_cart` "Mở lại vị thế" (6i) trỏ tới `TransactionForm` tab
   nào** — cần cơ chế chọn tab Mua mặc định qua query param hoặc props (form
   hiện tại có `SegmentedControl` Mua/Bán, tab mặc định hiện tại là gì? kiểm
   tra `TransactionForm.tsx` trước khi wiring) (mục 5).

## File nguồn

- `Phase 6 Screens.dc.html` (project `fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) →
  cache `.claude/design-cache/raw/Phase-6-Screens.dc.html`.
