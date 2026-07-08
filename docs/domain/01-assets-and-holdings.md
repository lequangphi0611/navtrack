# Assets & Holdings

## Mục đích
Định nghĩa các loại tài sản Navtrack theo dõi và cách một vị thế nắm giữ (`Holding`) được mô hình hóa.

## Entity / field
- `Holding`: `userId`, `type` (`AssetType`), `symbol`, `name?`, `unit`, quan hệ tới `Cashflow`/`Dividend`/`NavOverride`/`Snapshot`.
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
- Số lượng nắm giữ **không lưu trực tiếp** trên `Holding` — nó là **kết quả suy ra** từ chuỗi giao dịch + cổ tức cổ phiếu (xem `02-transactions-and-cost-basis.md`).

## Cách tính
- **Số lượng hiện tại** = Σ(BUY.quantity) − Σ(SELL.quantity) + Σ(dividend STOCK.stockQuantity).
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
