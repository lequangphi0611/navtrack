# Users, Access & Privacy

## Mục đích
Định nghĩa ai được vào app, cách dữ liệu tách biệt giữa người dùng, và chế độ ẩn số tiền.

## Entity / field
- `User`: `email` (unique), `name?`, `hideAmountsByDefault`, quan hệ `holdings`.
- `AllowedUser`: `email` (unique), `invitedBy?`, `createdAt`, `revokedAt?` — allowlist "chỉ người được mời".
- Model chuẩn Auth.js adapter: `Account`, `Session`, `VerificationToken` (dùng **database sessions**).

## Quy tắc & bất biến
- **Chỉ người được mời** (không mở đăng ký công khai):
  - Đăng nhập bằng **Google OAuth** (Auth.js).
  - Chặn tại **`signIn` callback**: chỉ cho vào nếu email có trong `AllowedUser`, **chưa `revokedAt`**, và **`email_verified`**.
  - **Không** allowlist theo `@gmail.com`; **không** tự chuẩn hóa dấu chấm Gmail.
  - Một admin email seed để bootstrap.
- **Thu hồi tức thời:** dùng **database sessions** → set `revokedAt` + xóa `Session` row là mất quyền ngay (không chờ token hết hạn). Mời/thu hồi **không cần redeploy**.
- **Tách dữ liệu theo user (bất biến bảo mật):** mỗi `Holding` (và mọi entity con) thuộc đúng một user; **mọi truy vấn PHẢI filter theo `userId` của phiên đăng nhập**. Không bao giờ tin `userId` từ client — lấy từ session qua `auth()` (xem `rules/data-prisma.md`).

## Chế độ ẩn số tiền (privacy mode)
- **Che số tiền tuyệt đối bằng VND** (NAV, lãi/lỗ, giá vốn → `••••••`), **GIỮ** phần trăm (XIRR, tỷ trọng) và số lượng cổ phần.
  - Lý do: phần trăm là linh hồn app và không tiết lộ bạn có bao nhiêu tiền.
- Che ở **tầng hiển thị** (UI) — dữ liệu vẫn nằm trong DB/network; không phải bảo mật thật, đúng kỳ vọng.
- **Trạng thái đến từ hai nguồn:** mặc định `User.hideAmountsByDefault` (đọc server) + **nút mắt** bật/tắt nhanh trên dashboard (client toggle). Container truyền cờ xuống, leaf không tự đọc.

## Ca biên
- **Session đang chạy khi bị thu hồi:** với database sessions, xóa `Session` → chặn ngay ở request kế tiếp.
- **Người được mời chưa từng login:** có `AllowedUser` nhưng chưa có `User` row; `User` được tạo bởi adapter sau lần login đầu thành công.
- **Ẩn số nhưng vẫn cần xem %:** đảm bảo helper format chỉ che nhánh tiền, không che nhánh phần trăm (xem `rules/component-architecture.md`).

## Ví dụ
- `phi@gmail.com` trong `AllowedUser`, `revokedAt = null`, Google verified → vào được; thấy **chỉ** danh mục của mình.
- Bật ẩn số tiền: "NAV ••••••, XIRR 12%/năm, cổ phiếu 60%".
