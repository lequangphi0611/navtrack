# Prisma schema — cách định nghĩa

Quy tắc **định nghĩa model/schema**. Phần truy vấn/bảo mật/tiền tệ ở [`data-prisma.md`](./data-prisma.md); file này lo cách *khai báo* model.

## Model & field cơ bản
- Mọi model có `id String @id @default(cuid())` + `createdAt DateTime @default(now())`; thêm `updatedAt DateTime @updatedAt` ở model **có sửa đổi**.
- Model **PascalCase số ít**, field **camelCase**, enum value **UPPER_SNAKE**.
- `DateTime` lưu **UTC**. Tiền/số lượng dùng `Decimal` (xem `data-prisma.md`), không `Float`.

```prisma
// ✅ Good
model Holding {
  id        String   @id @default(cuid())
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId])
}
// ❌ Bad — id tự tăng số, thiếu timestamp, tên số nhiều
model holdings { id Int @id @default(autoincrement()) }
```

## Enum
- Tập giá trị cố định → **enum**, không string tự do.

```prisma
// ✅ Good
enum AssetType { STOCK FUND BOND GOLD }
// ❌ Bad
model Holding { type String } // "stock"/"Stock"/"STOCK"... loạn
```

## Quan hệ (relation)
- Luôn khai **`onDelete` rõ ràng**; index cột khóa ngoại.
- Cột FK + `@relation` tường minh.

```prisma
// ✅ Good
model Cashflow {
  holdingId String
  holding   Holding @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  @@index([holdingId, date])
}
// ❌ Bad — không khai onDelete (hành vi ngầm), không index FK
model Cashflow { holding Holding @relation(fields: [holdingId], references: [id]) }
```

## Index
- Thêm `@@index([userId])` cho bảng thuộc user; index field truy vấn thường (vd `[holdingId, date]`, `[key, effectiveFrom]`).

## Soft-delete & audit
- Dữ liệu cần **giữ lịch sử/audit** (vd `AllowedUser`) dùng **soft-delete** bằng cột nullable (`revokedAt`), **không xóa cứng**. (Quy tắc *truy vấn* phải lọc `revokedAt = null` nằm ở `data-prisma.md`.)
- Thêm `updatedBy String?` khi cần biết ai đổi (config, quyền).

```prisma
// ✅ Good — soft-delete giữ audit
model AllowedUser {
  email     String    @unique
  revokedAt DateTime? // null = còn hiệu lực
}
// ❌ Bad — xóa cứng, mất dấu vết ai từng có quyền
// (dùng DELETE row)
```

## Effective-dating (giá trị theo thời gian)
- Với giá trị đổi theo thời gian (vd thuế trong `Setting`): **nhiều dòng cùng `key`**, mỗi dòng một `effectiveFrom`; **không** dùng `effectiveTo`. Ràng buộc `@@unique([key, effectiveFrom])`.

```prisma
// ✅ Good
model Setting {
  key           String
  value         String
  effectiveFrom DateTime
  @@unique([key, effectiveFrom])
  @@index([key, effectiveFrom])
}
```

## Key-value config
- Cấu hình dạng key-value lưu `value String` + `valueType` (enum) để parse đúng — **không** ép mọi thứ vào Decimal/Int cột riêng.

## Migration
- Mỗi thay đổi schema = **một migration**, tên mô tả (`add_allowed_user_can_invite`). **Không sửa migration đã áp dụng** — tạo migration mới. Commit file migration (xem `data-prisma.md`).

## Nguyên tắc khác
- **Nullable tường minh:** chỉ để `?` khi thực sự optional; có default hợp lý cho field bắt buộc.
- **Không nhét logic nghiệp vụ vào DB** (trigger/stored proc) — giữ ở tầng app để test được và nhất quán với domain spec.
- **Single-table cho `Holding`** (4 loại chung bảng) — xem `domain/01-assets-and-holdings.md`, không tách bảng theo loại.
