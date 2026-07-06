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
