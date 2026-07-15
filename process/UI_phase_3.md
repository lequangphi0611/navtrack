# Phase 3 — UI/Presentational layer (design-implementer, issue #35)

Deliverable của agent `design-implementer` cho issue #35 ("Chốt số liệu hôm
nay" — Phase 3). **Chỉ Presentational** — không business logic, không
`queries.ts`, không Server Action thật, không sửa `lib/xirr.ts`/Prisma. Mọi
Props dưới đây là **hợp đồng** mà `business-implementer` (issue #37) cần khớp
khi wiring dữ liệu thật.

Mockup nguồn: Claude Design project "Web app design mobile first"
(`fe49dcd9-ecf0-40d0-8a62-10ca28ff572f`) → `Phase 3 Screens.dc.html`, màn
**3b "Chốt số liệu hôm nay (MANUAL)"**. Mockup 3b vẽ CTA này ở màn **"Lịch sử
NAV · snapshot" (3a)** — một màn hình chưa tồn tại trong app (chuỗi lịch sử
snapshot thuộc phạm vi khác, chưa có route) — dưới dạng bottom sheet xác nhận
đầy đủ (preview breakdown theo 4 nhóm tài sản, nút Hủy/Đóng băng riêng). Theo
plan đã duyệt, issue #35 đặt CTA này trực tiếp trên **Dashboard** (route `/`
đã wiring thật) dưới dạng **card inline gọn** (không phải bottom sheet, không
breakdown theo nhóm) — lý do: gắn trực tiếp với NAV "hôm nay" đang hiển thị
ngay phía trên; Settings có `CutoffPicker` mang ý nghĩa khác (chọn mốc để xem,
không phải hành động ghi dữ liệu) và không hiển thị NAV nên thiếu ngữ cảnh.
Đây là quyết định thiết kế **cố ý khác mockup 3b** (đơn giản hoá theo phạm vi
thật của issue #35), không phải bỏ sót.

**Cập nhật (issue #35 — 6 màn Phase 3 Screens):** mockup đầy đủ 3a-3f nay đã có,
issue #35 mở rộng scope để bao phủ toàn bộ. Phần dưới đây (mục 2-7) là bản ghi
cho các màn mới; mục 1 (`SnapshotTodayCard`) giữ nguyên từ bản gốc.

## Tóm tắt trạng thái wiring

| Component | Route | Trạng thái wiring |
|---|---|---|
| `SnapshotTodayCard` | Dashboard (`/`, route đã wiring thật) | Khung đã có, `snapshotToday` chưa được Container cấp — ẩn mặc định |
| `SnapshotHistoryScreen` | `/snapshots` (mới) | `page.tsx` hardcode sample data — chờ `getSnapshotHistory()` + `createManualSnapshot()` thật |
| `SnapshotDetailScreen` | `/snapshots/[id]` (mới) | `page.tsx` hardcode sample data theo `id` — chờ `getSnapshotDetail(id)` thật |
| `TransactionSnapshotBanner` | Mở rộng `HoldingDetailScreen` (`/holdings/[id]`, route đã wiring thật) | Khung đã có, `justRecorded` chưa được Container cấp — ẩn mặc định; cách biết "vừa giao dịch xong" (query param? cookie?) để lại cho business-implementer |
| `SnapshotScheduleScreen` | `/settings/snapshot-schedule` (mới) | Nội dung tĩnh, không query — render thẳng, không cần wiring thêm |
| Entry point "Lịch sử NAV" | `DashboardScreen` (`/`, route đã wiring thật) | `Link` tĩnh, luôn hiện — không phụ thuộc dữ liệu Container |

---

## 1. SnapshotTodayCard (mới)

- File: `src/features/dashboard/components/SnapshotTodayCard/{SnapshotTodayCard.tsx,index.ts}`
- Client component (`"use client"`), dùng `useActionState` — cùng pattern
  `NavOverrideForm` (`src/features/holdings/components/NavOverrideForm/NavOverrideForm.tsx`).
- Tái dùng `Button`, `Alert` (variant `error`), `Badge` (variant `gain`,
  `bg-gain/14 text-gain` đã có sẵn) — không tạo atom mới, không thêm toast
  library.

```ts
// src/features/dashboard/types.ts
export type SnapshotTodayState =
  | { ok: true; snapshotAt: string } // "15:42" — HH:mm giờ VN
  | { ok: false; error: string }
  | null;

// SnapshotTodayCard.tsx
type SnapshotTodayCardProps = {
  alreadySnapshotToday: boolean;
  snapshotTakenAt?: string; // "09:14", có mặt khi alreadySnapshotToday = true
  action: (
    prevState: SnapshotTodayState,
    formData: FormData,
  ) => Promise<SnapshotTodayState>;
  className?: string;
};
```

### 5 biến thể trạng thái

| Trạng thái | Điều kiện | Hiển thị |
|---|---|---|
| idle | `!alreadySnapshotToday`, chưa submit | Card `border-border bg-card rounded-2xl`, tiêu đề "Chốt số liệu hôm nay", mô tả 1 dòng, `Button` "Chốt ngay" (icon `Snowflake`) |
| loading | `isPending` | Button `disabled`, label "Đang chốt…" — không icon xoay/`animate-spin` |
| success | `state?.ok === true` | Badge `gain` + `CheckCircle2`: "Đã chốt lúc {state.snapshotAt}", ẩn Button |
| đã chốt hôm nay rồi | `alreadySnapshotToday === true` (server truth) | Gộp chung nhánh render với success qua `isDone = alreadySnapshotToday \|\| state?.ok === true`, giờ hiển thị `takenAt = state?.ok ? state.snapshotAt : snapshotTakenAt` |
| error | `state?.ok === false` | `<Alert variant="error" title="Không chốt được" description={state.error} />` hiện dưới Button, Button quay lại idle (không disable) |

### Sample data tự kiểm

```ts
// idle
{ alreadySnapshotToday: false, action: async () => ({ ok: true, snapshotAt: "15:42" }) }
// đã chốt hôm nay rồi
{ alreadySnapshotToday: true, snapshotTakenAt: "09:14", action: async () => ({ ok: true, snapshotAt: "09:14" }) }
// error demo
{ alreadySnapshotToday: false, action: async () => ({ ok: false, error: "Không thể chốt số liệu lúc này, thử lại sau." }) }
```

Đã kiểm bằng cách gán từng bộ props này vào `SnapshotToday` demo cục bộ (không
commit vào repo, theo rule `testing.md` — component Presentational không viết
test render) và chạy `pnpm typecheck` để xác nhận Props khớp shape khai báo;
logic 5 nhánh đọc lại thủ công theo bảng trên khớp với code
`SnapshotTodayCard.tsx` (nhánh `isDone`/`takenAt`/`state`).

### Sửa `DashboardScreen`

- File: `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx`
- Thêm prop optional `snapshotToday?: SnapshotTodayCardProps` vào
  `DashboardScreenProps`.
- Render `{snapshotToday ? <SnapshotTodayCard {...snapshotToday} /> : null}`
  ngay sau khối NAV card ("Giá trị thị trường (NAV)"), trước `<ReturnMetrics
  ... />`.
- **Không sửa** `src/app/(dashboard)/page.tsx` — `valuation` (từ
  `getPortfolioValuation()`) hiện không có field `snapshotToday` nên prop tự
  vắng mặt, card tự ẩn; route tiếp tục hoạt động đúng như trước.

---

## 2. Atom/token dùng chung (issue #35)

- `src/components/ui/badge.tsx`: thêm variant `accent` (`bg-accent/14
  text-accent`, teal thật — khác `default` = primary/indigo) cho badge "CUỐI
  NĂM".
- `src/components/ui/sheet.tsx` (**mới**): atom bottom sheet bọc
  `@base-ui/react/dialog` (`Sheet`/`SheetTrigger`/`SheetPopup`/`SheetClose` —
  Portal+Backdrop lồng sẵn trong `SheetPopup`). Animation dựa vào
  `data-open`/`data-closed` mà Base UI tự gắn (đúng cặp key cho animation dạng
  keyframe của tw-animate-css, khác `data-starting-style`/`data-ending-style`
  vốn dành cho CSS transition).
- `src/components/PageHeader/PageHeader.tsx`: thêm prop optional
  `trailing?: ReactNode` (composition slot bên phải tiêu đề, backward-compatible
  — không đổi call site cũ nào).
- `src/lib/routes.ts`: thêm `snapshots`, `snapshotDetail(id)`,
  `snapshotSchedule`.
- **Di chuyển type dùng chung:** `SnapshotTodayState` chuyển từ
  `src/features/dashboard/types.ts` (đã xoá file, chỉ có định nghĩa này) sang
  `src/features/snapshots/types.ts` (mới) — vì giờ cả `SnapshotTodayCard`
  (Dashboard) và `SnapshotFreezeSheet` (Lịch sử NAV) cùng gọi 1 Server Action
  `createManualSnapshot()`. `SnapshotTodayCard.tsx` đổi import sang
  `@/features/snapshots/types`.

## 3. 3a — Lịch sử NAV · chuỗi snapshot (route mới: `/snapshots`)

- `src/features/snapshots/components/NavHistoryChart` — mini bar chart 8 cột
  (Server Component thuần, CSS bar qua inline `style={{height}}` — cùng pattern
  `AllocationBar`), cột cuối (`isLive`) tô sọc chéo bằng `color-mix(in
  oklch,var(--accent)...)` thay vì hardcode hex.
- `src/features/snapshots/components/SnapshotHistoryList` — danh sách "Các mốc
  đã chốt", dòng đầu luôn `kind: "live"` (không có `href`, không phải Link).
  Badge biến thể `default`/`warning`/`accent` map tương ứng "ĐỊNH KỲ"/"GIAO
  DỊCH"/"CUỐI NĂM".
- `src/features/snapshots/components/SnapshotFreezeSheet` (3b, chuyển vào màn
  Lịch sử NAV theo mockup gốc — khác quyết định ban đầu của issue #35 rút gọn
  trên Dashboard) — client component tự chứa `SheetTrigger` + `SheetPopup`,
  dùng `useActionState` với `SnapshotTodayState` dùng chung, gọi cùng 1 Server
  Action `createManualSnapshot()` như `SnapshotTodayCard`.
- `src/features/snapshots/components/SnapshotHistoryScreen` — organism gộp
  `PageHeader` + `NavHistoryChart` + `SnapshotFreezeSheet` + `SnapshotHistoryList`.
- `src/app/(dashboard)/snapshots/page.tsx` — hardcode sample data, comment
  `// TODO(business-implementer): thay bằng getSnapshotHistory() thật`.

## 4. 3c + 3f — Chi tiết snapshot đã đóng băng (route mới: `/snapshots/[id]`)

- `src/features/snapshots/components/SnapshotDetailScreen` — **một** component
  dùng chung cho cả 3c (giá EOD chưa đổi từ lúc chốt) và 3f (giá đã đổi), chỉ
  khác nhau ở prop optional `recomputedComparison` (vắng mặt = 3c thuần, có mặt
  = 3f với khối so sánh frozen-vs-recompute + banner xanh "giữ nguyên"). Card
  "Vì sao đóng băng?" luôn hiện ở cả 2 biến thể; banner info trung tính (giá
  EOD không đổi) chỉ hiện khi KHÔNG có so sánh (tránh lặp ý với banner xanh).
- **Sửa nhãn theo đúng model thật** (mockup 3c vẽ sai): ô "Nguồn" hiện
  `Snapshot.source` (`AUTO`/`MANUAL`), ô "Chu kỳ" hiện `Snapshot.period`
  (`PERIODIC`/`YEAR_END`/`MANUAL`) — mockup gán nhãn "Nguồn: PERIODIC" và "Chu
  kỳ: MONTH" (MONTH không tồn tại trong enum), nhầm lẫn 2 field khác nhau (xem
  `docs/domain/06-snapshots.md`).
- Reuse `SymbolAvatar` (prop `colorClassName` override) + `ASSET_TYPE_TINT_CLASS`
  (từ `AssetTypeBadge`) cho từng dòng vị thế thay vì dựng avatar mới.
- `src/app/(dashboard)/snapshots/[id]/page.tsx` — `params: Promise<{ id: string
  }>` (convention Next 16, xem `holdings/[id]/page.tsx`), hardcode sample data;
  demo cả 2 biến thể qua 1 id đặc biệt (`snap-2026-06-repriced` → 3f, mọi id
  khác → 3c) vì đây là CÙNG một snapshot thật, chỉ khác việc so sánh giá hiện
  tại có lệch hay không (server quyết định, không phải 2 loại snapshot).

## 5. 3d — Tự động chốt khi giao dịch (KHÔNG route riêng)

- `src/features/holdings/components/TransactionSnapshotBanner` (mới) — toast
  thành công + card giao dịch vừa ghi (tái dùng đúng ngôn ngữ màu BUY=đỏ/
  ArrowDownLeft, SELL=xanh/ArrowUpRight của `CashflowTimeline` đã có, không tự
  chế màu mới) + card snapshot tự động + ghi chú + nút "Xem lịch sử NAV".
- `HoldingDetailScreen.tsx` — thêm prop optional
  `justRecorded?: TransactionSnapshotBannerProps`, render ngay dưới
  `<PageHeader>`, vắng mặt = ẩn (cùng pattern `valuation`/`snapshotToday`).
- **Không sửa** `page.tsx`/`TransactionForm.tsx`/`actions.ts` — cách truyền cờ
  "vừa giao dịch xong" (query param? cookie? trường tạm trong session?) vào
  route thật `/holdings/[id]` để lại cho business-implementer.

## 6. 3e — Cài đặt · Lịch chốt tự động, chỉ xem (route mới: `/settings/snapshot-schedule`)

- `src/features/settings/components/SnapshotScheduleScreen` (mới) — nội dung
  **tĩnh**, không query: 2 card cadence (Hàng tháng/PERIODIC, Chốt cuối
  năm/YEAR_END, cả 2 "ĐANG ÁP DỤNG") + card cron + ghi chú. Badge "Chỉ xem" qua
  prop `trailing` mới của `PageHeader`. Không có `BottomNav` (drill-down
  subpage của Cài đặt, đúng tiền lệ `/settings/members`).
- **Sửa cron so với mockup:** card "Lịch cron trong workflow" chỉ **MỘT dòng**
  `0 0 1 * *` (đã xác nhận từ `.github/workflows/snapshot-cron.yml`, chỉ đọc
  không sửa) — mockup 3e vẽ sai 2 dòng cron riêng cho tháng/năm, trong khi
  workflow chỉ chạy 1 lần/tháng (luôn ghi `PERIODIC`, riêng tháng 1 ghi thêm
  `YEAR_END`, không phải 2 lịch khác nhau).
- `src/app/(dashboard)/settings/snapshot-schedule/page.tsx` — render thẳng,
  không query.
- `SettingsScreen.tsx` — thêm `SettingsMenuItem` "Lịch chốt tự động" (icon
  `History`) cùng nhóm "Thành viên".

## 7. Entry point Dashboard (sửa `DashboardScreen`)

- `DashboardScreen.tsx` — thêm `Link` tĩnh tới `ROUTES.snapshots` ("Lịch sử
  NAV", icon `History` + `ChevronRight`) ngay sau khối NAV hero card, trước
  `SnapshotTodayCard` — cùng ngôn ngữ thị giác với chip "Mốc chốt" phía trên.
  Luôn hiện (không phụ thuộc dữ liệu Container).
- `DashboardScreenSkeleton.tsx` — thêm 1 dòng `Skeleton` khớp hình dạng Link
  mới (tránh giật layout).

---

## Query/Server Action business-implementer cần tạo (issue #37)

- `createManualSnapshot(): ActionResult<Snapshot>` — upsert
  `Snapshot{userId, holdingId: null, date: hôm nay, period: MANUAL, source:
  MANUAL, frozen: true, value: NAV hiện tại}` theo khóa dedup đã có (2 partial
  unique index, migration `add_snapshot_unique_constraint` — xem
  `docs/domain/06-snapshots.md` mục "Quy tắc & bất biến" và "Ca biên" —
  **upsert idempotent** theo `(userId, date, period)` khi `holdingId` null).
- Một hàm đọc `alreadySnapshotToday`/`snapshotTakenAt` cho ngày hôm nay của
  user hiện tại (truy vấn `Snapshot{userId, holdingId: null, date: hôm nay,
  period: MANUAL}`).
- **Lưu ý cần business-implementer xác nhận:** model `Snapshot`
  (`prisma/schema.prisma`, dòng ~184-206) chỉ có `createdAt` (set lúc INSERT,
  **không đổi** khi upsert UPDATE đè giá trị) — không có `updatedAt`. Nếu user
  bấm "Chốt số liệu hôm nay" nhiều lần trong ngày, `createdAt` của dòng
  Snapshot **không phản ánh đúng lần chốt gần nhất** để hiển thị chính xác
  "Đã chốt lúc HH:mm" ở **các lần tải trang sau** (trong phiên hiện tại thì
  giờ hiển thị tức thời lấy trực tiếp từ response Server Action — `state.ok
  === true` → `state.snapshotAt` — không có vấn đề gì, chỉ ảnh hưởng khi
  `alreadySnapshotToday` được đọc lại từ DB ở một request mới). Để lại quyết
  định (thêm `updatedAt` vào schema hay chấp nhận sai lệch nhỏ hiển thị giờ
  chốt lần đầu thay vì lần gần nhất) cho issue #37 — **không tự sửa schema**
  ở issue #35.

---

## File đã tạo/sửa — tổng hợp

**Tạo mới (bản gốc — mục 1, `SnapshotTodayCard`):**
- `src/features/dashboard/components/SnapshotTodayCard/{SnapshotTodayCard.tsx,index.ts}`
- `process/UI_phase_3.md` (file này)

**Tạo mới (issue #35 mở rộng — mục 2-7):**
- `src/components/ui/sheet.tsx`
- `src/features/snapshots/types.ts` (`SnapshotTodayState` — chuyển từ
  `dashboard/types.ts`)
- `src/features/snapshots/components/NavHistoryChart/{NavHistoryChart.tsx,index.ts}`
- `src/features/snapshots/components/SnapshotHistoryList/{SnapshotHistoryList.tsx,index.ts}`
- `src/features/snapshots/components/SnapshotFreezeSheet/{SnapshotFreezeSheet.tsx,index.ts}`
- `src/features/snapshots/components/SnapshotHistoryScreen/{SnapshotHistoryScreen.tsx,index.ts}`
- `src/features/snapshots/components/SnapshotDetailScreen/{SnapshotDetailScreen.tsx,index.ts}`
- `src/features/holdings/components/TransactionSnapshotBanner/{TransactionSnapshotBanner.tsx,index.ts}`
- `src/features/settings/components/SnapshotScheduleScreen/{SnapshotScheduleScreen.tsx,index.ts}`
- `src/app/(dashboard)/snapshots/page.tsx`
- `src/app/(dashboard)/snapshots/[id]/page.tsx`
- `src/app/(dashboard)/settings/snapshot-schedule/page.tsx`

**Sửa (bản gốc — mục 1):**
- `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` —
  thêm prop optional `snapshotToday` + render `SnapshotTodayCard`.

**Sửa (issue #35 mở rộng — mục 2-7):**
- `src/components/ui/badge.tsx` — thêm variant `accent`.
- `src/components/PageHeader/PageHeader.tsx` — thêm prop optional `trailing`.
- `src/lib/routes.ts` — thêm `snapshots`/`snapshotDetail`/`snapshotSchedule`.
- `src/features/dashboard/components/SnapshotTodayCard/SnapshotTodayCard.tsx` —
  đổi import `SnapshotTodayState` sang `@/features/snapshots/types`.
- `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` —
  thêm entry point Link "Lịch sử NAV".
- `src/features/dashboard/components/DashboardScreen/DashboardScreenSkeleton.tsx`
  — thêm dòng skeleton khớp Link mới.
- `src/features/holdings/components/HoldingDetailScreen/HoldingDetailScreen.tsx`
  — thêm prop optional `justRecorded` + render `TransactionSnapshotBanner`.
- `src/features/settings/components/SettingsScreen/SettingsScreen.tsx` — thêm
  `SettingsMenuItem` "Lịch chốt tự động".
- `docs/rules/ui-ux-design.md` — icon mapping mới + `Sheet`/Badge `accent` vào
  bảng atom/molecule.

**Xoá:**
- `src/features/dashboard/types.ts` — nội dung (`SnapshotTodayState`) chuyển
  sang `src/features/snapshots/types.ts`.

**Không sửa (đúng chỉ thị):**
- `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/holdings/[id]/page.tsx`
  — không cần, prop mới tự vắng mặt (Container chưa cấp).
- `prisma/schema.prisma`, `queries.ts`, mọi Server Action thật, `lib/xirr.ts`.
- `src/features/holdings/components/TransactionForm/TransactionForm.tsx`,
  `src/features/holdings/actions.ts` — wiring cờ "vừa giao dịch xong" (3d) để
  lại cho business-implementer.
- `.github/workflows/snapshot-cron.yml`, `jobs/snapshot-cron/main.py` — chỉ
  đọc giá trị cron thật để hiển thị đúng ở 3e.

## Kết quả kiểm tra

- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm test` (vitest, 11 file / 127 test có sẵn) — pass, không có test nào
  vỡ.
- Prettier: đã `--write` đúng các file mình tạo/sửa, không đụng file khác
  ngoài phạm vi thay đổi.
- Theo `docs/rules/testing.md`: không viết test render/snapshot cho component
  Presentational mới (`NavHistoryChart`, `SnapshotHistoryList`,
  `SnapshotFreezeSheet`, `SnapshotHistoryScreen`, `SnapshotDetailScreen`,
  `TransactionSnapshotBanner`, `SnapshotScheduleScreen`) — không nằm trong
  phạm vi test bắt buộc.
- **Không** tự chạy `pnpm e2e` (Playwright) — theo ranh giới vai trò
  `design-implementer`, việc verify toàn diện (bao gồm e2e suite) thuộc về
  agent `verifier` ở bước sau.
