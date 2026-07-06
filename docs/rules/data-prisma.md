# Data & Prisma

Quy tắc schema và truy cập dữ liệu cho Navtrack. Ưu tiên **đúng về tiền** và **tách dữ liệu theo user**.

## Tiền & số học

- Tiền và số lượng **luôn dùng `Decimal`**, không bao giờ `Float`. Chỉ định precision rõ ràng, vd `@db.Decimal(20, 4)`.
- **Không** làm toán tiền bằng floating point trong JS. Dùng `Decimal` xuyên suốt mọi tính toán (XIRR, tổng vốn, lãi/lỗ...).
- `Cashflow.amount` mang dấu sẵn (âm = mua, dương = bán). Ghi rõ quy ước này trong comment của schema.

## Đặt tên

- Model **PascalCase số ít** (`Holding`); field **camelCase**; enum value **UPPER_SNAKE**.
- Dùng **enum** trong schema cho tập giá trị cố định (`AssetType`, `CashflowType`, `DividendType`...) thay vì string tự do.

## Quy ước model

- Mỗi model có `id String @id @default(cuid())` và `createdAt`. Thêm `updatedAt @updatedAt` ở model có sửa đổi.
- `DateTime` lưu **UTC**; xử lý timezone ở tầng hiển thị.
- Thêm `@@index([userId])` cho bảng thuộc user; index field hay truy vấn (vd `holdingId + date`).
- Quy định `onDelete` rõ ràng cho quan hệ (vd xóa `Holding` thì cascade `Cashflow` của nó).

## Bảo mật / tách dữ liệu theo user

- **Mọi truy vấn dữ liệu user PHẢI filter theo `userId` của phiên đăng nhập.** Không bao giờ query `Holding`/`Cashflow`/... mà không giới hạn theo user hiện tại.
- **Không tin `userId` từ client.** Luôn lấy từ session phía server qua helper `auth()` của Auth.js (cấu hình ở `lib/auth.ts`).
- Gom truy vấn có kiểm soát quyền vào `queries.ts` của feature, không rải Prisma khắp nơi.

## Migration & client

- Prisma client **singleton** ở `lib/db.ts` (tránh cạn connection khi hot reload dev).
- Commit file migration. **Không sửa migration đã áp dụng** — tạo migration mới. Dev dùng `migrate dev`, prod dùng `migrate deploy`.
- `prisma/seed.ts` để seed giá trị mặc định (vd `TaxRule` theo `AssetType`) và dữ liệu dev.
- **Không truyền thẳng model Prisma ra client.** Convert `Decimal` → **`string`** (không phải `number`) tại biên server trước khi đưa vào client component: `Decimal` không serialize sạch, và `number` mở đường cho toán tiền bằng float ở client. **Mọi toán tiền chỉ làm ở server bằng `Decimal`**; client chỉ hiển thị.
