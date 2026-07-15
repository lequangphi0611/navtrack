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

## Tóm tắt trạng thái wiring

| Component | Route | Trạng thái wiring |
|---|---|---|
| `SnapshotTodayCard` | Dashboard (`/`, route đã wiring thật) | Khung đã có, `snapshotToday` chưa được Container cấp — ẩn mặc định |

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

**Tạo mới:**
- `src/features/dashboard/types.ts` (mới — `SnapshotTodayState`)
- `src/features/dashboard/components/SnapshotTodayCard/{SnapshotTodayCard.tsx,index.ts}`
- `process/UI_phase_3.md` (file này)

**Sửa:**
- `src/features/dashboard/components/DashboardScreen/DashboardScreen.tsx` —
  thêm prop optional `snapshotToday` + render `SnapshotTodayCard`.

**Không sửa (đúng chỉ thị):**
- `src/app/(dashboard)/page.tsx` — không cần, prop tự vắng mặt.
- `prisma/schema.prisma`, `queries.ts`, mọi Server Action thật, `lib/xirr.ts`.

## Kết quả kiểm tra

- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm test` (vitest, 11 file / 127 test có sẵn) — pass, không có test nào
  vỡ.
- Prettier: đã `--write` đúng các file mình tạo/sửa
  (`SnapshotTodayCard.tsx`, `DashboardScreen.tsx`), không đụng file khác
  ngoài phạm vi thay đổi.
- Theo `docs/rules/testing.md`: không viết test render/snapshot cho
  `SnapshotTodayCard` (component Presentational, không nằm trong phạm vi
  test bắt buộc).
