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

- **Schema là nguồn sự thật duy nhất của enum** — TS dẫn xuất từ `@prisma/client`, không khai lại union literal song song. Xem `typescript-style.md` mục "Enum".
- **Thêm một giá trị vào enum đang dùng là thay đổi lan rộng, không phải sửa một dòng.** Trước khi thêm, rà mọi điểm rẽ nhánh theo enum đó (`switch`, ternary, `if/else`, `where` filter Prisma, `Record` nhãn UI, `z.enum`) — chỗ nào phân nhánh nhị phân sẽ **không** được compiler bắt và giá trị mới sẽ âm thầm kế thừa nhánh `else`. Kèm việc chuyển các điểm đó sang `switch` + `assertNever` trong cùng thay đổi.

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
- **Key của `Setting`** khai tập trung ở `SETTING_KEYS` (`src/lib/settings.ts`) — mọi chỗ đọc/ghi (`resolveSetting`, `prisma/seed.ts`...) qua constant này, **không** hardcode string key (`"MAX_MEMBERS"`) rải rác; thêm key mới → thêm vào `SETTING_KEYS` trước.

```ts
// ❌ Bad — string key rải rác, gõ sai không ai bắt được lúc build
await resolveSetting("MAX_MEMBERS", new Date());

// ✅ Good — một nguồn sự thật, type-safe
import { resolveSetting, SETTING_KEYS } from "@/lib/settings";
await resolveSetting(SETTING_KEYS.MAX_MEMBERS, new Date());
```

## Migration
- Mỗi thay đổi schema = **một migration**, tên mô tả (`add_allowed_user_can_invite`). **Không sửa migration đã áp dụng** — tạo migration mới. Commit file migration (xem `data-prisma.md`).

### Backfill dữ liệu dẫn xuất

- **SQL trong migration chỉ được làm việc cơ học:** thêm/xoá/đổi cột, đổi kiểu, copy nguyên giá trị, set default. **Cấm chứa công thức nghiệp vụ** (giá vốn bình quân, XIRR, thuế, quy tắc cộng/trừ số lượng...).
- Backfill một giá trị **dẫn xuất** phải viết bằng **TypeScript, gọi thẳng hàm thật** trong `lib/` — không chép công thức sang SQL.

Lý do (ca thật đã xảy ra): `20260711092933_backfill_holding_position/migration.sql` tự khai ngay ở header rằng nó là *"a hand-written SQL REPLICA of derivePosition()"*, kèm dặn dò *"if that logic changes, add a NEW migration"*. Sau đó `derivePosition()` **đã đổi** (issue #59 — biết thêm cổ tức cổ phiếu) và **không có migration mới nào được thêm**. Lần này hậu quả bằng 0 nhờ may mắn về thứ tự thời gian (tính năng cổ tức ra đời sau, lúc backfill chạy chưa có `Dividend` nào; trên DB mới thì nó chạy trên bảng rỗng) — nhưng **cơ chế bảo vệ đã thất bại**: một quy tắc chỉ được ép bằng comment trong file bất biến thì không ai tuân thủ.

Đây là **Connascence of Algorithm xuyên ngôn ngữ** — dạng lặp tri thức mà compiler không với tới được ([`clean-code.md`](./clean-code.md#giới-hạn-phải-thừa-nhận)). Không có công cụ nào dò được lệch loại này (công cụ drift detection hiện có chỉ dò lệch **schema**, không dò lệch **logic**), nên cách duy nhất là **không tạo ra nó**.

Lý do duy nhất chính đáng để viết SQL thuần — hiệu năng trên bảng cực lớn — **không tồn tại ở Navtrack** (danh mục cá nhân, vài user). Nếu về sau có ca thật sự cần, phải ghi rõ lý do trong migration **và** kèm integration test so khớp kết quả SQL với hàm TS.

```
❌ Bad — migration.sql chứa WITH RECURSIVE phát lại BUY/SELL để tính avgCost (bản sao derivePosition)
✅ Good — migration.sql chỉ thêm cột; scripts/backfill-holding-position.ts import derivePosition() rồi ghi
```

> Migration cũ giữ nguyên (bất biến — không sửa lại). Luật này áp cho migration **mới**.

## Nguyên tắc khác
- **Nullable tường minh:** chỉ để `?` khi thực sự optional; có default hợp lý cho field bắt buộc.
- **Không nhét logic nghiệp vụ vào DB** (trigger/stored proc) — giữ ở tầng app để test được và nhất quán với domain spec.
- **Single-table cho `Holding`** (4 loại chung bảng) — xem `domain/01-assets-and-holdings.md`, không tách bảng theo loại.
