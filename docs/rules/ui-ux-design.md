# UI/UX design

Quy tắc giao diện cho Navtrack: theme màu, typography, icon, và kho atoms/molecules đã dựng sẵn. Nguồn gốc: Design System (Claude Design project) — dark mode, mobile-first, dữ liệu tài chính (xanh = lãi, đỏ = lỗ). Đọc cùng [`component-architecture.md`](./component-architecture.md) (cấu trúc/pattern component) — file này chỉ nói về **giá trị thiết kế** (màu, chữ, icon) và **kho component đã có**, không lặp lại quy tắc cấu trúc.

## Theme & màu sắc

- App **dark mode mặc định, cố định** — class `dark` gắn cứng trên `<html>` (`src/app/layout.tsx`), **chưa có** theme switcher. `:root` (light) giữ nguyên giá trị scaffold shadcn, chưa có mockup light để đối chiếu — đừng tự chế giá trị light cho token mới khi chưa có thiết kế.
- Toàn bộ giá trị màu khai ở CSS variable trong `src/app/globals.css` (`.dark { ... }` + mapping `@theme inline`). **Luôn dùng Tailwind utility ánh xạ token** (`bg-primary`, `text-gain`, `border-border`...), **không hardcode hex** trong component.

```tsx
// ❌ Bad — hardcode hex
<div style={{ color: "#35d07f" }}>+16,9%</div>

// ✅ Good — qua token
<div className="text-gain">+16,9%</div>
```

| Nhóm | Token | Ý nghĩa |
|---|---|---|
| Bề mặt | `background`, `card`, `card-elevated`, `muted`, `border`/`input` | Nền, thẻ, thẻ nổi (popover), viền |
| Chữ | `foreground`, `foreground-soft`, `muted-foreground`, `muted-faint` | 4 mức độ tương phản, từ chữ chính tới chữ mờ nhất |
| Thương hiệu | `primary` (indigo), `accent` (teal), `secondary` (`#242938` — nút Secondary/IconButton nền/SegmentedControl track) | Màu thương hiệu, không phải ngữ nghĩa lãi/lỗ |
| Ngữ nghĩa | `gain` (lãi ▲, xanh), `destructive` (dùng chung cho **loss**/lỗ ▼, đỏ), `warning` (amber — nguồn giá "Nhập tay", thiếu giá, "không tính được XIRR", giá cũ) | **Không có token `loss` riêng** — mockup dùng cùng 1 hex cho destructive và loss. `warning` trùng hex với `asset-gold` một cách ngẫu nhiên (không phải alias — Phase 2, xem `globals.css`) |
| Phân bổ tài sản | `asset-stock`, `asset-fund`, `asset-bond`, `asset-gold` | Màu cố định cho biểu đồ/badge loại tài sản — token riêng, độc lập với `primary`/`accent` dù trùng giá trị (có thể lệch màu brand sau này) |

- `gain`/`asset-*`/`foreground-soft`/`muted-faint`/`card-elevated` là **mở rộng riêng của Navtrack**, không thuộc bộ token chuẩn shadcn — khi thêm token mới tương tự, khai ở `.dark` trong `globals.css` **và** map qua `@theme inline` để Tailwind sinh utility.
- Quy ước lãi/lỗ: **luôn xanh (`gain`) = lãi, đỏ (`destructive`) = lỗ** — không đảo màu, không dùng màu khác cho hai trạng thái này ở bất kỳ đâu trong app.

## Typography

- **IBM Plex Sans** (400/500/600/700) cho chữ thường; **IBM Plex Mono** (400/500/600) cho **mọi con số** — tiền, phần trăm, số lượng cổ phần/chứng chỉ quỹ. Load qua `next/font/google` trong `src/app/layout.tsx`, subset bắt buộc gồm `"vietnamese"` (app toàn tiếng Việt có dấu).
- Số đều cột: mọi chỗ hiển thị số phải có class `font-mono tabular-nums`.

```tsx
// ❌ Bad — số dùng font thường, lệch cột khi liệt kê danh sách
<span>{formatMoney(value)}</span>

// ✅ Good
<span className="font-mono tabular-nums">{formatMoney(value)}</span>
```

## Icon

