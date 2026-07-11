# Component architecture

Quy tắc tổ chức component cho Navtrack (Next.js App Router + shadcn/ui). Áp dụng Atomic Design **thực dụng** + Container/Presentational qua Server Component.

## Ánh xạ Atomic Design (thực dụng)

- **Atoms** = primitives của shadcn/ui, đặt ở `components/ui/`.
- **Molecules** = tổ hợp nhỏ vài atoms; **Organisms** = khối theo tính năng; **Pages** = route Next.js. **Bỏ tầng templates.**
- Nhóm theo **feature trước, atomic bên trong**. Chỉ đưa lên `components/` chung khi thực sự dùng lại ở nhiều feature.

```
✅ Good  (component = PascalCase, thư mục riêng + index.ts)
features/holdings/components/HoldingTable/HoldingTable.tsx + index.ts   (organism riêng feature)
components/ui/button.tsx                                                 (atom shadcn — giữ nguyên)
components/MoneyValue/MoneyValue.tsx + index.ts                          (molecule dùng nhiều feature)

❌ Bad
components/HoldingTable/...              (chỉ holdings dùng mà đặt ở global)
features/holdings/components/Button/     (atom chung mà nhét vào feature)
components/money-value.tsx               (component kebab, không có thư mục riêng)
```

## Page (route file) phải mỏng

- File `page.tsx`/`layout.tsx` chỉ **điều phối**: gọi `queries.ts` lấy data, `auth()` lấy session, rẽ nhánh trạng thái (empty/error/list...), rồi render xuống đúng **một** organism đã tách trong `features/<x>/components/`. Không nhồi JSX nhiều nhánh trạng thái hay nhiều màn hình khác nhau (mockup 2 màn trở lên) trực tiếp vào page.
- **Không định nghĩa component (kể cả nhỏ, chưa export) ngay trong file `page.tsx`** — kể cả khi chỉ dùng nội bộ một lần. Tách ra `features/<x>/components/ComponentName/` như mọi component khác, vì nó vẫn là component thật (nhận props, tái dùng được), chỉ là đang bị đặt sai chỗ.
- Dấu hiệu page đã phình quá mức cần tách ngay: **> ~40 dòng**, có **> 1 nhánh trạng thái return JSX riêng**, hoặc **định nghĩa function component cục bộ** trong cùng file.

```tsx
// ❌ Bad — page nhồi 2 màn hình (empty/list) + 1 component cục bộ, > 100 dòng
function HoldingList({ holdings }: { holdings: HoldingSummary[] }) { /* ... */ }
export default async function HoldingsPage() {
  const { open, closed, totalInvested } = await getHoldingsOverview();
  if (open.length === 0 && closed.length === 0) {
    return <div>{/* ...50 dòng JSX màn trống... */}</div>;
  }
  return <div>{/* ...50 dòng JSX màn danh sách... */}</div>;
}

// ✅ Good — page chỉ fetch + rẽ nhánh + delegate, mỗi màn một organism riêng thư mục
export default async function HoldingsPage() {
  const { open, closed, totalInvested } = await getHoldingsOverview();
  if (open.length === 0 && closed.length === 0) {
    return <HoldingsEmptyState displayName={displayName} />;
  }
  return <HoldingsOverviewScreen open={open} closed={closed} totalInvested={totalInvested} />;
}
```

## Server Component & Container/Presentational

- **Mặc định là Server Component.** Chỉ thêm `"use client"` khi cần: tương tác, hook state/effect, browser API.
- **Container = Server Component** lấy data **qua các hàm trong `queries.ts`** (không gọi Prisma trực tiếp), rồi truyền props thuần xuống.
- **Presentational component thuần**: chỉ nhận props và hiển thị. **Không** fetch data, **không** truy cập DB trực tiếp.

```tsx
// ✅ Good — container (server) lấy data qua queries.ts, presentational chỉ nhận props
// features/holdings/components/HoldingList/HoldingList.tsx  (Server Component, không "use client")
export async function HoldingList() {
  const holdings = await getHoldings(); // queries.ts, tự filter theo user
  return <HoldingTable rows={holdings} />;
}

// ❌ Bad — presentational tự fetch / gọi Prisma
"use client";
export function HoldingTable() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetch("/api/holdings").then(/* ... */); }, []);
  return /* ... */;
}
```

