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
  PERIODIC  // snapshot định kỳ (tháng/tuần) — lịch nằm trong cron workflow, không phải Setting
  YEAR_END
  MANUAL
  TODAY
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  emailVerified       DateTime? // bắt buộc theo adapter model Auth.js (PrismaAdapter.createUser ghi khi đăng nhập lần đầu)
  image               String?   // avatar Google — bắt buộc theo adapter model Auth.js
  hideAmountsByDefault Boolean  @default(false) // trạng thái mặc định của chế độ ẩn số tiền trên dashboard
  holdings            Holding[]
  snapshots           Snapshot[]
  accounts            Account[]
  sessions            Session[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// Auth.js (@auth/prisma-adapter) — database sessions để revoke được ngay lập tức
// (xóa Session khi thu hồi AllowedUser, không cần đợi JWT hết hạn).
model Account {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?  @db.Text
  access_token      String?  @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?  @db.Text
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  createdAt  DateTime @default(now())

  @@unique([identifier, token])
}

// Allowlist "chỉ người được mời" — gate ở signIn callback của Auth.js.
// Soft-delete bằng revokedAt để giữ audit; xóa cứng sẽ mất lịch sử.
model AllowedUser {
  id        String    @id @default(cuid())
  email     String    @unique
  canInvite Boolean   @default(false) // true = được phép mời người khác (chỉ cấp qua DB)
  invitedBy String?   // email người đã mời (null nếu là admin seed)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  revokedAt DateTime? // null = còn quyền; có giá trị = đã thu hồi
}

model Holding {
  id           String        @id @default(cuid())
  userId       String        // mỗi danh mục thuộc về đúng một người dùng
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  type         AssetType
  symbol       String        // mã CP/quỹ, loại vàng, mã trái phiếu
  name         String?
  unit         String        // đơn vị số lượng theo loại tài sản — "cổ phần", "chỉ", "lượng", "trái phiếu"...; app phải set tường minh khi tạo Holding, không có default chung cho mọi loại
  quantity     Decimal       @default(0) @db.Decimal(20, 4) // materialized cache: SL đang giữ hiện tại (nguồn sự thật = Cashflow; recompute-in-transaction)
  avgCost      Decimal       @default(0) @db.Decimal(20, 4) // materialized cache: giá vốn bình quân di động hiện tại
  parValue              Decimal?  @db.Decimal(20, 4) // Phase 8, chỉ BOND: mệnh giá trái phiếu
  couponRatePercent     Decimal?  @db.Decimal(20, 4) // Phase 8, chỉ BOND: lãi suất coupon danh nghĩa (%/năm)
  couponFrequencyMonths Int?                          // Phase 8, chỉ BOND: kỳ trả lãi (tháng), vd 6/12
  maturityDate          DateTime?                     // Phase 8, chỉ BOND: ngày đáo hạn
  nextCouponDate        DateTime?                     // Phase 8, chỉ BOND: ngày dự kiến trả lãi kỳ tới, tự cập nhật sau mỗi lần ghi trái tức
  cashflows    Cashflow[]
  dividends    Dividend[]
  snapshots    Snapshot[]
  navOverrides NavOverride[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([userId, symbol, type]) // một vị thế/user cho mỗi (mã, loại) — mua trùng mã tự gộp; cũng phục vụ lookup theo userId (leftmost prefix, không cần @@index([userId]) riêng)
}

model Cashflow {
  id           String       @id @default(cuid())
  holdingId    String
  holding      Holding      @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  type         CashflowType
  date         DateTime
  quantity     Decimal      @db.Decimal(20, 4)
  pricePerUnit Decimal      @db.Decimal(20, 4)
  amount       Decimal      @db.Decimal(20, 4) // dấu +/- dùng trực tiếp cho XIRR
  taxAmount    Decimal      @default(0) @db.Decimal(20, 4)
  feeAmount    Decimal      @default(0) @db.Decimal(20, 4)
  note         String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([holdingId, date])
}

model Dividend {
  id            String        @id @default(cuid())
  holdingId     String
  holding       Holding       @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  type          DividendType
  date          DateTime
  paymentDate   DateTime? // ngày tiền/CP thực về tài khoản — thuần thông tin, KHÔNG dùng cho tính toán nào (xem docs/domain/03-dividends.md)
  grossAmount   Decimal?      @db.Decimal(20, 4) // type = CASH: cổ tức gộp trước thuế
  taxAmount     Decimal?      @db.Decimal(20, 4) // type = CASH: thuế TNCN tự khấu trừ (~5%)
  netAmount     Decimal?      @db.Decimal(20, 4) // type = CASH: thực nhận sau thuế = dòng tiền dương cho XIRR
  stockQuantity Decimal?      @db.Decimal(20, 4) // type = STOCK: cộng thêm số lượng nắm giữ (không phát sinh tiền)
  note          String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([holdingId, date])
}

model Snapshot {
  id        String          @id @default(cuid())
  userId    String          // chủ sở hữu — luôn set, kể cả khi holdingId null (snapshot tổng danh mục), để mọi truy vấn filter được theo user
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  holdingId String?         // null = snapshot tổng cả danh mục
  holding   Holding?        @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  date      DateTime
  value     Decimal         @db.Decimal(20, 4)
  source    SnapshotSource
  period    SnapshotPeriod
  frozen    Boolean         @default(true) // false chỉ cho period = TODAY (tính động, không lưu thật)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @default(now()) @updatedAt // phản ánh lần chốt GẦN NHẤT khi re-chốt MANUAL trong ngày (upsert idempotent); @default(now()) cần để backfill NOT NULL vì cột được thêm vào bảng đã có dữ liệu (migration `add_snapshot_updated_at`, issue #37)

  @@index([userId, date])
  @@index([holdingId, date])
  // NOTE: dedup cho snapshot đã đóng băng — tối đa 1 dòng frozen cho mỗi
  // (userId, date, period) khi holdingId null, và mỗi (holdingId, date, period)
  // khi holdingId not null. KHÔNG khai báo bằng @@unique ở đây vì Prisma DSL
  // không hỗ trợ WHERE cho @@unique (cần loại trừ NULL != NULL của Postgres
  // trong unique index thường) — 2 partial unique index này chỉ tồn tại dưới
  // dạng raw SQL trong migration `add_snapshot_unique_constraint`. Xem
  // mục "Ghi chú thiết kế" bên dưới.
}

model NavOverride {
  id        String   @id @default(cuid())
  holdingId String
  holding   Holding  @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date // NGÀY (date-only) — nhập từ <input type="date">, khớp PriceQuote.date
  price     Decimal  @db.Decimal(20, 4)
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([holdingId, date]) // 1 giá nhập tay / vị thế / ngày — đích upsert idempotent của saveNavOverride
  @@index([holdingId, date])
}

// Giá tự động (EOD) — job Python ghi, app chỉ đọc. Dùng chung, không theo user.
model PriceQuote {
  id        String   @id @default(cuid())
  symbol    String   // mã theo vnstock (cổ phiếu/quỹ)
  date      DateTime @db.Date // NGÀY (date-only, không phần giờ) — để @@unique đảm bảo 1 giá/mã/ngày
  price     Decimal  @db.Decimal(20, 4) // VND / cổ phần
  source    String   // nguồn, vd "vnstock"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([symbol, date]) // 1 giá / mã / ngày — đích upsert idempotent của job; cũng phục vụ lookup theo (symbol, date)
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

  @@unique([key, effectiveFrom]) // cũng phục vụ lookup theo (key, effectiveFrom)
}
```

## Ghi chú thiết kế

- **Một bảng `Holding` cho cả 4 loại tài sản**, phân biệt bằng `AssetType` (STOCK/FUND/BOND/GOLD). Không tách bảng riêng theo loại — vì mục tiêu là phân tích *toàn danh mục* (tổng NAV, XIRR, phân bổ), tách bảng sẽ buộc `UNION` khắp nơi và quan hệ đa hình cho `Cashflow`/`Dividend`/`Snapshot`. Khác biệt giữa các loại xử lý bằng field, không bằng bảng: `unit` (vàng chỉ/lượng), `NavOverride` (nhập tay cho vàng/trái phiếu), và (nếu cần) vài cột nullable cho chi tiết trái phiếu — thêm sau khi thật cần.
- **CCQ (chứng chỉ quỹ) đều là `AssetType = FUND`** bất kể là quỹ cổ phiếu hay quỹ trái phiếu — phân loại "theo vỏ" sản phẩm, không theo phơi nhiễm kinh tế. Biểu đồ phân bổ giữ 4 nhóm; không có field `fundKind`.
- **Một vị thế cho mỗi `(userId, symbol, type)`** — ràng buộc `@@unique([userId, symbol, type])`. Khi mua mã đã giữ, hệ thống **find-or-create**: gắn `Cashflow` BUY vào `Holding` sẵn có (không tạo Holding trùng) → giá vốn bình quân gia quyền luôn đúng. Cùng `symbol` khác `type` vẫn là hai Holding (được phép). Bán hết rồi mua lại dùng lại chính Holding đó (SL về 0 rồi tăng).
- **`Holding.quantity`/`avgCost` là materialized cache của vị thế**, không phải nguồn sự thật (vẫn là `Cashflow`). Lý do: màn Danh mục chỉ cần vài con số/holding nhưng để suy ra `avgCost` (bình quân di động có reset) phải replay **toàn bộ** cashflow — kể cả `select` hẹp vẫn phình theo lịch sử giao dịch. Materialize để đọc thuần 2 cột. **Bất biến chống lệch:** chỉ ghi lại bằng `derivePosition(toàn bộ cashflow)` trong cùng transaction với mọi thay đổi cashflow (4 action mua/bán → `persistPosition`), không cộng/trừ tay. Backfill dữ liệu cũ chạy tự động 1 lần/DB qua data migration `20260711092933_backfill_holding_position` (cùng `migrate deploy`). Xem `process/DECISION.md` (2026-07-11) — quyết định này **đảo** ghi chú "giá vốn không lưu cứng" ban đầu.
- **`User`** tách dữ liệu theo từng người: mỗi `Holding` gắn với đúng một `userId`, các bảng con (`Cashflow`, `Dividend`, `NavOverride`) đi theo qua quan hệ với `Holding` nên không cần lặp lại `userId`. **`Snapshot` có `userId` riêng** (không chỉ qua `Holding`) vì snapshot tổng danh mục (`holdingId = null`) vẫn cần biết thuộc về ai. Tài khoản do quản trị tạo/mời (không mở đăng ký công khai) — phù hợp tính chất phi thương mại.
- **`User.hideAmountsByDefault`** lưu trạng thái mặc định của chế độ ẩn số tiền trên dashboard theo từng người. Đây là che ở tầng hiển thị: chỉ ẩn giá trị tiền tuyệt đối (NAV, lãi/lỗ bằng đồng → `••••••`), **giữ nguyên** XIRR và các phần trăm. Trên dashboard có nút bật/tắt nhanh; giá trị này chỉ quyết định trạng thái khi mở app.
- **Vị thế mở ban đầu** (khi khởi tạo, không import lịch sử) được mô hình hóa như **một `Cashflow` kiểu BUY** đặt tại ngày mốc: `quantity` = số lượng đang giữ, `pricePerUnit` = giá vốn bình quân, `amount` = số âm tương ứng. Không cần model riêng — XIRR tính từ mốc này trở đi.
- **`Cashflow.amount`** mang dấu sẵn (âm khi mua, dương khi bán) để dùng trực tiếp trong chuỗi dòng tiền XIRR, tránh phải suy luận dấu ở tầng tính toán.
- **`Dividend`** tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền — chỉ tăng `stockQuantity` nắm giữ, không ảnh hưởng XIRR trực tiếp (chỉ ảnh hưởng gián tiếp qua NAV tăng do số lượng tăng).
- **Cổ tức tiền mặt tự khấu trừ thuế:** khi ghi cổ tức tiền mặt, app tự trừ thuế TNCN (~5% ở VN) → lưu `grossAmount`, `taxAmount`, `netAmount`. **Dòng tiền dương đưa vào XIRR là `netAmount` (số thực nhận sau thuế)**. Cổ tức bằng cổ phiếu chỉ tăng số lượng, thuế xử lý khi bán (để sau).
- **`Snapshot.holdingId = null`** dùng cho snapshot tổng danh mục (tổng NAV mọi tài sản tại 1 mốc) — cần cho biểu đồ NAV theo thời gian ở mục 03-roadmap.
- **Dedup snapshot đã đóng băng — 2 partial unique index, không phải `@@unique`.** Khóa duy nhất là `(userId, date, period)` cho snapshot tổng danh mục (`holdingId = null`) và `(holdingId, date, period)` cho snapshot theo từng vị thế. `period` **phải** nằm trong khóa vì cùng một `date` lịch (vd 31/12) có thể hợp lệ sinh ra **2 dòng khác nhau**: cron tháng (`PERIODIC`, fire 01/01 ghi cho 31/12 năm trước) và cron cuối năm (`YEAR_END`, cũng fire 01/01 ghi cho cùng 31/12) — không phải trùng lặp mà là 2 mốc báo cáo khác mục đích. Vì `holdingId` nullable và Postgres coi mỗi `NULL` là khác biệt trong unique index thường (không tự loại trùng khi `holdingId` đều null), một `@@unique([userId, date, period])` khai trong `schema.prisma` **không** chặn được nhiều dòng snapshot tổng danh mục trùng mốc. Prisma DSL cũng không hỗ trợ `WHERE` cho `@@unique` nên không thể tự thu hẹp bằng field. Giải pháp: 2 **partial unique index** viết tay bằng raw SQL (`CREATE UNIQUE INDEX ... WHERE "holdingId" IS NULL` / `WHERE "holdingId" IS NOT NULL`) trong migration `add_snapshot_unique_constraint`, chỉ đánh dấu bằng comment `// NOTE:` cạnh model `Snapshot` trong `schema.prisma` (không có block `@@unique` tương ứng). Vì đây không phải cấu trúc khai báo được ở DSL, các lần `prisma migrate dev` sau không diff/drop nhầm 2 index này. Xem `process/DECISION.md` (2026-07-14).
- **`Snapshot.updatedAt` — riêng khác các `updatedAt` khác trong schema, có `@default(now())` cùng `@updatedAt`.** Thêm ở issue #37 để "Đã chốt lúc HH:mm" (`MANUAL`) phản ánh đúng lần chốt **gần nhất** khi user bấm "Chốt số liệu hôm nay" nhiều lần trong ngày (upsert idempotent, không phải `createdAt` — chỉ set lúc INSERT đầu tiên, không đổi khi UPDATE đè giá trị). `@default(now())` cần thiết vì cột được thêm vào bảng `Snapshot` **đã có dữ liệu** (cron #36 đã chạy trước đó) — bảng không rỗng cần backfill NOT NULL, khác các `updatedAt` khác trong schema chỉ được tạo cùng lúc với bảng nên không cần default. Prisma Client vẫn luôn set giá trị tường minh qua `create`/`update`/`upsert`, hiếm khi thật sự rơi vào nhánh dùng DB default. `jobs/snapshot-cron/main.py` ghi trực tiếp qua raw SQL (không qua Prisma Client) nên phải tự set `"updatedAt" = now()` ở cả `INSERT` lẫn `DO UPDATE SET` (mirror `save_price` ở `jobs/price-fetcher/main.py`). Xem `process/DECISION.md` (2026-07-15, issue #37).
- **`NavOverride`** tách bảng riêng thay vì 1 field `nav_override` trên `Holding`, vì giá override có thể thay đổi theo từng ngày (không chỉ 1 giá cố định) — quan trọng với vàng/trái phiếu nhập tay thường xuyên. `date` là **`@db.Date`** (không có giờ, khớp `PriceQuote.date`) và có **`@@unique([holdingId, date])`** — 1 giá nhập tay/vị thế/ngày, làm đích `upsert` idempotent cho Server Action `saveNavOverride` (sửa giá cùng ngày ghi đè, không tạo dòng trùng). Xem `process/DECISION.md` (2026-07-12).
- **`PriceQuote` (giá tự động):** job Python ghi giá EOD từ vnstock vào đây, app **chỉ đọc**. Là bảng **dùng chung theo `symbol`** (không theo user, không gắn `Holding`) — nhiều user giữ cùng mã chia sẻ một giá. Định giá một `Holding` tại ngày D: ưu tiên `NavOverride` (nhập tay), nếu không có thì tra `PriceQuote` của mã đó (giá có `date` gần nhất ≤ D — cho ngày nghỉ/lễ). `@@unique([symbol, date])` là đích upsert idempotent của job. `symbol` ở đây là mã vnstock; nếu sau này cần phân biệt trùng mã khác loại, thêm cột thị trường/loại.
- **`Setting` (bảng master cấu hình):** thay `TaxRule`, gom mọi tham số chính sách chỉnh được mà không sửa code. Thuế bán để theo key mỗi loại (`SALE_TAX_STOCK`, `SALE_TAX_FUND`, `SALE_TAX_BOND`, `SALE_TAX_GOLD`), thuế cổ tức `DIVIDEND_TAX_RATE`, và **phí giao dịch** (`TRANSACTION_FEE_BUY_<LOẠI>`/`TRANSACTION_FEE_SELL_<LOẠI>`, 8 key — mới, xem `process/DECISION.md` 2026-07-18 (4)).
  - **Effective dating:** mỗi `key` có thể có nhiều dòng theo thời gian. **Giá trị áp dụng cho một ngày** = dòng cùng `key` có `effectiveFrom` lớn nhất mà `<= ngày` cần tra (không dùng `effectiveTo` để tránh lỗi chồng lấn khoảng). Nhờ vậy, nhập giao dịch lùi ngày vẫn áp đúng thuế suất của thời điểm đó.
  - `valueType` bắt buộc để parse an toàn (thuế là `DECIMAL`). `updatedBy`/`updatedAt` để audit thay đổi chính sách.
  - **Vẫn cần xác nhận mức % cụ thể** trước khi seed (điểm còn mở): bán ~0.1%, cổ tức ~5%, phí mua/bán `STOCK` = 0.3% (đã xác nhận, theo TPS) — `FUND`/`BOND`/`GOLD` chưa chốt, mặc định seed `0`.

Ba điểm "sẽ tinh chỉnh khi bắt đầu code" ghi ở bản nháp gốc nay đã chốt: `Decimal` precision (`@db.Decimal(20, 4)` trên mọi field tiền), index theo `holdingId + date` (`@@index([holdingId, date])` ở `Cashflow`/`Dividend`/`Snapshot`), và unique constraint cho snapshot theo mốc đã đóng băng (2 partial unique index, xem mục "Ghi chú thiết kế" phía trên).