- Dùng **`lucide-react`** cho toàn bộ icon (khớp `components.json` → `iconLibrary: "lucide"`), **kể cả khi mockup gốc dùng Material Symbols** — ưu tiên nhất quán với convention sẵn có của repo hơn đúng tuyệt đối icon font trong mockup. Map tên Material Symbols → lucide tương đương khi hiện thực từ mockup mới, ví dụ:

| Material Symbols (mockup) | lucide-react |
|---|---|
| `trending_up` / `trending_down` | `TrendingUp` / `TrendingDown` |
| `visibility` / `visibility_off` | `Eye` / `EyeOff` |
| `error` | `AlertTriangle` |
| `info` | `Info` |
| `receipt_long` | `ReceiptText` |
| `account_balance_wallet` | `Wallet` |
| `inventory_2` | `Archive` |
| `add` | `Plus` |
| `arrow_back` / `close` | `ArrowLeft` / `X` |
| `lock` | `Lock` |
| `logout` | `LogOut` |
| `ac_unit` | `Snowflake` |
| `bolt` | `Zap` |
| `south_west` / `north_east` | `ArrowDownLeft` / `ArrowUpRight` |
| `history` | `History` |
| `schedule` | `Clock` |
| `calendar_view_month` | `CalendarRange` |
| `event_available` | `CalendarCheck2` |
| `verified` | `ShieldCheck` |

## Primitives

- Component primitive (button, input, avatar...) dựng trên **`@base-ui/react`** (không phải Radix) — xem `src/components/ui/button.tsx` làm mẫu tham chiếu khi thêm atom mới: `cva` cho variants + primitive `@base-ui/react/<name>` (nếu có subpath tương ứng) + `cn` từ `@/lib/utils`.
- Tailwind **v4**: không có `tailwind.config.*` riêng — toàn bộ token/theme khai qua CSS (`@theme inline`, `.dark { ... }`) trong `globals.css`.

## Kho atoms & molecules đã có

Tái dùng trước khi tạo mới trùng lặp. Cấu trúc/pattern (thư mục, Props, Server/Client) theo [`component-architecture.md`](./component-architecture.md).

**Atoms** (`src/components/ui/`, kebab-case, không sửa trực tiếp — muốn tuỳ biến thì bọc lại):