- **Đẩy ranh giới client xuống lá:** giữ tương tác trong client component nhỏ; giữ page/organism ở server khi có thể.

```tsx
// ❌ Bad — cả trang "use client" chỉ vì một nút có onClick
"use client";
export default function DashboardPage() { /* toàn bộ dashboard thành client */ }

// ✅ Good — trang là server, chỉ nút toggle là client leaf
export default function DashboardPage() {
  return <><PortfolioSummary /><HideAmountsToggle /></>; // chỉ toggle "use client"
}
```

- Dùng **Server Actions** cho mutation (submit form) thay vì gọi API route từ client, khi có thể.

### Server Action & error contract

- Server action trả về một **shape thống nhất** (discriminated union), không throw ra UI cho lỗi lường trước được.

```ts
// ✅ Good — contract rõ ràng
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function addHolding(input: unknown): Promise<ActionResult<Holding>> {
  const parsed = holdingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: toFieldErrors(parsed.error) };
  }
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  const holding = await createHolding(session.user.id, parsed.data);
  revalidatePath("/holdings");
  return { ok: true, data: holding };
}

// ❌ Bad — throw lỗi validate ra UI, không có shape thống nhất, quên revalidate
export async function addHolding(input: any) {
  const holding = await db.holding.create({ data: input }); // không validate, không scope user
  return holding;
}
```

- Lỗi **không lường trước** (bug, DB chết) để `error.tsx` của route bắt; đừng nuốt lỗi im lặng.
- Phân loại lỗi, `AppError`, và ghi log: xem [`error-handling.md`](./error-handling.md).

## Quy ước component

- **Mỗi component một thư mục riêng** `ComponentName/ComponentName.tsx` + `index.ts` (entry re-export named). Sub-part nội bộ (skeleton, sub-component) colocate cùng thư mục. Import qua thư mục: `@/components/MoneyValue`.

```
✅ Good
components/MoneyValue/
├─ MoneyValue.tsx        # component
├─ MoneyValueSkeleton.tsx # sub-part colocate
└─ index.ts              # export { MoneyValue } from "./MoneyValue"

// import
import { MoneyValue } from "@/components/MoneyValue";
```
- **Không sửa trực tiếp** file shadcn sinh ra trong `components/ui/`. Cần tùy biến thì **bọc** lại.

```tsx
// ❌ Bad — sửa thẳng components/ui/button.tsx của shadcn
// ✅ Good — bọc lại
import { Button } from "@/components/ui/button";
export function DangerButton(props: Props) {
  return <Button variant="destructive" {...props} />;
}
```

- Mỗi component khai báo **`Props` bằng `type` tường minh** (không `interface`, không inline anonymous).

```tsx
// ❌ Bad — inline anonymous props
export function MoneyValue({ amount }: { amount: string }) { /* ... */ }

// ✅ Good — type Props tường minh
type Props = { amount: string; hidden: boolean };
export function MoneyValue({ amount, hidden }: Props) { /* ... */ }
```

- Hạn chế prop drilling; ưu tiên composition (`children`). Dùng context tiết chế.

## Loading, skeleton & Suspense

- Hai cơ chế, hai vai:
  - **`loading.tsx`** = fallback của **cả route** khi điều hướng tới lần đầu. Dùng cho **khung trang** với skeleton khớp layout thật, không dùng spinner chung chung.
  - **`Suspense` riêng cho từng vùng data** = bên trong trang, bọc mỗi component load data độc lập trong một `Suspense` **riêng, tách nhỏ**.
  - Nói ngắn: `loading.tsx` lo lần tải đầu của trang; `Suspense` nhỏ lo stream từng widget data bên trong.

```tsx
// ❌ Bad — một Suspense bao cả trang → mọi thứ chờ phần chậm nhất
<Suspense fallback={<Spinner />}>
  <PortfolioSummary /><NavChart /><HoldingList />
</Suspense>

// ✅ Good — mỗi vùng data một Suspense + skeleton riêng, stream độc lập
<>
  <Suspense fallback={<SummarySkeleton />}><PortfolioSummary /></Suspense>
  <Suspense fallback={<ChartSkeleton />}><NavChart /></Suspense>
  <Suspense fallback={<TableSkeleton />}><HoldingList /></Suspense>
</>
```

