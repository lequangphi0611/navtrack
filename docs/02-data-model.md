# Data model (Prisma) — bản nháp

Cập nhật từ đề xuất gốc (`holdings`, `cashflows`, `snapshots`) để phản ánh các quyết định: cổ tức riêng, thuế, nav override, đơn vị cho vàng.

```prisma
enum AssetType {
  STOCK
  FUND
  BOND
  GOLD
}

enum CashflowType {
  BUY
  SELL
}

enum DividendType {
  CASH
  STOCK
}

enum SnapshotSource {
  AUTO
  MANUAL
}

enum SnapshotPeriod {
  MONTH_END
  YEAR_END
  MANUAL
  TODAY
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  hideAmountsByDefault Boolean  @default(false) // trạng thái mặc định của chế độ ẩn số tiền trên dashboard
  holdings            Holding[]
  createdAt           DateTime  @default(now())
}

// Allowlist "chỉ người được mời" — gate ở signIn callback của Auth.js.
// Soft-delete bằng revokedAt để giữ audit; xóa cứng sẽ mất lịch sử.
model AllowedUser {
  id        String    @id @default(cuid())
  email     String    @unique
  invitedBy String?
  createdAt DateTime  @default(now())
  revokedAt DateTime? // null = còn quyền; có giá trị = đã thu hồi
}

// Dùng database sessions (Prisma adapter) thay JWT để thu hồi quyền tức thời.
// Auth.js cần thêm các model chuẩn của adapter: Account, Session, VerificationToken
// (theo schema mẫu của @auth/prisma-adapter).

model Holding {
  id           String        @id @default(cuid())
  userId       String        // mỗi danh mục thuộc về đúng một người dùng
  user         User          @relation(fields: [userId], references: [id])
  type         AssetType
  symbol       String        // mã CP/quỹ, loại vàng, mã trái phiếu
  name         String?
  unit         String        @default("cổ phần") // "chỉ", "lượng", "trái phiếu"...
  cashflows    Cashflow[]
  dividends    Dividend[]
  snapshots    Snapshot[]
  navOverrides NavOverride[]
  createdAt    DateTime      @default(now())

  @@index([userId])
}

model Cashflow {
  id           String       @id @default(cuid())
  holdingId    String
  holding      Holding      @relation(fields: [holdingId], references: [id])
  type         CashflowType
  date         DateTime
  quantity     Decimal
  pricePerUnit Decimal
  amount       Decimal      // dấu +/- dùng trực tiếp cho XIRR
  taxAmount    Decimal      @default(0)
  feeAmount    Decimal      @default(0)
  note         String?
  createdAt    DateTime     @default(now())
}

model Dividend {
  id            String        @id @default(cuid())
  holdingId     String
  holding       Holding       @relation(fields: [holdingId], references: [id])
  type          DividendType
  date          DateTime
  grossAmount   Decimal?      // type = CASH: cổ tức gộp trước thuế
  taxAmount     Decimal?      // type = CASH: thuế TNCN tự khấu trừ (~5%)
  netAmount     Decimal?      // type = CASH: thực nhận sau thuế = dòng tiền dương cho XIRR
  stockQuantity Decimal?      // type = STOCK: cộng thêm số lượng nắm giữ (không phát sinh tiền)
  note          String?
}

model Snapshot {
  id        String          @id @default(cuid())
  holdingId String?         // null = snapshot tổng cả danh mục
  holding   Holding?        @relation(fields: [holdingId], references: [id])
  date      DateTime
  value     Decimal
  source    SnapshotSource
  period    SnapshotPeriod
  frozen    Boolean         @default(true) // false chỉ cho period = TODAY (tính động, không lưu thật)
}

model NavOverride {
  id        String   @id @default(cuid())
  holdingId String
  holding   Holding  @relation(fields: [holdingId], references: [id])
  date      DateTime
  price     Decimal
  note      String?
}

enum SettingValueType {
  DECIMAL
  INT
  STRING
  BOOLEAN
  DATE
}

// Bảng master cấu hình được (thay TaxRule cũ) — gom mọi tham số chính sách:
// thuế bán theo loại (SALE_TAX_STOCK...), thuế cổ tức (DIVIDEND_TAX_RATE), v.v.
// Effective dating: mỗi key có nhiều dòng theo thời gian; giá trị áp dụng cho
// một ngày = dòng có effectiveFrom lớn nhất mà <= ngày đó.
model Setting {
  id            String           @id @default(cuid())
  key           String           // khóa máy, vd "SALE_TAX_STOCK", "DIVIDEND_TAX_RATE"
  value         String           // giá trị dạng chuỗi, parse theo valueType
  valueType     SettingValueType
  label         String           // mô tả người đọc, vd "Thuế bán cổ phiếu (%)"
  group         String           // gom nhóm (ngữ cảnh cho người sửa DB), vd "TAX", "DISPLAY"
  unit          String?          // đơn vị hiển thị, vd "%", "VND"
  effectiveFrom DateTime         // thời điểm giá trị này bắt đầu có hiệu lực
  updatedBy     String?          // ai đổi (audit)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@unique([key, effectiveFrom])
  @@index([key, effectiveFrom])
}
```

