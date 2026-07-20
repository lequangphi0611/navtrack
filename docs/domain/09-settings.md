# Settings resolution (master config)

## Mục đích
App **chỉ đọc / resolve** giá trị cấu hình (thuế bán, thuế cổ tức...). Việc **thêm/sửa giá trị làm trực tiếp trên DB** (Neon SQL console / Prisma Studio) — **không có UI admin**, nằm ngoài phạm vi app. Spec này đặc tả **app resolve một setting như thế nào**, không đặc tả CRUD.

## Entity (tóm tắt)
`Setting`: `key`, `value` (string), `valueType`, `effectiveFrom`, cùng `label`/`group`/`unit` (chỉ là **ngữ cảnh cho người sửa DB** đọc hiểu, app không cần) và audit. Định nghĩa đầy đủ ở [`02-data-model.md`](../02-data-model.md).

## Các key hiện có
| key | group | valueType | ghi chú |
|---|---|---|---|
| `SALE_TAX_STOCK` / `_FUND` / `_BOND` | TAX | DECIMAL | thuế bán theo loại (%), effective-dated theo ngày giao dịch |
| `SALE_TAX_GOLD` | TAX | DECIMAL | seed `0` — cá nhân bán vàng tại VN không chịu thuế TNCN chuyển nhượng (khác chứng khoán); vẫn phải seed tường minh, không được thiếu dòng (xem "Resolution" bên dưới) |
| `TRANSACTION_FEE_BUY_STOCK` / `_FUND` / `_BOND` / `_GOLD` | FEE | DECIMAL | phí mua theo loại (%), effective-dated theo ngày giao dịch — phí công ty chứng khoán (CTCK), không phải thuế; áp cho cả BUY (khác thuế chỉ áp SELL) — xem `07-tax.md` mục "Phí giao dịch" |
| `TRANSACTION_FEE_SELL_STOCK` / `_FUND` / `_BOND` / `_GOLD` | FEE | DECIMAL | phí bán theo loại (%), effective-dated theo ngày giao dịch — cùng cơ chế với phí mua |
| `DIVIDEND_TAX_RATE` | TAX | DECIMAL | thuế cổ tức tiền mặt (%), effective-dated theo ngày chia cổ tức — seed mặc định `5` từ 2020-01-01 |
| `DIVIDEND_PAR_VALUE` | TAX | DECIMAL | mệnh giá dùng tính cổ tức tiền mặt theo % (đ/CP), effective-dated theo ngày chia cổ tức — seed mặc định `10000` từ 2020-01-01 |
| `MAX_MEMBERS` | ACCESS | INT | số thành viên tối đa (đếm `AllowedUser` chưa thu hồi); resolve với `atDate = hôm nay`, không cần effective dating — xem `08-users-access-and-privacy.md` |
| `CONCENTRATION_WARNING_THRESHOLD` | RISK | DECIMAL | ngưỡng % NAV một `Holding` để cảnh báo tập trung; resolve với `atDate = hôm nay`, không cần effective dating — seed mặc định `30` — xem `04-pricing-and-valuation.md` mục "Cảnh báo tập trung" |

> **Không đưa vào `Setting`:** tần suất/ngày chốt NAV — nằm ở **cron của GitHub Actions workflow** (committed config), không phải cấu hình runtime. Xem `06-snapshots.md`.

## Resolution — cách app lấy giá trị

```
resolveSetting(key, atDate):
  rows = Setting WHERE key = key AND effectiveFrom <= atDate
  ORDER BY effectiveFrom DESC
  row = rows.first
  nếu không có row  → THIẾU cấu hình: báo lỗi rõ, KHÔNG mặc định 0/null
  return parse(row.value, row.valueType)
```

- **`atDate` là tham số bắt buộc về mặt ngữ nghĩa:**
  - Giá trị *effective-dated* (thuế) resolve theo **ngày của giao dịch**, không phải ngày hiện tại → giao dịch lùi ngày áp đúng thuế suất thời điểm đó.
  - Cấu hình mang tính "hiện hành" thì dùng `atDate = hôm nay`.
- **Parse theo `valueType`:** `DECIMAL` → `Decimal` (không float), `INT` → integer, `BOOLEAN` → bool, `DATE` → Date, `STRING` → giữ nguyên.
- **Resolve một lần cho một phép tính:** khi tính thuế cho một giao dịch, resolve đúng một lần rồi dùng, không resolve lại giữa chừng (đảm bảo nhất quán trong cùng thao tác).
- **Resolve nhiều key cùng `atDate` trong 1 thao tác:** dùng `resolveSettings(keys, atDate)` (1 query duy nhất, `lib/settings.ts`) thay vì gọi `resolveSetting` nhiều lần — tránh N+1, đáng chú ý khi Phase 5 (thuế bán) cần nhiều key `SALE_TAX_*`/`TRANSACTION_FEE_*` cùng lúc sau này.

## Quy tắc & bất biến
- **Effective dating:** giá trị áp dụng cho `atDate` = dòng cùng `key` có `effectiveFrom` **lớn nhất mà ≤ atDate**. **Không dùng `effectiveTo`** (khoảng suy ra ngầm từ dòng kế tiếp).
- **App là read-only với `Setting`:** không có đường ghi `Setting` từ trong app. Mọi thay đổi do người vận hành làm trực tiếp trên DB.
- **Thiếu cấu hình → lỗi tường minh**, tuyệt đối không âm thầm dùng 0/giá trị mặc định (sai thuế = sai tiền).
- **Guard khi parse:** vì không có UI validate lúc ghi, `value` sai kiểu là dữ liệu hỏng — khi resolve, parse fail phải **báo lỗi rõ** (xem `rules/error-handling.md`), không nuốt.
- **Không hồi tố:** resolve chỉ phục vụ tính toán mới; số đã lưu trên giao dịch cũ (`taxAmount`) không đổi khi `Setting` đổi (xem `07-tax.md`).

## Caching
- `Setting` đổi rất hiếm và app **không tự biết** khi có người sửa DB. Vì vậy:
  - Mặc định **đọc từ DB khi cần** (tần suất thấp, không phải đường nóng) — đơn giản và luôn mới.
  - Nếu cache trong process để giảm query, phải đặt **TTL ngắn** (vd vài phút) chấp nhận độ trễ nhìn thấy thay đổi; không cache vô thời hạn.

## Ca biên
- **Không có dòng nào `effectiveFrom ≤ atDate`** (giao dịch trước mọi mốc cấu hình) → thiếu cấu hình, báo lỗi/không tính được.
- **`value` không parse được theo `valueType`** → lỗi dữ liệu, báo rõ key nào.
- **Vừa sửa trên DB, app còn cache cũ** → chấp nhận độ trễ theo TTL; nếu cần thấy ngay thì không cache.

## Ví dụ
- `DIVIDEND_TAX_RATE`: `5` từ 2020-01-01, `6` từ 2026-01-01.
  - `resolveSetting("DIVIDEND_TAX_RATE", 2025-12-20)` → **5%**
  - `resolveSetting("DIVIDEND_TAX_RATE", 2026-02-01)` → **6%**
- Lệnh bán cổ phiếu ngày 2024-03-01 → `resolveSetting("SALE_TAX_STOCK", 2024-03-01)`.
- Lệnh mua cổ phiếu qua TPS → `resolveSetting("TRANSACTION_FEE_BUY_STOCK", ngày mua)` (seed `0.3` — mức phí TPS đang áp dụng).
