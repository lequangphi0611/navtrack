# Data & Prisma

Quy tắc **truy vấn Prisma, tiền tệ, và tách dữ liệu theo user**. Cách *định nghĩa* model/schema (đặt tên, enum, quan hệ, timestamps, index, migration...) ở [`schema.md`](./schema.md).

## Tiền & số học

- Tiền và số lượng **luôn dùng `Decimal`**, không bao giờ `Float`. Chỉ định precision rõ ràng.

```prisma
// ❌ Bad — Float làm tròn sai tiền
model Cashflow { amount Float }

// ✅ Good — Decimal với precision rõ
model Cashflow { amount Decimal @db.Decimal(20, 4) }
```

- **Không** làm toán tiền bằng floating point trong JS. Dùng `Decimal` xuyên suốt.

```ts
// ❌ Bad — cộng tiền bằng number
const total = cashflows.reduce((s, c) => s + Number(c.amount), 0);

// ✅ Good — cộng bằng Decimal
const total = cashflows.reduce((s, c) => s.plus(c.amount), new Decimal(0));
```

- `Cashflow.amount` mang dấu sẵn (âm = mua, dương = bán). Ghi rõ quy ước này trong comment của schema.

## Bảo mật / tách dữ liệu theo user

- **Mọi truy vấn dữ liệu user PHẢI filter theo `userId` của phiên đăng nhập.**
- **Không tin `userId` từ client.** Luôn lấy từ session phía server qua helper `auth()` của Auth.js (`lib/auth.ts`).

```ts
// ❌ Bad — nhận userId từ client, lộ dữ liệu người khác
export async function getHoldings(userId: string) {
  return db.holding.findMany({ where: { userId } });
}

// ❌ Bad — không filter theo user, trả về toàn bộ
export async function getHoldings() {
  return db.holding.findMany();
}

// ✅ Good — lấy userId từ session, luôn filter
export async function getHoldings() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.holding.findMany({ where: { userId: session.user.id } });
}
```

- Với model **soft-delete** (vd `AllowedUser`), truy vấn phải lọc `revokedAt = null` (định nghĩa cột: xem `schema.md`).
- Gom truy vấn có kiểm soát quyền vào `queries.ts` của feature, không rải Prisma khắp nơi.

## Prisma client & serialization

- Prisma client **singleton** ở `lib/db.ts` (tránh cạn connection khi hot reload dev).

```ts
// ✅ Good — lib/db.ts singleton
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// ❌ Bad — new PrismaClient() mỗi file → cạn connection khi hot reload
export const db = new PrismaClient();
```

- `prisma/seed.ts` để seed giá trị mặc định (vd các dòng `Setting` cho thuế bán/cổ tức với `effectiveFrom` ban đầu).
- **Không truyền thẳng model Prisma ra client.** Convert `Decimal` → **`string`** (không phải `number`) tại biên server; **mọi toán tiền chỉ làm ở server bằng `Decimal`**, client chỉ hiển thị.

```ts
// ❌ Bad — trả Decimal thô (không serialize sạch) hoặc number (mở đường tính float ở client)
return { marketValue: holding.marketValue };          // Decimal
return { marketValue: holding.marketValue.toNumber() }; // number

// ✅ Good — string
return { marketValue: holding.marketValue.toString() };
```

> Migration discipline (mỗi thay đổi một migration, không sửa migration đã áp, commit file): xem [`schema.md`](./schema.md).
