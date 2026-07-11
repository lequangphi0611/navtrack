# Performance

App dùng chủ yếu trên **mobile** (màn hình nhỏ, mạng/CPU yếu hơn desktop). Ưu tiên: **ít JS tải về ban đầu**, **không tính toán lặp lại lãng phí trên client**, **không giật layout**. Không tối ưu sớm khi chưa có dấu hiệu chậm thật — trừ các rule cụ thể bên dưới đã được chốt trước.

## Data fetching — không cache tầng server

- **Không** dùng `unstable_cache`, `fetch` cache, hay bất kỳ cơ chế cache dữ liệu nào ở tầng server cho `queries.ts` (holdings, giá, snapshot...). Mọi query gọi thẳng Prisma mỗi request.
- **Lý do:** dữ liệu tài chính (số dư, lãi/lỗ, giá) phải luôn là số **mới nhất** — đã chốt nguyên tắc này khi làm PWA (`04-tech-stack.md`, mục PWA: "không cache số liệu tài chính offline"). Cache tầng server thêm một lớp "có thể stale" phải quản lý (nhớ `revalidateTag` đúng chỗ mỗi mutation) trong khi Neon đủ nhanh cho quy mô dữ liệu hiện tại — độ phức tạp không đáng so với lợi ích.
- Đây là **tầng khác** với service worker cache đã có: SW chỉ cache **asset tĩnh** (`/_next/static/*`, icon), chưa từng và sẽ không cache response API/RSC. Rule này nói về tầng Next.js Data Cache/Prisma, không mâu thuẫn mà nhất quán với quyết định PWA.
- **Ngoại lệ được phép:** dùng React `cache()` để **dedupe trong cùng một lượt render** (vd `auth()` hoặc một query bị gọi từ nhiều Server Component con trong cùng cây) — đây không phải cache xuyên request, chỉ tránh gọi DB trùng lặp trong một request, không có rủi ro stale.

```ts
// ❌ Bad — cache xuyên request cho dữ liệu tài chính, có thể hiện số cũ
export const getHoldings = unstable_cache(
  async (userId: string) => db.holding.findMany({ where: { userId } }),
  ["holdings"],
  { revalidate: 60 },
);

// ✅ Good — query thẳng, luôn tươi
export async function getHoldings() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.holding.findMany({ where: { userId: session.user.id } });
}

// ✅ Good — React cache() chỉ dedupe trong 1 request, không phải cache xuyên request
import { cache } from "react";
export const getCurrentUserId = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
});
```

## Memoization ở client component

Phần lớn UI là Server Component nên diện tích cần memo rất hẹp — chỉ áp dụng trong `"use client"` component. Không memo tuỳ tiện: mỗi `useMemo`/`useCallback`/`React.memo` thêm chi phí so sánh, chỉ dùng đúng 3 trường hợp sau.

- **`useMemo` bắt buộc** cho tính toán lặp lại tốn kém trên danh sách/chart: aggregate (tổng giá trị danh mục, group theo loại tài sản), transform data cho Recharts (map mảng holdings sang shape biểu đồ cần). Không có `useMemo`, phép tính chạy lại mỗi render dù input không đổi, và Recharts nhận prop `data` reference mới mỗi lần → tự vẽ lại toàn bộ chart.
- **`useCallback`** khi truyền callback xuống row/item **đã bọc `React.memo`** — thiếu bước này, function mới mỗi render phá tác dụng của memo ở component con.
- **`React.memo`** cho row component lặp trong danh sách dài (vd mỗi dòng holding, mỗi dòng giao dịch) khi cha re-render vì lý do khác với data của hàng đó (vd toggle ẩn số tiền, mở/đóng nhóm) nhưng phần lớn hàng không đổi props.
- **Mặc định KHÔNG memo** những component còn lại (không nằm trong danh sách lặp, không có phép tính nặng) — thêm memo ở đây chỉ làm rối code mà không có lợi đo được.

```tsx
// ❌ Bad — transform chạy lại mỗi render, React.memo(Row) không cản được re-render vì callback mới
"use client";
export function HoldingsChart({ holdings, hidden }: Props) {
  const chartData = holdings.map(toChartPoint); // chạy lại mỗi render
  return <AreaChart data={chartData}>{/* ... */}</AreaChart>;
}

const Row = React.memo(function Row({ holding, onSelect }: RowProps) { /* ... */ });
export function HoldingsList({ holdings, hidden }: Props) {
  const onSelect = (id: string) => setSelected(id); // function mới mỗi render
  return holdings.map((h) => <Row key={h.id} holding={h} onSelect={onSelect} />);
}

// ✅ Good — useMemo cho transform nặng, useCallback giữ nguyên reference cho Row đã memo
"use client";
export function HoldingsChart({ holdings, hidden }: Props) {
  const chartData = useMemo(() => holdings.map(toChartPoint), [holdings]);
  return <AreaChart data={chartData}>{/* ... */}</AreaChart>;
}

const Row = React.memo(function Row({ holding, onSelect }: RowProps) { /* ... */ });
export function HoldingsList({ holdings, hidden }: Props) {
  const onSelect = useCallback((id: string) => setSelected(id), []);
  return holdings.map((h) => <Row key={h.id} holding={h} onSelect={onSelect} />);
}
```

## Code splitting cho chart & organism nặng

- **Mọi component dùng Recharts** (hoặc thư viện client nặng tương tự sau này) **bắt buộc `next/dynamic`**, không import tĩnh trực tiếp vào container/page — giảm First Load JS trên mobile.
- `ssr: false` cho chart: app luôn sau đăng nhập (không cần SEO), chart chỉ có ý nghĩa phía client.
- Cung cấp `loading` cho `dynamic()` bằng đúng skeleton colocate của component (theo quy ước skeleton ở [`component-architecture.md`](./component-architecture.md)), không để trắng khoảng chờ.
- Áp dụng cho mọi chart (NAV theo thời gian, phân bổ tài sản...) — không chỉ phần "dưới fold".

```tsx
// ❌ Bad — import tĩnh, Recharts vào bundle chính của page
import { NavChart } from "@/features/dashboard/components/NavChart";

// ✅ Good — dynamic import, tách chunk riêng, skeleton khớp khung chart thật
const NavChart = dynamic(
  () => import("@/features/dashboard/components/NavChart").then((m) => m.NavChart),
  { ssr: false, loading: () => <NavChartSkeleton /> },
);
```

## Danh sách dài — pagination cho lịch sử giao dịch

- **Holdings** (danh mục đang nắm giữ): **không** cần pagination/virtualization — danh mục cá nhân luôn nhỏ (vài chục dòng), thêm cơ chế này là over-engineering.
- **Lịch sử giao dịch** (transactions): tăng dần không giới hạn theo thời gian sử dụng → **bắt buộc giới hạn/pagination** khi hiển thị (cursor-based qua `id`/`createdAt`, `take` cố định mỗi trang), không `findMany()` toàn bộ lịch sử một lần.

```ts
// ❌ Bad — load toàn bộ lịch sử giao dịch, phình dần theo thời gian dùng app
export async function getTransactions(holdingId: string) {
  return db.transaction.findMany({ where: { holdingId }, orderBy: { date: "desc" } });
}

// ✅ Good — cursor pagination, giới hạn mỗi lần load
export async function getTransactions(holdingId: string, cursor?: string, take = 20) {
  return db.transaction.findMany({
    where: { holdingId },
    orderBy: { date: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
```