- Mỗi vùng Suspense có **`fallback` skeleton riêng** phản ánh đúng hình dạng nội dung; colocate skeleton cạnh component.
- Trạng thái **empty** là lời mời hành động (vd "Chưa có giao dịch — thêm giao dịch đầu tiên"), không để trống trơn. Trạng thái **error** nói rõ chuyện gì và cách xử lý.

### Quy tắc bắt buộc khi thêm/sửa page (checklist)

Dựng page mới (hoặc thêm data fetching vào page cũ) thì đi qua checklist này — **không được bỏ qua**:

1. **Page có `await` data (query/`auth()` chặn render)?** → route đó **bắt buộc có `loading.tsx`**, trừ khi page đã là sync và mọi vùng data đều nằm trong `Suspense` (khi đó shell tự hiện ngay, `loading.tsx` thừa).
2. **Page có ≥ 2 query độc lập?** → **không** `await` tuần tự trong page. Page giữ **sync** (shell render ngay), mỗi query tách thành một **async section component** (container, đặt trong `features/<x>/components/`) bọc trong `Suspense` riêng với skeleton riêng. Ví dụ mẫu: `settings/members/page.tsx` (`MemberQuotaSection` + `InvitedMembersSection`).
3. **Chỉ 1 query quyết định toàn bộ layout** (vd rẽ nhánh trống ↔ có dữ liệu)? → đặt query đó ở cấp cao nhất chi phối nhánh — `page.tsx` nếu route đơn lẻ, hoặc `layout.tsx` nếu **dùng chung cho nhiều route con** (vd tab đã tách thành route — xem mục "Tab điều hướng" bên dưới); giữ async + `loading.tsx` riêng của cấp đó. Page con bên dưới vẫn tự tách `Suspense` cho vùng data riêng của nó (không lặp lại query quyết định nhánh).

```tsx
// ❌ Bad — 2 query độc lập nhưng await tuần tự trong page, không loading.tsx
export default async function MembersPage() {
  const status = await getInvitableStatus();
  const members = await getMembers(); // chờ nhau + user nhìn màn trắng
  /* ... */
}

// ✅ Good — page sync, mỗi query một Suspense + skeleton riêng
export default function MembersPage() {
  return (
    <>
      <PageHeader title="Thành viên" backHref="/holdings" />
      <Suspense fallback={<MemberQuotaSkeleton />}><MemberQuotaSection /></Suspense>
      <Suspense fallback={<MemberListSkeleton />}><InvitedMembersSection /></Suspense>
    </>
  );
}
```

### Quy ước skeleton

- **Naming + vị trí:** `ComponentNameSkeleton.tsx` colocate **cùng thư mục** với component nó mô phỏng, re-export qua `index.ts` (vd `HoldingRow/HoldingRowSkeleton.tsx`, `TransactionForm/TransactionFormSkeleton.tsx`). `loading.tsx` của route **tái dùng** các skeleton này thay vì tự vẽ lại.
- **Dựng từ atom `Skeleton`** (`components/ui/skeleton.tsx`) — không tự chế `animate-pulse` rời rạc, không spinner.
- **Khớp hình dạng thật:** cùng khung card/border/padding với component thật, đúng số dòng chữ và vị trí trái/phải — mục tiêu là **không giật layout** khi data thay skeleton. Kích thước ước lượng (`h-3.5 w-24`) là đủ, không cần pixel-perfect.
- Skeleton là **Server Component thuần** (không `"use client"`), không nhận data — cùng lắm nhận prop `rows` để lặp (vd `MemberListSkeleton`).

```tsx
// ✅ Good — khớp khung HoldingRow thật (card + avatar + 2 cột chữ)
function HoldingRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5">
      <Skeleton className="size-10" />
      {/* ...2 dòng trái + 2 dòng phải như component thật */}
    </div>
  );
}

// ❌ Bad — spinner chung chung / khối xám không cùng hình dạng nội dung
<div className="flex justify-center"><Spinner /></div>
<Skeleton className="h-64" /> // một khối to thay cho cả danh sách card
```