| Atom | Ghi chú |
|---|---|
| `button.tsx` | variants: default/secondary/ghost/destructive/outline/link |
| `badge.tsx` | variants: default/gain/destructive/warning/neutral/accent (dạng "tint": `bg-{color}/14` + `text-{color}`) — `accent` (teal, token `--accent`) dùng cho "CUỐI NĂM" (khác `default` = primary/indigo, dùng cho "ĐỊNH KỲ") |
| `input.tsx` | bọc `@base-ui/react/input` |
| `select.tsx` | **native `<select>`** styled + icon `ChevronDown` (không dùng `@base-ui/react/select` — listbox tuỳ biến quá nặng cho nhu cầu hiện tại); giữ form semantics `name`/`value` |
| `avatar.tsx` | bọc `@base-ui/react/avatar`; **vuông bo góc** (`rounded-md`), không tròn |
| `sheet.tsx` | Bottom sheet — bọc `@base-ui/react/dialog` (`Root/Trigger/Portal/Backdrop/Popup/Close`, Portal+Backdrop lồng sẵn trong `SheetPopup`); `rounded-t-3xl`, backdrop mờ đen; animation qua `data-open`/`data-closed` (Base UI tự gắn, đúng cặp key cho keyframe animation của tw-animate-css — khác `data-starting-style`/`data-ending-style` vốn dành cho CSS transition thuần) |
| `skeleton.tsx` | `animate-pulse bg-muted`, dùng cho `Suspense`/`loading.tsx` fallback — quy tắc bắt buộc về loading/skeleton (checklist page, naming `ComponentNameSkeleton`, colocation) xem [`component-architecture.md`](./component-architecture.md#quy-tắc-bắt-buộc-khi-thêmsửa-page-checklist) |

**Molecules** (`src/components/<Name>/`, dùng chung nhiều feature):

| Molecule | Mô tả |
|---|---|
| `Logo` (`LogoMark` + `Logo`) | Mark thương hiệu (gradient hardcode, không qua token — brand cố định không đổi theo theme) + lockup ngang/dọc. Icon PWA (`public/icons/*.png`, xem [`04-tech-stack.md`](../04-tech-stack.md#pwa-cài-lên-màn-hình-chính)) vẽ lại đúng mark này — đổi màu/hình ở `LogoMark.tsx` thì chạy lại `pnpm icons:generate` để đồng bộ |
| `MoneyValue` | Hiển thị tiền VND, có cờ `hidden` (ẩn số tuyệt đối, xem quy tắc ẩn tiền ở `component-architecture.md`), toggle icon con mắt tách client leaf riêng (`MoneyValueToggleButton`, không export ra ngoài) |
| `PercentChange` | Pill %, `variant: "gain-loss"` (xanh/đỏ theo dấu) hoặc `"xirr"` (luôn `primary`, hậu tố "/năm") |
| `AssetTypeBadge` | Pill tint theo màu asset (nền `asset-*` mờ + chữ màu asset, mockup 2d) + chấm màu; nguồn tạm cho union `AssetType` (thay bằng enum Prisma khi Phase 1 có schema thật) |
| `SymbolAvatar` | Avatar chữ viết tắt mã, màu suy ra từ hash(mã) — khớp quyết định ở [`04-tech-stack.md`](../04-tech-stack.md) (không dùng logo ảnh) |
| `UserAvatar` | Avatar initials người dùng/thành viên (bo `30%`, nền gradient secondary→card) — suy initials từ tên hoặc email |
| `PageHeader` | Thanh đầu trang: nút back (`variant: "back"`) hoặc close (`"close"`) + tiêu đề render bằng `h1` + `trailing?: ReactNode` (composition slot bên phải, vd Badge "Chỉ xem" — mockup 3e) |
| `SegmentedControl` | Control pill trượt nền, controlled (`value`/`onChange`) — không tự giữ state; hỗ trợ `stretch` (full width), `thumbClassName` (đổi màu thumb, vd Mua/Bán → `gain`/`destructive`), `activeClassName` per-option |
| `StatCard` | Label + `MoneyValue` + `PercentChange` + `note?` (ghi chú mờ dưới giá trị) |
| `HoldingListItem` | Dòng danh mục: `SymbolAvatar` + `AssetTypeBadge` + `MoneyValue` + `PercentChange` |
| `EmptyState` | Icon tròn + tiêu đề + mô tả + `action?: ReactNode` (composition slot, giữ Server Component thuần) |
| `Alert` | 2 biến thể `info`/`error` |
| `SettingsMenuItem` | Dòng menu điều hướng cho màn Cài đặt: icon + nhãn + chevron, dùng chung cho mọi mục settings (`/settings`) |
| `BottomNav` | Thanh điều hướng cố định đáy (Phase 2): Tổng quan/Danh mục/Cài đặt — nhận `active` tường minh (không tự suy pathname), chỉ gắn ở 3 màn gốc/tab |
| `ReturnMetrics` | Cặp thẻ XIRR (theo năm) + Lãi/lỗ tuyệt đối song song (Phase 2) — thẻ XIRR tự chuyển "Chưa tính được" khi status khác `"OK"` (không bao giờ render số/NaN/-100%), dùng ở Dashboard và chi tiết vị thế |
| `PriceSourceBadge` | Badge nguồn giá "Tự động"/"Nhập tay" (Phase 2) — dùng ở nhóm danh mục, NAV chi tiết vị thế |

## Chuyển động (animation)

- Dùng **tw-animate-css** (đã import trong `globals.css`) — không thêm thư viện animation khác.
- **Entrance của trang:** `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300` trên wrapper nội dung. **Luôn prefix `motion-safe:`** để tôn trọng `prefers-reduced-motion`.
- **Vùng xuất hiện có điều kiện** (info box, alert...): cùng pattern nhưng `slide-in-from-bottom-1 duration-200` — nhỏ và nhanh hơn entrance trang.
- **Đổi tab:** re-mount nội dung bằng `key={tab}` để animation chạy lại (xem `HoldingsTabs`).
- **Micro-interaction:** hover/active dùng `transition-*` (FAB `hover:scale-105 active:scale-95`, thumb `SegmentedControl` trượt bằng `transition-[left]`); chỉ fade/slide/scale nhẹ, không bounce/spin.

## Cập nhật thiết kế về sau

Khi thiết kế trên design tool thay đổi (thêm màu, component mới...), đồng bộ lại **cả** `src/app/globals.css` (token) **và** file này (bảng token/kho component) trong cùng lần thay đổi — theo quy tắc đồng bộ tài liệu ở [`CLAUDE.md`](../../CLAUDE.md).
