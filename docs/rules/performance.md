# Performance

App dùng chủ yếu trên **mobile** (màn hình nhỏ, mạng/CPU yếu hơn desktop). Ưu tiên: **ít JS tải về ban đầu**, **không tính toán lặp lại lãng phí trên client**, **không giật layout**. Không tối ưu sớm khi chưa có dấu hiệu chậm thật — trừ các rule cụ thể bên dưới đã được chốt trước.

## Data fetching — cache có chọn lọc theo loại dữ liệu

Nguyên tắc: **cache khi không làm số liệu tài chính kém tươi và không rò dữ liệu giữa user**; query thẳng Prisma khi caching chỉ thêm rủi ro stale/phức tạp mà lợi ích không đáng. Không cache cả nắm, cũng không cấm cache cả nắm — quyết theo **bản chất từng loại dữ liệu**. (Bối cảnh + lý do đổi hướng: [`process/DECISION.md`](../../process/DECISION.md), mục 2026-07-11.)

### Bất biến — không được vi phạm ở bất kỳ phase nào

- **Session/quyền truy cập KHÔNG BAO GIỜ cache xuyên request.** Thu hồi quyền phải có hiệu lực **tức thời** (`domain/08`). `getSession = cache(auth)` chỉ dedupe **trong một lượt render** và tự reset mỗi request — tuyệt đối không `unstable_cache`/`'use cache'` cho `auth()`/allowlist.
- **Cache key phải gồm `userId` cho mọi dữ liệu scoped-theo-user.** Cache key sai/thiếu `userId` = user này thấy số của user khác — đây là lỗi **bảo mật**, không phải hiệu năng. Footgun cụ thể: `unstable_cache` chỉ đưa **tham số của hàm** vào cache key; `userId` đọc từ `auth()` **bên trong** hàm cache thì cache **không thấy** → mọi user chung một entry. Luôn lấy session **ngoài** hàm cache rồi **truyền `userId` vào như tham số**. Dữ liệu dùng chung (vd `PriceQuote` theo `symbol`, không theo user — `domain/04`) thì key theo `symbol`, không cần `userId`.

### Phân loại (áp dụng khi dữ liệu tương ứng xuất hiện ở Phase 2–3)

| Loại dữ liệu | Writer | Đổi khi nào | Chiến lược cache |
|---|---|---|---|
| `PriceQuote` (giá EOD — Phase 2) | Job Python (ngoài app) | Theo cadence job (EOD) | Cache theo `symbol`; `revalidate` theo thời gian khớp cadence job. Job ghi thẳng Postgres nên app **không** nhận được `revalidateTag` từ job → dùng time-based `revalidate` (hoặc để job ping một route revalidate tag sau khi ghi). Không kém tươi hơn thực tế vì giá vốn chỉ mới đến lần job chạy gần nhất. |
| Snapshot **đã đóng băng** (`frozen=true` — Phase 3) | Job/app | **Không bao giờ** (bất biến — `domain/06`) | Cache mạnh, tag theo `userId`+mốc. Chỉ snapshot "live" (chưa đóng băng) mới cần tươi. |
| Holdings / Cashflows của user | Chính app (mutation của user đó) | Chỉ khi user sửa | Có thể `unstable_cache` (key gồm `userId`) + `revalidateTag` trong Server Action. Writer chính là app nên không stale nếu revalidate đúng chỗ. |

### Hiện trạng Phase 1 & lộ trình

- **Phase 1 hiện chưa cache gì ở tầng server** — mọi `queries.ts` (holdings, cashflows) query thẳng Prisma mỗi request. Đây là **chủ đích cho quy mô Phase 1** (dữ liệu nhỏ, Neon đủ nhanh, cache chỉ thêm rủi ro key-scoping mà lợi ích ~0), **không phải** vì cache bị cấm về nguyên tắc.
- **Đưa cache vào thực sự hoãn tới Phase 2–3** — khi có `PriceQuote` (đọc nhiều theo `symbol`) và snapshot bất biến (chart đọc dày), cache mới có lý do đo được. Task cụ thể + hiện trạng cần fix: [`process/phase-2.md`](../../process/phase-2.md).
- **Ngoại lệ đang dùng:** React `cache()` để **dedupe trong cùng một lượt render** (vd `getSession`) — không phải cache xuyên request, không rủi ro stale.
- **Tầng khác với service worker:** SW chỉ cache **asset tĩnh** (`/_next/static/*`, icon), chưa từng và sẽ không cache response API/RSC/số liệu tài chính (`04-tech-stack.md`, mục PWA). Rule này nói về tầng Next.js Data Cache/Full Route Cache, nhất quán với quyết định PWA.

```ts
// ❌ Bad — đọc userId TỪ auth() BÊN TRONG hàm cache: unstable_cache không thấy giá trị này,
//          mọi user chia sẻ chung 1 entry → user A thấy số của user B (lỗ hổng bảo mật)
export const getHoldings = unstable_cache(async () => {
  const session = await auth();                          // ⚠️ ngoài tầm nhìn của cache key
  return db.holding.findMany({ where: { userId: session!.user.id } });
}, ["holdings"], { revalidate: 60 });

// ❌ Bad — cache auth/quyền xuyên request → thu hồi quyền không có hiệu lực tức thời
export const getSessionCached = unstable_cache(auth, ["session"], { revalidate: 300 });

// ✅ Good (Phase 1, mặc định) — query thẳng, luôn tươi; scope userId lấy từ session
export async function getHoldings() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.holding.findMany({ where: { userId: session.user.id } });
}

// ✅ Good (Phase 2+, nếu cache) — userId là THAM SỐ (được đưa vào cache key), session lấy ngoài
const getHoldingsCached = unstable_cache(
  async (userId: string) => db.holding.findMany({ where: { userId } }),
  ["holdings"],
  { revalidate: 60, tags: ["holdings"] }, // revalidateTag("holdings") trong action sau mutation
);
export async function getHoldings() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return getHoldingsCached(session.user.id); // userId vào key → cách ly đúng giữa user
}

// ✅ Good — React cache() chỉ dedupe trong 1 request, không phải cache xuyên request
import { cache } from "react";
export const getCurrentUserId = cache(async () => {
  const session = await getSession();
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
