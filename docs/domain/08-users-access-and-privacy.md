# Users, Access & Privacy

## Mục đích
Định nghĩa ai được vào app, cách dữ liệu tách biệt giữa người dùng, và chế độ ẩn số tiền.

## Entity / field
- `User`: `email` (unique), `name?`, `hideAmountsByDefault`, quan hệ `holdings`.
- `AllowedUser`: `email` (unique), `canInvite`, `invitedBy?`, `createdAt`, `revokedAt?` — allowlist "chỉ người được mời".
- Model chuẩn Auth.js adapter: `Account`, `Session`, `VerificationToken` (dùng **database sessions**).

## Quy tắc & bất biến
- **Chỉ người được mời** (không mở đăng ký công khai):
  - Đăng nhập bằng **Google OAuth** (Auth.js).
  - Chặn tại **`signIn` callback**: chỉ cho vào nếu email có trong `AllowedUser`, **chưa `revokedAt`**, và **`email_verified`**.
  - **Không** allowlist theo `@gmail.com`; **không** tự chuẩn hóa dấu chấm Gmail.
  - Một admin email seed để bootstrap.
- **Thu hồi tức thời:** dùng **database sessions** → set `revokedAt` + xóa `Session` row là mất quyền ngay (không chờ token hết hạn). Mời/thu hồi **không cần redeploy**.

## Mời người khác (delegated invitation)
- **Chỉ user có `canInvite = true`** mới thấy chức năng mời và mới mời được. Server action **phải kiểm lại `canInvite` phía server** (không chỉ ẩn UI).
- **Mời** = insert `AllowedUser{ email, canInvite: false, invitedBy: <email người mời>, revokedAt: null }`. Người được mời **luôn `canInvite = false`**.
- **Cấp quyền mời (`canInvite = true`)** cho ai đó **chỉ làm trực tiếp trên DB** — không có đường nâng quyền từ trong app. Admin seed ban đầu có `canInvite = true`.
- Đây là **đường ghi duy nhất của app vào `AllowedUser`** (khác `Setting` vốn chỉ đọc trong app).

## Giới hạn số thành viên
- Số thành viên tối đa cấu hình bằng key **`MAX_MEMBERS`** trong `Setting` (xem `09-settings.md`).
- **Slot đã dùng = số `AllowedUser` có `revokedAt = null`** (gồm cả người được mời nhưng chưa login).
- Trước khi mời: nếu `slot đã dùng >= MAX_MEMBERS` → **từ chối mời**, báo rõ đã đạt giới hạn. Kiểm tra này ở server, trong cùng thao tác mời.
- **Tách dữ liệu theo user (bất biến bảo mật):** mỗi `Holding` (và mọi entity con) thuộc đúng một user; **mọi truy vấn PHẢI filter theo `userId` của phiên đăng nhập**. Không bao giờ tin `userId` từ client — lấy từ session qua `auth()` (xem `rules/data-prisma.md`).

## Chế độ ẩn số tiền (privacy mode)
- **Che số tiền tuyệt đối bằng VND** (NAV, lãi/lỗ, giá vốn → `••••••`), **GIỮ** phần trăm (XIRR, tỷ trọng) và số lượng cổ phần.
  - Lý do: phần trăm là linh hồn app và không tiết lộ bạn có bao nhiêu tiền.
- Che ở **tầng hiển thị** (UI) — dữ liệu vẫn nằm trong DB/network; không phải bảo mật thật, đúng kỳ vọng.
- **Trạng thái đến từ hai nguồn:** mặc định `User.hideAmountsByDefault` (đọc server) + **nút mắt** bật/tắt nhanh trên dashboard (client toggle). Container truyền cờ xuống, leaf không tự đọc.

## Ca biên
- **Session đang chạy khi bị thu hồi:** với database sessions, xóa `Session` → chặn ngay ở request kế tiếp.
- **Người được mời chưa từng login:** có `AllowedUser` nhưng chưa có `User` row; `User` được tạo bởi adapter sau lần login đầu thành công. Vẫn tính vào slot `MAX_MEMBERS`.
- **Mời trùng email:** nếu email đã có `AllowedUser` chưa thu hồi → từ chối ("đã được mời"). Nếu email từng bị thu hồi (`revokedAt` có giá trị) → coi là **tái kích hoạt** (đặt lại `revokedAt = null`), vẫn phải qua kiểm tra `MAX_MEMBERS`.
- **Đạt giới hạn thành viên:** mời bị từ chối với thông điệp rõ.
- **User mất `canInvite` giữa chừng:** kiểm tra ở server tại thời điểm mời, nên mất quyền là không mời được ngay.
- **Ẩn số nhưng vẫn cần xem %:** đảm bảo helper format chỉ che nhánh tiền, không che nhánh phần trăm (xem `rules/component-architecture.md`).

## Ví dụ
- `phi@gmail.com` trong `AllowedUser`, `revokedAt = null`, Google verified → vào được; thấy **chỉ** danh mục của mình.
- `phi` có `canInvite = true` → mời `ban@gmail.com`: insert `AllowedUser{ email: "ban@gmail.com", canInvite: false, invitedBy: "phi@gmail.com" }` (nếu chưa đạt `MAX_MEMBERS`).
- Đã có 5 slot dùng, `MAX_MEMBERS = 5` → `phi` mời tiếp bị từ chối "đã đạt giới hạn thành viên".
- Bật ẩn số tiền: "NAV ••••••, XIRR 12%/năm, cổ phiếu 60%".