### Tab điều hướng nội dung trang → tách route, không giữ state client

- Khi 2 tab hiển thị **2 tập dữ liệu khác nhau** (không phải 2 view cùng 1 fetch), tách thành **2 route con** thay vì 1 client component giữ `useState` chọn nội dung — tab dạng state không đồng bộ URL (không back/refresh/deep-link đúng được) và ép cả 2 tập dữ liệu phải fetch/derive dù chỉ 1 tab đang hiển thị.
- Dùng **route group** `(tênNhóm)` để 2 route con dùng chung 1 `layout.tsx` (chứa phần chung: header, stat tổng quan, thanh điều hướng) mà không ảnh hưởng route khác cùng cấp (route group không xuất hiện trong URL — xem `node_modules/next/dist/docs/.../file-conventions/route-groups.md`).
- Thanh điều hướng là `<Link>` thật (không phải `<button onClick>` đổi state) để có URL/back/right-click-mở-tab-mới đúng nghĩa; xác định tab active bằng `usePathname()`. `<Link>` mặc định đã prefetch khi vào viewport — không cần tự xử lý prefetch-on-hover.
- Nếu nhiều route con cùng cần dữ liệu dẫn xuất từ 1 fetch gốc (vd tổng vốn hiển thị ở cả 2 tab), bọc fetch gốc bằng `cache()` ở tầng `queries.ts` (xem [`data-prisma.md`](./data-prisma.md#chọn-select-hẹp-thay-vì-include-full-row)) để layout + page con không nhân đôi round-trip.

```
❌ Bad — HoldingsTabs (client, useState) chọn giữa 2 nội dung đã server-render sẵn cho CẢ 2 tab
"use client";
function HoldingsTabs({ openContent, closedContent }) {
  const [tab, setTab] = useState("open");
  return tab === "open" ? openContent : closedContent; // cả 2 đã derive+serialize từ trước
}

✅ Good — 2 route con dùng chung layout, mỗi route tự Suspense vùng data của nó
holdings/(overview)/layout.tsx   // header + StatCard (Suspense riêng) + HoldingsSegmentedNav + children
holdings/(overview)/page.tsx     // <Suspense><HoldingsPositionsSection status="open" /></Suspense>
holdings/(overview)/closed/page.tsx // status="closed"
```

## Đặc thù Navtrack

- Format tiền/số qua **helper dùng chung** (`lib/format.ts`); helper nhận cờ privacy và tôn trọng chế độ **ẩn số tiền** — ẩn **mọi giá trị tiền tuyệt đối bằng VND**, **giữ** phần trăm và số lượng cổ phần.

```tsx
// ❌ Bad — format rải rác + không tôn trọng privacy
<span>{holding.marketValue.toLocaleString()} đ</span>

// ✅ Good — qua helper, có cờ privacy
<span>{formatMoney(holding.marketValue, { hidden })}</span> // hidden → "••••••"
```

- Trạng thái ẩn số tiền lấy từ hai nguồn: mặc định từ `User.hideAmountsByDefault` (đọc phía server) và một client toggle bật/tắt nhanh (lưu tạm client, vd context/cookie). Container truyền cờ xuống, không để từng leaf tự đọc.
- Biểu đồ Recharts là **client component (organism)**; data đưa vào qua props từ container server, biểu đồ không tự fetch.

### Format & locale

- Tất cả format tập trung ở `lib/format.ts`, không format rải rác trong component.
- **Tiền VND:** dùng `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`. Nhận input là `string` (Decimal đã serialize), không phải `number`.
- **Ngày:** hiển thị kiểu Việt `dd/MM/yyyy`. Lưu UTC, hiển thị theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).
- **Phần trăm:** số chữ số thập phân nhất quán (vd 2 chữ số); luôn kèm nhãn rõ khi là tỷ suất "theo năm" (XIRR).

```ts
// ✅ Good
new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount));
// → "1.234.567 ₫"

// ❌ Bad — hardcode định dạng, sai chuẩn VN
`${amount} VND`;
```
