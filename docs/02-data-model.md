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

model Holding {
  id           String        @id @default(cuid())
  type         AssetType
  symbol       String        // mã CP/quỹ, loại vàng, mã trái phiếu
  name         String?
  unit         String        @default("cổ phần") // "chỉ", "lượng", "trái phiếu"...
  cashflows    Cashflow[]
  dividends    Dividend[]
  snapshots    Snapshot[]
  navOverrides NavOverride[]
  createdAt    DateTime      @default(now())
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
  cashAmount    Decimal?      // dùng khi type = CASH, dòng tiền dương cho XIRR
  stockQuantity Decimal?      // dùng khi type = STOCK, cộng thêm số lượng nắm giữ
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

// Thuế suất theo loại tài sản — cấu hình được, không hard-code
model TaxRule {
  id          String    @id @default(cuid())
  assetType   AssetType @unique
  ratePercent Decimal   // vd 0.1 cho STOCK (thuế TNCN 0.1% trên giá trị bán)
}
```

## Ghi chú thiết kế

- **`Cashflow.amount`** mang dấu sẵn (âm khi mua, dương khi bán) để dùng trực tiếp trong chuỗi dòng tiền XIRR, tránh phải suy luận dấu ở tầng tính toán.
- **`Dividend`** tách khỏi `Cashflow` vì cổ tức cổ phiếu không phải dòng tiền — chỉ tăng `stockQuantity` nắm giữ, không ảnh hưởng XIRR trực tiếp (chỉ ảnh hưởng gián tiếp qua NAV tăng do số lượng tăng).
- **`Snapshot.holdingId = null`** dùng cho snapshot tổng danh mục (tổng NAV mọi tài sản tại 1 mốc) — cần cho biểu đồ NAV theo thời gian ở mục 03-roadmap.
- **`NavOverride`** tách bảng riêng thay vì 1 field `nav_override` trên `Holding`, vì giá override có thể thay đổi theo từng ngày (không chỉ 1 giá cố định) — quan trọng với vàng/trái phiếu nhập tay thường xuyên.
- **`TaxRule`** để thuế suất không hard-code trong logic, cho phép chỉnh khi quy định thuế thay đổi. Cần xác nhận mức % cụ thể trước khi triển khai (xem điểm còn mở trong `01-business-decisions.md`).

Đây là bản nháp — sẽ tinh chỉnh khi bắt đầu code (vd cân nhắc `Decimal` precision, index theo `holdingId + date`, unique constraint cho snapshot theo mốc đã đóng băng).
