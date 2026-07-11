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

## 2026-07-11

**Xây app như PWA (cài lên màn hình chính) — gộp vào Phase 1, phạm vi cố ý tối giản.**
- Quyết định phạm vi (3 lựa chọn đã chốt qua trao đổi):
  1. **Chỉ installable + cache tài nguyên tĩnh** — không cache số liệu tài chính offline, tránh rủi ro hiện số sai/cũ khi mất mạng cho app tài chính.
  2. **Gộp vào Phase 1** (không tách phase riêng sau Phase 6) — vì Phase 1 đã có code chạy được, dễ làm đúng từ đầu hơn thêm sau.
  3. **Không làm hạ tầng Web Push lần này** — cảnh báo giá vẫn ở Backlog, chưa cần VAPID/push subscription.
- Hiện thực: `src/app/manifest.ts` (Next Metadata file convention), icon PNG sinh từ `scripts/generate-pwa-icons.mjs` (dùng `ImageResponse`/`next/og.js` vẽ lại đúng `LogoMark`, không cần thư viện ảnh ngoài như sharp/rsvg-convert), service worker viết tay `public/sw.js` (không dùng `next-pwa`/Serwist — tránh rủi ro tương thích với Next 16 + Turbopack), `public/offline.html` tĩnh làm fallback khi mất mạng, `ServiceWorkerRegister` chỉ đăng ký ở production (SW cache sẽ phá HMR nếu bật lúc `next dev`).
- Kiểm chứng: `pnpm build` + `next start`, dùng Playwright xác nhận `link[rel=manifest]`, service worker `activated`, và điều hướng khi offline trả về `offline.html` thay vì lỗi trình duyệt.
- Docs đã sync: `docs/04-tech-stack.md` (mục "PWA" mới), `docs/03-roadmap.md` (Phase 1), `docs/rules/project-structure.md` (thêm `scripts/`, `public/` vào cây thư mục), `docs/rules/ui-ux-design.md` (cross-reference icon PWA ↔ `LogoMark`), `docs/business-overview.md`, `process/phase-1.md`.

**Đổi rule cache tầng server: từ "cấm cache cả nắm" → "cache có chọn lọc theo loại dữ liệu".**
- Bối cảnh: rule cũ (`performance.md`) cấm mọi cache dữ liệu ở tầng server. Rà lại thấy lý do gốc gồm 2 mệnh đề khác bản chất: (a) **"số liệu tài chính phải luôn tươi"** — là nguyên tắc domain, giữ; (b) **"Neon đủ nhanh, complexity không đáng cho quy mô hiện tại"** — chính rule tự nói là **điều kiện hoá theo quy mô**, hết đúng khi Phase 2–3 thêm `PriceQuote` (đọc nhiều) + snapshot (bất biến, chart đọc dày).
- Quyết định: cache **theo bản chất từng loại dữ liệu**, không cache/không-cache cả nắm.
  - **Bất biến giữ nguyên (mọi phase):** (1) session/quyền **không bao giờ** cache xuyên request — thu hồi tức thời (`domain/08`), `getSession=cache(auth)` chỉ dedupe trong 1 render; (2) cache key **phải gồm `userId`** cho dữ liệu scoped-user — footgun: `unstable_cache` chỉ đưa **tham số hàm** vào key, đọc `userId` từ `auth()` bên trong hàm cache → mọi user chung 1 entry = **rò dữ liệu** (lỗi bảo mật). Dữ liệu dùng chung (`PriceQuote` theo `symbol`) key theo `symbol`.
  - **Ứng viên cache (khi dữ liệu xuất hiện):** `PriceQuote` (dùng chung, `revalidate` khớp cadence job EOD — không kém tươi hơn thực tế); snapshot đã `frozen` (bất biến — cache mạnh); holdings/cashflow của user (writer là app → `unstable_cache` key gồm `userId` + `revalidateTag` trong action).
- **Phạm vi lần này = chỉ đổi rule/docs.** Phase 1 vẫn **không cache** (đúng cho quy mô nhỏ, cache chỉ thêm rủi ro key-scoping). Hiện thực cache thật **hoãn tới Phase 2–3**; task + hiện trạng `queries.ts` cần rà (N+1 khi ghép giá) ghi ở `process/phase-2.md`.
- Docs đã sync: `docs/rules/performance.md` (viết lại mục "Data fetching" — bảng phân loại + bất biến + ví dụ good/bad key-scoping), `process/phase-2.md` (task cache `PriceQuote` + mục "Hiện trạng fetch Phase 1 cần xử lý"), `docs/03-roadmap.md` (Phase 2). Không đụng `04-tech-stack.md` mục PWA (SW cache asset tĩnh là tầng khác, phát biểu "không cache số liệu offline" vẫn đúng).