## Ghi chú thiết kế

- **Một bảng `Holding` cho cả 4 loại tài sản**, phân biệt bằng `AssetType` (STOCK/FUND/BOND/GOLD). Không tách bảng riêng theo loại — vì mục tiêu là phân tích *toàn danh mục* (tổng NAV, XIRR, phân bổ), tách bảng sẽ buộc `UNION` khắp nơi và quan hệ đa hình cho `Cashflow`/`Dividend`/`Snapshot`. Khác biệt giữa các loại xử lý bằng field, không bằng bảng: `unit` (vàng chỉ/lượng), `NavOverride` (nhập tay cho vàng/trái phiếu), và (nếu cần) vài cột nullable cho chi tiết trái phiếu — thêm sau khi thật cần.
- **CCQ (chứng chỉ quỹ) đều là `AssetType = FUND`** bất kể là quỹ cổ phiếu hay quỹ trái phiếu — phân loại "theo vỏ" sản phẩm, không theo phơi nhiễm kinh tế. Biểu đồ phân bổ giữ 4 nhóm; không có field `fundKind`.
- **`User`** tách dữ liệu theo từng người: mỗi `Holding` gắn với đúng một `userId`, mọi bảng con (`Cashflow`, `Dividend`, `Snapshot`, `NavOverride`) đi theo qua quan hệ với `Holding` nên không cần lặp lại `userId`. Snapshot tổng danh mục (`holdingId = null`) sẽ cần thêm `userId` riêng khi triển khai để biết thuộc về ai. Tài khoản do quản trị tạo/mời (không mở đăng ký công khai) — phù hợp tính chất phi thương mại.
- **`User.hideAmountsByDefault`** lưu trạng thái mặc định của chế độ ẩn số tiền trên dashboard theo từng người. Đây là che ở tầng hiển thị: chỉ ẩn giá trị tiền tuyệt đối (NAV, lãi/lỗ bằng đồng → `••••••`), **giữ nguyên** XIRR và các phần trăm. Trên dashboard có nút bật/tắt nhanh; giá trị này chỉ quyết định trạng thái khi mở app.
- **Vị thế mở ban đầu** (khi khởi tạo, không import lịch sử) được mô hình hóa như **một `Cashflow` kiểu BUY** đặt tại ngày mốc: `quantity` = số lượng đang giữ, `pricePerUnit` = giá vốn bình quân, `amount` = số âm tương ứng. Không cần model riêng — XIRR tính từ mốc này trở đi.
- **`Cashflow.amount`** mang dấu sẵn (âm khi mua, dương khi bán) để dùng trực tiếp trong chuỗi dòng tiền XIRR, tránh phải suy luận dấu ở tầng tính toán.
- **`Dividend`** tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền — chỉ tăng `stockQuantity` nắm giữ, không ảnh hưởng XIRR trực tiếp (chỉ ảnh hưởng gián tiếp qua NAV tăng do số lượng tăng).
- **Cổ tức tiền mặt tự khấu trừ thuế:** khi ghi cổ tức tiền mặt, app tự trừ thuế TNCN (~5% ở VN) → lưu `grossAmount`, `taxAmount`, `netAmount`. **Dòng tiền dương đưa vào XIRR là `netAmount` (số thực nhận sau thuế)**. Cổ tức bằng cổ phiếu chỉ tăng số lượng, thuế xử lý khi bán (để sau).
- **`Snapshot.holdingId = null`** dùng cho snapshot tổng danh mục (tổng NAV mọi tài sản tại 1 mốc) — cần cho biểu đồ NAV theo thời gian ở mục 03-roadmap.
- **`NavOverride`** tách bảng riêng thay vì 1 field `nav_override` trên `Holding`, vì giá override có thể thay đổi theo từng ngày (không chỉ 1 giá cố định) — quan trọng với vàng/trái phiếu nhập tay thường xuyên.
- **`Setting` (bảng master cấu hình):** thay `TaxRule`, gom mọi tham số chính sách chỉnh được mà không sửa code. Thuế bán để theo key mỗi loại (`SALE_TAX_STOCK`, `SALE_TAX_FUND`, `SALE_TAX_BOND`, `SALE_TAX_GOLD`), thuế cổ tức `DIVIDEND_TAX_RATE`.
  - **Effective dating:** mỗi `key` có thể có nhiều dòng theo thời gian. **Giá trị áp dụng cho một ngày** = dòng cùng `key` có `effectiveFrom` lớn nhất mà `<= ngày` cần tra (không dùng `effectiveTo` để tránh lỗi chồng lấn khoảng). Nhờ vậy, nhập giao dịch lùi ngày vẫn áp đúng thuế suất của thời điểm đó.
  - `valueType` bắt buộc để parse an toàn (thuế là `DECIMAL`). `updatedBy`/`updatedAt` để audit thay đổi chính sách.
  - **Vẫn cần xác nhận mức % cụ thể** trước khi seed (điểm còn mở): bán ~0.1%, cổ tức ~5%.

Đây là bản nháp — sẽ tinh chỉnh khi bắt đầu code (vd cân nhắc `Decimal` precision, index theo `holdingId + date`, unique constraint cho snapshot theo mốc đã đóng băng).
