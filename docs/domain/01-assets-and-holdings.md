# Assets & Holdings

## Mục đích
Định nghĩa các loại tài sản Navtrack theo dõi và cách một vị thế nắm giữ (`Holding`) được mô hình hóa.

## Entity / field
- `Holding`: `userId`, `type` (`AssetType`), `symbol`, `name?`, `unit`, `quantity`, `avgCost`, quan hệ tới `Cashflow`/`Dividend`/`NavOverride`/`Snapshot`.
- `quantity`/`avgCost`: **materialized cache** của vị thế hiện tại (SL đang giữ + giá vốn bình quân) — dẫn xuất từ `Cashflow`, không phải nguồn độc lập; xem bất biến bên dưới và `02-transactions-and-cost-basis.md`.
- `AssetType` enum: `STOCK`, `FUND`, `BOND`, `GOLD`.

## Quy tắc & bất biến
- **Một bảng `Holding` cho cả 4 loại**, phân biệt bằng `type`. Không tách bảng theo loại (lý do: phân tích toàn danh mục — xem `02-data-model.md`).
- **CCQ (chứng chỉ quỹ) đều là `FUND`** bất kể quỹ cổ phiếu hay quỹ trái phiếu — phân loại theo *vỏ sản phẩm*, không theo phơi nhiễm kinh tế. Không có field `fundKind`.
- Mỗi `Holding` thuộc về đúng **một user** (`userId`).
- **`unit`** mô tả đơn vị nắm giữ, khác nhau theo loại:
  - STOCK/FUND: cổ phần / chứng chỉ quỹ.
  - GOLD: chỉ hoặc lượng (1 lượng = 10 chỉ) — phải chọn rõ.
  - BOND: trái phiếu (theo mệnh giá).
- **`symbol`** ở Phase 1 là **nhập tay tự do** (chưa validate với danh sách vnstock, chưa autocomplete). Chỉ là nhãn cho tới khi tích hợp giá (Phase 2).
- Số lượng nắm giữ (`quantity`) và giá vốn bình quân (`avgCost`) **dẫn xuất từ chuỗi giao dịch** (`Cashflow`) — **nguồn sự thật là `Cashflow`**. Hai cột này chỉ là **materialized cache**: được ghi lại bằng cách replay toàn bộ cashflow trong **cùng transaction** với mọi thay đổi cashflow (không cộng/trừ tay), nên luôn khớp nguồn (xem `02-transactions-and-cost-basis.md`). Materialize để màn Danh mục đọc thuần, không phải replay lịch sử mỗi lần.
- **Vị thế đóng (SL = 0):** khi bán hết, `Holding` **vẫn giữ lại** (không xóa) — lãi/lỗ đã hiện thực hóa, NAV = 0. Vị thế đóng **ẩn khỏi dashboard chính**, hiện ở tab **"Đã đóng"**; nhưng **vẫn tính vào tổng hiệu quả danh mục** (XIRR + tổng lãi/lỗ) vì là lợi nhuận thật đã thu. Trạng thái "đóng/mở" **suy ra từ SL** (`quantity == 0` ⇒ đóng) — đọc trực tiếp từ cache `quantity`, không phải cột trạng thái lưu riêng.

## Cách tính
- **Số lượng hiện tại** = Σ(BUY.quantity) − Σ(SELL.quantity) + Σ(dividend STOCK.stockQuantity). Cache `Holding.quantity` phản ánh **cả BUY/SELL lẫn cổ tức cổ phiếu** — đường ghi cổ tức cổ phiếu (`features/dividends/actions.ts::recordDividend`, Phase 4/#52) **cộng thẳng `stockQuantity` vào cache hiện có** trong cùng transaction, không recompute lại toàn bộ (cổ tức chỉ CỘNG THÊM, không có nhánh "bán vượt" cần validate lại từ đầu). `avgCost` giữ nguyên khi nhận cổ tức cổ phiếu (không đổi giá vốn bình quân) — xem `03-dividends.md`.
- **4 action mua/bán** (`features/holdings/actions.ts::createHolding/addTransaction/updateTransaction/deleteTransaction`) ghi cache bằng `derivePositionIncludingStockDividends()` (`lib/cost-basis.ts`) — **KHÔNG PHẢI** `derivePosition()` đơn thuần (issue #59, `process/DECISION.md` 2026-07-16 (4)): `derivePosition()` chỉ biết `Cashflow`, dùng một mình sẽ (1) ghi đè mất phần `stockQuantity` đã cộng ở cache mỗi khi có giao dịch mua/bán sau đó, và (2) báo "bán vượt" SAI cho một lệnh bán mà SL bán nằm trong phần cổ tức cổ phiếu đã nhận (không phải mua). `derivePositionIncludingStockDividends()` kết hợp `avgCost` từ `derivePosition()` (chỉ dẫn xuất từ Cashflow, không đổi vì cổ tức) với SL phát lại đúng thứ tự thời gian gồm cả `Dividend{STOCK}` qua `buildQuantityTimeline()` (`lib/position-trail.ts`, dùng chung cả `features/holdings/` lẫn `features/dividends/`).
- `getHoldingDetail()` (`features/holdings/queries.ts`, tính "vị thế TẠI cutoff") cũng dùng `derivePositionIncludingStockDividends()`, không dùng `derivePosition()` — cùng lý do trên.
- Danh sách 4 nhóm dùng cho biểu đồ phân bổ chính là `AssetType`.

## Ca biên
- **Vàng đổi đơn vị:** không tự quy đổi chỉ↔lượng; giữ nhất quán một `unit` cho mỗi `Holding`. Nếu người dùng nhập lẫn, coi là dữ liệu sai — validate ở form.
- **Một vị thế cho mỗi `(userId, symbol, type)`** — ràng buộc `@@unique([userId, symbol, type])`. **Mua mã đã giữ → tự gộp** (find-or-create): giao dịch gắn vào `Holding` sẵn có, không tạo Holding trùng. Nhờ vậy bình quân gia quyền luôn đúng và vị thế không bị phân mảnh.
- **Trùng mã khác loại:** cùng `symbol` nhưng khác `type` (vd hiếm gặp) là **hai Holding riêng** — được phép vì khóa duy nhất gồm cả `type`. Khóa định danh vẫn là `Holding.id`.
- **Bán hết rồi mua lại:** dùng lại **chính `Holding` đó** (SL về 0 rồi tăng); giá vốn bình quân bắt đầu lại từ lần mua mới.

## Ví dụ
- Mua 100 cổ phần `FPT` → `Holding{ type: STOCK, symbol: "FPT", unit: "cổ phần" }`.
- Giữ 2 lượng vàng SJC → `Holding{ type: GOLD, symbol: "SJC", unit: "lượng" }`.
- Quỹ trái phiếu TCBF → `Holding{ type: FUND, symbol: "TCBF" }` (vẫn nhóm "Quỹ").
