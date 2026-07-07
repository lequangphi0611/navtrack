# Data & Prisma

Quy tắc schema và truy cập dữ liệu cho Navtrack. Ưu tiên **đúng về tiền** và **tách dữ liệu theo user**.

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

## Đặt tên

- Model **PascalCase số ít** (`Holding`); field **camelCase**; enum value **UPPER_SNAKE**.
- Dùng **enum** trong schema cho tập giá trị cố định thay vì string tự do.

```prisma
// ❌ Bad — string tự do dễ sai chính tả, không ràng buộc
model Holding { type String }

// ✅ Good — enum
enum AssetType { STOCK FUND BOND GOLD }
model Holding { type AssetType }
```

## Quy ước model

- Mỗi model có `id String @id @default(cuid())` và `createdAt`. Thêm `updatedAt @updatedAt` ở model có sửa đổi.
- `DateTime` lưu **UTC**; xử lý timezone ở tầng hiển thị.
- Thêm `@@index([userId])` cho bảng thuộc user; index field hay truy vấn (vd `holdingId + date`).
- Quy định `onDelete` rõ ràng cho quan hệ.

```prisma
// ✅ Good
model Cashflow {
  id        String   @id @default(cuid())
  holdingId String
  holding   Holding  @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  date      DateTime
  amount    Decimal  @db.Decimal(20, 4)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([holdingId, date])
}
```

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

- Gom truy vấn có kiểm soát quyền vào `queries.ts` của feature, không rải Prisma khắp nơi.

## Migration & client

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

- Commit file migration. **Không sửa migration đã áp dụng** — tạo migration mới. Dev dùng `migrate dev`, prod dùng `migrate deploy`.
- `prisma/seed.ts` để seed giá trị mặc định (vd các dòng `Setting` cho thuế bán/cổ tức với `effectiveFrom` ban đầu).
- **Không truyền thẳng model Prisma ra client.** Convert `Decimal` → **`string`** (không phải `number`) tại biên server; **mọi toán tiền chỉ làm ở server bằng `Decimal`**, client chỉ hiển thị.

```ts
// ❌ Bad — trả Decimal thô (không serialize sạch) hoặc number (mở đường tính float ở client)
return { marketValue: holding.marketValue };          // Decimal
return { marketValue: holding.marketValue.toNumber() }; // number

// ✅ Good — string
return { marketValue: holding.marketValue.toString() };
```
