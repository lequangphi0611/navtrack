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

## Enum: một nguồn sự thật + phân nhánh exhaustive

Bối cảnh: rule này ra đời sau khi rà Phase 7 phát hiện việc thêm **một giá trị** vào `DividendType` sẽ làm sai âm thầm ở nhiều chỗ mà TypeScript **không** báo lỗi — vì code phân nhánh nhị phân và tự khai lại union literal. Xem `process/DECISION.md` 2026-07-25 (2).

### 1. Enum nghiệp vụ khai ở Prisma, TS **dẫn xuất** — không khai lại union song song

- `prisma/schema.prisma` là nguồn sự thật cho mọi enum nghiệp vụ (`AssetType`, `CashflowType`, `DividendType`...).
- Type ở TS **luôn** `import type { X } from "@prisma/client"`. **Cấm** khai lại union literal song song — bản sao sẽ lệch khi enum thêm giá trị, mà không có gì bắt được.
- Cần **giá trị runtime** (mảng options cho form, `z.enum`, filter tab)? Khai một lần ở `src/lib/enums.ts` và ràng buộc lại với enum Prisma bằng `satisfies` + một check bắt **thiếu** giá trị. Dùng `import type` (không import runtime từ `@prisma/client` vào Client Component — kéo cả Prisma vào bundle).

```ts
// ❌ Bad — bản sao song song, thêm BOND_COUPON vào Prisma thì file này vẫn "hợp lệ"
type DividendKind = "CASH" | "STOCK";
const dividendTypeEnum = z.enum(["CASH", "STOCK"]);

// ✅ Good — src/lib/enums.ts: một nguồn sự thật, sai lệch là lỗi compile
import type { DividendType } from "@prisma/client";

export const DIVIDEND_TYPES = [
  "CASH",
  "STOCK",
  "BOND_COUPON",
] as const satisfies readonly DividendType[]; // bắt tên sai

// bắt THIẾU giá trị: đỏ ngay khi Prisma thêm một enum value chưa liệt kê ở trên
type _AllDividendTypesCovered =
  Exclude<DividendType, (typeof DIVIDEND_TYPES)[number]> extends never ? true : never;

// ✅ zod dẫn xuất, không gõ lại danh sách
export const dividendTypeSchema = z.enum(DIVIDEND_TYPES);
```

### 2. Phân nhánh theo enum: `switch` exhaustive, không `if/else` hay ternary nhị phân

- Mọi chỗ **rẽ nhánh theo giá trị enum** dùng `switch` phủ hết case + `default` gọi `assertNever` (`src/lib/assert-never.ts`). Thêm giá trị enum → compile lỗi tại **mọi** điểm rẽ nhánh, không phải đi grep bằng trí nhớ.
- **Cấm** `if (x === "A") {...} else { /* coi như B */ }` và `x === "A" ? ... : ...` khi nhánh `else` **mang giả định** về giá trị còn lại. Đây là lỗi nguy hiểm nhất: giá trị mới rơi vào `else` và kế thừa luôn giả định sai (kể cả `!`/non-null assertion dựa trên giả định đó).

```ts
// ❌ Bad — thêm BOND_COUPON: rơi vào else, stockQuantity là null -> sai/crash, TS im lặng
if (dividend.type === "CASH") {
  return { gross: dividend.grossAmount! };
}
// "stockQuantity luôn có giá trị khi type === STOCK"
return { quantity: dividend.stockQuantity! };

// ✅ Good — thêm giá trị enum là lỗi compile ngay tại đây
switch (dividend.type) {
  case "CASH":
  case "BOND_COUPON":
    return { gross: dividend.grossAmount! };
  case "STOCK":
    return { quantity: dividend.stockQuantity! };
  default:
    return assertNever(dividend.type);
}
```

```ts
// src/lib/assert-never.ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled enum value: ${String(value)}`);
}
```

- **Ngoại lệ hợp lệ:** so sánh dùng làm **predicate boolean** thuần, nơi nhánh còn lại không giả định gì (`cashflows.filter((cf) => cf.type === "BUY")`, `delta = cf.type === "BUY" ? qty : qty.neg()`). Nhưng khi thêm giá trị enum vẫn phải **rà lại** các predicate này — chúng không được compiler bảo vệ. Nếu ý nghĩa là "mọi loại trừ X", viết rõ trong comment tại chỗ.
- **Nhãn hiển thị theo enum** (tiếng Việt trên UI) khai bằng `Record<EnumType, string>` — thiếu key là lỗi compile, khác hẳn chuỗi ternary lồng nhau.

```ts
// ❌ Bad — thêm loại mới sẽ hiện nhãn của loại khác
const label = type === "CASH" ? "Tiền mặt" : "Cổ phiếu";

// ✅ Good
const DIVIDEND_TYPE_LABELS: Record<DividendType, string> = {
  CASH: "Tiền mặt",
  STOCK: "Cổ phiếu",
  BOND_COUPON: "Trái tức",
};
```

> ESLint hiện **không** bắt được lỗi này (`eslint.config.mjs` chưa bật type-aware linting; rule `@typescript-eslint/switch-exhaustiveness-check` cần type info). Cho tới khi bật, `assertNever` + `Record<EnumType, …>` là cơ chế thực thi — chúng chỉ cần compiler, không cần lint.

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
