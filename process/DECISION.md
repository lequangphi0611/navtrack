# DECISION — quyết định quan trọng ảnh hưởng docs/domain/rules

File này ghi các **quyết định quan trọng** làm thay đổi business/domain/spec/data model/rules, hoặc root-cause một lỗi non-obvious mà bản thân code không giải thích được lý do. **Không ghi tiến độ thường ở đây** — tiến độ (đã làm gì, còn gì) thuộc về [`PROCESS.md`](./PROCESS.md). Mỗi mục gồm: quyết định, lý do, và docs đã đồng bộ theo.

**Đọc file này trước khi bắt đầu một phase mới** (cùng lúc đọc `PROCESS.md` + `phase-x.md`) để nắm bối cảnh các quyết định trước đó — tránh làm trái hoặc lặp lại tranh luận đã chốt.

## 2026-07-10

**Schema `User` thiếu `emailVerified`/`image` → đăng nhập Google thật lỗi `AdapterError`.**
- Lý do: `PrismaAdapter.createUser` của Auth.js luôn ghi 2 field này khi tạo user lần đầu; model `User` ban đầu chỉ có field tự định nghĩa (`hideAmountsByDefault`...), thiếu 2 field bắt buộc theo adapter contract.
- Docs đã sync: `prisma/schema.prisma` (+ migration `add_user_email_verified_and_image`), `docs/02-data-model.md`.

**`signIn("google")` không truyền `redirectTo` → đăng nhập xong quay lại `/sign-in` thay vì `/holdings`.**
- Lý do: mặc định Auth.js lấy `callbackUrl` từ header `Referer` (chính là `/sign-in`, trang chứa form) khi không truyền `redirectTo` tường minh — không phải bug "không redirect", mà là redirect sai đích. Cộng thêm `SignInPage` chưa check session nên trang login vẫn hiện bình thường dù đã đăng nhập.
- Fix: `signIn("google", { redirectTo: ROUTES.holdings })` tường minh + guard `if (session?.user) redirect(ROUTES.holdings)` đầu `SignInPage`.

**Thêm rule "loading.tsx/skeleton bắt buộc" + "page phải mỏng" vào `component-architecture.md`.**
- Lý do: review lần đầu thiếu `loading.tsx` nhất quán cho các route load data; sau đó `holdings/page.tsx` phình 128 dòng vì nhồi 2 màn hình (trống/danh sách) + 1 component cục bộ ngay trong route file — cả hai đều là lỗ hổng rule khiến việc lặp lại dễ xảy ra ở phase sau.
- Docs đã sync: `docs/rules/component-architecture.md` (2 mục mới kèm ví dụ good/bad).

**Thêm `ROUTES` constants (`src/lib/routes.ts`) và `SETTING_KEYS` constants (`src/lib/settings.ts`).**
- Lý do: route path (`/holdings/${id}`...) và key bảng `Setting` (`"MAX_MEMBERS"`) bị hardcode string rải rác nhiều file — đổi path/key phải grep thủ công cả repo, dễ sót.
- Docs đã sync: `docs/rules/typescript-style.md` (mục "Đường dẫn nội bộ qua constants"), `docs/rules/schema.md` (mục "Key-value config" bổ sung yêu cầu `SETTING_KEYS`).

**Tách màn Cài đặt/Thành viên: `/settings` (menu) tách khỏi `/settings/members` (danh sách) tách khỏi `/settings/members/invite` (form mời).**
- Lý do: layout `/settings/members` cũ quá dài (quota + form mời + danh sách trên cùng 1 màn); đồng thời user không có quyền mời vẫn thấy tổng số thành viên và danh sách allowlist — rò rỉ thông tin không cần thiết cho vai trò của họ.
- Quyết định: user không có quyền mời chỉ thấy 1 dòng từ chối (`MembersDeniedScreen`), không lộ quota/list/section mời; trang mời tách riêng có guard `canInvite` phía server (không chỉ ẩn UI).
- Docs đã sync: `docs/rules/ui-ux-design.md` (thêm molecule `SettingsMenuItem`), `PROCESS.md`.

**Tách nhật ký `PROCESS.md` khỏi quyết định (`DECISION.md` — chính file này).**
- Lý do: `PROCESS.md` phình dài vì mỗi dòng nhật ký vừa ghi tiến độ vừa giải thích lý do quyết định. Từ nay: `PROCESS.md` chỉ ghi 1 dòng ngắn "đã làm gì"; lý do/quyết định kỹ thuật quan trọng chuyển hết vào đây.
- Docs đã sync: `CLAUDE.md` (mục "Tiến trình triển khai" + "Đồng bộ tài liệu khi có quyết định quan trọng").
