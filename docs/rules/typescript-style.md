# TypeScript & code style

Quy tắc nền cho mọi file TypeScript trong Navtrack.

## Kiểu & strict

- Bật **TS strict**; tránh `any`. Khi chưa rõ kiểu, dùng `unknown` + narrowing.

```ts
// ❌ Bad — any nuốt hết type safety
function parseHolding(input: any) {
  return input.symbol.toUpperCase();
}

// ✅ Good — unknown + narrowing
function parseHolding(input: unknown): string {
  const parsed = holdingSchema.parse(input); // zod
  return parsed.symbol.toUpperCase();
}
```

- Dùng `type` mặc định cho object/union; chỉ dùng `interface` khi cần extend công khai.

```ts
// ✅ Good
type AssetType = "STOCK" | "FUND" | "BOND" | "GOLD";
type HoldingSummary = { symbol: string; marketValue: string };

// ❌ Bad — interface cho union không dùng được, và ở đây không cần interface
interface HoldingSummary { symbol: string; marketValue: string }
```

- Khai **explicit return type** cho hàm export; để inference lo biến cục bộ.

```ts
// ✅ Good — hàm export có return type rõ
export function computeAbsolutePnl(cashflows: Cashflow[]): Decimal { ... }

// ❌ Bad — hàm export để inference, dễ trôi kiểu ngoài ý muốn
export function computeAbsolutePnl(cashflows: Cashflow[]) { ... }
```

## Export

- Dùng **named export** (không default export), trừ nơi Next bắt buộc default (`page.tsx`, `layout.tsx`, `error.tsx`...).

```ts
// ✅ Good — named export cho component/hàm thường
export function HoldingTable(props: Props) { ... }

// ❌ Bad — default export ở file thường
export default function HoldingTable(props: Props) { ... }

// ✅ Ngoại lệ đúng — page.tsx bắt buộc default
export default function DashboardPage() { ... }
```

## Đặt tên

- component `PascalCase`, biến/hàm `camelCase`, hằng thật `UPPER_SNAKE`, type `PascalCase`.
- **Component: PascalCase, mỗi component một thư mục riêng** dạng `ComponentName/ComponentName.tsx` + `index.ts` (barrel entry re-export). Sub-part chỉ dùng nội bộ (skeleton, sub-component) colocate trong cùng thư mục. Import qua thư mục.
- **File không phải component** (hook, util, lib) đặt **kebab-case**.
- **Ngoại lệ:** file shadcn sinh ra ở `components/ui/` giữ nguyên quy ước shadcn (kebab, một file) — không đụng vào.

```
✅ Good
  components/**/Account/Account.tsx        # component (PascalCase, thư mục riêng)
  components/**/Account/index.ts           # entry: export { Account } from "./Account"
  components/**/Account/AccountSkeleton.tsx # sub-part colocate
  lib/format.ts, lib/xirr.ts               # util → kebab-case
  features/holdings/hooks/use-hide-amounts.ts

❌ Bad
  components/account.tsx                    # component kebab, không có thư mục riêng
  components/**/Account/Format.ts           # util lại PascalCase
```

```ts
// components/**/Account/index.ts — entry chỉ re-export (named)
export { Account } from "./Account";
```

- Tất cả định danh, comment, commit message bằng **tiếng Anh**. Giữ nguyên thuật ngữ nghiệp vụ (XIRR, NAV, cashflow, dividend...).

```ts
// ❌ Bad — tên tiếng Việt
const soLuongCoPhieu = 100;
// ✅ Good
const shareQuantity = 100;
```

## Cú pháp & an toàn

- Ưu tiên `const`; dùng `let` chỉ khi reassign; không `var`. Dùng `async/await`, không chuỗi `.then()`.

```ts
// ❌ Bad
var total = 0;
fetchPrices().then((p) => { /* ... */ });

// ✅ Good
const prices = await fetchPrices();
```

- **Suy type từ zod** bằng `z.infer` để không khai trùng kiểu ở tầng validate và TS.

```ts
// ✅ Good — một nguồn sự thật
const holdingSchema = z.object({ symbol: z.string(), quantity: z.number() });
type HoldingInput = z.infer<typeof holdingSchema>;

// ❌ Bad — khai trùng, dễ lệch nhau
const holdingSchema = z.object({ symbol: z.string(), quantity: z.number() });
type HoldingInput = { symbol: string; quantity: number };
```

- Không mutate props/state trực tiếp; ưu tiên bất biến (readonly/spread).

```ts
// ❌ Bad — mutate mảng đầu vào
function addFee(cashflows: Cashflow[]) { cashflows.push(fee); return cashflows; }

// ✅ Good — trả bản mới
function withFee(cashflows: readonly Cashflow[]): Cashflow[] { return [...cashflows, fee]; }
```

- Comment giải thích **"tại sao"**, không mô tả "cái gì"; giữ tối thiểu.

```ts
// ❌ Bad — mô tả cái mắt đã thấy
// increment i by 1
i += 1;

// ✅ Good — giải thích lý do
// XIRR cần ít nhất 1 dòng tiền dương; ghép NAV hiện tại làm dòng cuối giả định.
cashflows.push({ date: today, amount: currentNav });
```

- Không để biến/import thừa (lint chặn).

## Đường dẫn nội bộ (route) qua constants

- Mọi route nội bộ (`Link href`, `redirect()`, `router.push()`, `revalidatePath()`, `backHref`...) phải lấy từ `ROUTES` (`src/lib/routes.ts`) — **không hardcode string route rải rác**. Route có tham số khai bằng hàm (`holdingDetail(id)`), route tĩnh khai string thường.
- Thêm route mới (route Next.js mới, hoặc trang cũ đổi path) → thêm/sửa đúng một chỗ trong `ROUTES`, không tìm-thay thủ công khắp repo.

```ts
// ❌ Bad — string route rải rác, đổi path phải grep cả repo
<Link href={`/holdings/${id}`}>...</Link>
redirect("/sign-in");
revalidatePath("/settings/members");

// ✅ Good — một nguồn sự thật
import { ROUTES } from "@/lib/routes";
<Link href={ROUTES.holdingDetail(id)}>...</Link>
redirect(ROUTES.signIn);
revalidatePath(ROUTES.members);
```
