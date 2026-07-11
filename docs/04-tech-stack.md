# Tech stack

Các quyết định kỹ thuật được chốt qua trao đổi. Mỗi lựa chọn kèm lý do để sau này nhìn lại còn hiểu vì sao.

## Tổng quan kiến trúc

Ba mảnh tách biệt, nối với nhau qua PostgreSQL:

```
┌─────────────────────┐        ┌──────────────────────┐
│  App Next.js         │  đọc   │                      │
│  (Vercel)            │──────▶ │   PostgreSQL (Neon)  │
│  - Giao diện         │        │                      │
│  - Đăng nhập Google  │        │   Schema = "hợp đồng"│
│  - Tính XIRR         │        │   chung giữa 2 thế   │
│  - Biểu đồ           │        │   giới               │
└─────────────────────┘        └──────────▲───────────┘
                                          │ ghi
                               ┌──────────┴───────────┐
                               │  Job Python + vnstock │
                               │  (GitHub Actions,     │
                               │   chạy theo lịch)     │
                               │  - Lấy giá hằng ngày  │
                               │  - Chốt snapshot      │
                               └──────────────────────┘
```

**Nguyên tắc cốt lõi:** app TypeScript **chỉ đọc** giá từ DB, không bao giờ gọi vnstock trực tiếp. Job Python **chỉ ghi** vào DB, không đi qua app. Vì hai thế giới không gọi nhau, **schema database trở thành hợp đồng chung** — thay đổi schema phải đồng bộ cả hai phía.

## Các quyết định

| Mảng | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js + TypeScript** | Đã quen, hợp cho cả frontend lẫn API |
| ORM + DB | **Prisma + PostgreSQL** | Type-safe, khớp dự án hiện có |
| Database hosting | **Neon** (free tier) | $0 thật cho dữ liệu nhỏ; tự ngủ/tự thức, không phải bấm tay bật lại (khác Supabase) |
| App hosting | **Vercel** (free tier) | Chuẩn cho Next.js, $0 |
| Nguồn giá | **Python + vnstock**, chạy trên **GitHub Actions** theo lịch | vnstock là thư viện Python; job chỉ chạy theo lịch nên không cần server thường trú → GitHub Actions free |
| Đăng nhập | **Auth.js + Google OAuth** | Không mật khẩu, không cần dịch vụ email, ai cũng có Google |
| Giao diện | **Tailwind CSS + shadcn/ui, chỉ dark mode** | Tự sở hữu component, hiện đại, khớp Next App Router và Recharts; app chỉ chạy dark mode — xem "Giao diện" bên dưới |
| Biểu đồ | **Recharts** | Khớp liền shadcn/ui (component chart dựng trên Recharts), đủ cho NAV + phân bổ |
| Tính XIRR | **Lai: thư viện npm + lớp bọc kiểm tra** | Thư viện làm lõi tính; tự bọc validate dấu dòng tiền, bắt ca không hội tụ, gắn nhãn "theo năm" |
| Import dữ liệu cũ | **CSV + PapaParse** *(đã hoãn)* | Hoãn ở Phase 1: dữ liệu cũ không tách chi tiết từng mã nên nhập tay vị thế ban đầu thay vì import. Giữ lựa chọn này cho khi làm import sau (Backlog) |
| PWA | **Cài lên màn hình chính (installable), không offline dữ liệu** — Next.js Metadata API (`app/manifest.ts`) + service worker tự viết tay (không dùng `next-pwa`/Serwist) | App cá nhân, dữ liệu tài chính luôn cần mới — không cache số liệu offline để tránh hiện sai. Next 16 + Turbopack còn rủi ro tương thích với plugin SW bên thứ ba nên tự viết service worker tối giản thay vì phụ thuộc thư viện |

## Ghi chú triển khai

### Job Python (GitHub Actions)
- Kết nối Neon qua connection string, lưu trong **GitHub Secrets** (không hardcode).
- Chạy theo lịch (cron của GitHub Actions) — lưu ý lịch này lệch vài phút, không chính xác từng phút, nhưng không sao với snapshot ngày/tháng/năm.
- Nhiệm vụ: lấy giá hằng ngày cho cổ phiếu/quỹ; chốt snapshot định kỳ. **Lịch chốt snapshot nằm trong cron của workflow** (không chạy hằng ngày): tháng → fire ngày 01 ghi cho cuối tháng trước; năm → 01/01 ghi cho 31/12 trước (xem `domain/06-snapshots.md`). Vàng/trái phiếu chủ yếu nhập tay.

### XIRR (lớp bọc kiểm tra)
- Trước khi tính: kiểm tra chuỗi dòng tiền có ít nhất một giá trị âm và một dương — nếu không, trả về trạng thái "không tính được" rõ ràng, **không** trả -100% hay NaN âm thầm.
- Sau khi tính: nếu thuật toán không hội tụ, báo lỗi tường minh thay vì trả số bậy.
- Luôn gắn nhãn kết quả là **tỷ suất theo năm (annualized)**.
- **Bắt buộc có test** đối chiếu với kết quả XIRR của Excel/Google Sheets trên dữ liệu thật.

### Đăng nhập & kiểm soát "chỉ người được mời"
- Google OAuth qua Auth.js. **Không mở đăng ký công khai** (phù hợp tính chất phi thương mại).
- **Allowlist trong DB:** bảng `AllowedUser { email, invitedBy, createdAt, revokedAt }` (soft-delete để giữ audit). Chặn tại **`signIn` callback** — chỉ cho vào nếu email có trong allowlist, chưa `revokedAt`, và `email_verified`. Không allowlist theo `@gmail.com`, không tự chuẩn hóa dấu chấm Gmail.
- **Database sessions** (Prisma adapter) thay vì JWT, để **thu hồi quyền tức thời**: set `revokedAt` + xóa `Session` row là mất quyền ngay, không phải chờ token hết hạn.
- **Bootstrap:** một admin email seed sẵn (`canInvite = true`) để tạo allowlist ban đầu.
- **Mời có phân quyền:** user có cờ `AllowedUser.canInvite` mới mời được người khác; mời = insert `AllowedUser` (người mới `canInvite = false`). Cấp `canInvite` cho ai chỉ làm trực tiếp trên DB. Giới hạn số thành viên bằng `MAX_MEMBERS` trong `Setting` (đếm `AllowedUser` chưa thu hồi). Xem `domain/08-users-access-and-privacy.md`.
- Mời/thu hồi không cần redeploy (thao tác trên DB). *(Quyết định GP2 sau khi cân nhắc so với ENV allowlist + JWT — xem lý do: revoke của JWT không tức thời.)*

### Giao diện
- **Chỉ dark mode, không có toggle:** `<html>` luôn gắn class `dark` (`src/app/layout.tsx`); `globals.css` chỉ định nghĩa token màu trong `.dark`, `:root` chỉ giữ `--radius` (token dùng chung, không phụ thuộc theme). Quyết định vì app cá nhân, không cần đầu tư bảng màu light song song khi chưa có nhu cầu — tránh token light "chết" (định nghĩa nhưng không bao giờ render) gây nhầm lẫn khi đọc code.
- Nếu sau này cần light mode: thêm lại bảng màu light vào `:root`, bỏ hardcode class `dark` ở `<html>`, và làm cơ chế chọn theme (theo hệ điều hành hoặc toggle tay).

### Ảnh/logo mã cổ phiếu
- **Chỉ dùng avatar chữ (monogram):** vẽ ô bo tròn màu, chữ là mã cổ phiếu, màu suy ra từ hash của mã. Không cần trường `logoUrl` trong DB, không phụ thuộc nguồn logo ngoài.
- Lý do: vnstock **không** cung cấp logo đáng tin cho cổ phiếu VN, và không có API logo miễn phí chuẩn cho thị trường VN. Avatar chữ phủ 100% mọi mã, đồng bộ, không vướng bản quyền.
- Danh sách *mã* (để autocomplete khi thêm cổ phiếu) lấy được từ vnstock (`listing.all_symbols()`), khác với chuyện logo. **Hoãn cùng autocomplete** (Phase 1 gõ tự do): bảng lưu danh sách mã sẽ định nghĩa khi làm tính năng này (Backlog).

### PWA (cài lên màn hình chính)
- **Phạm vi cố ý tối giản:** chỉ installable shell (manifest + icon) + cache tài nguyên tĩnh (`/_next/static/*`, `/icons/*`, favicon). **Không cache API/HTML render động** — số dư, XIRR, giá luôn phải lấy mới từ mạng, không bao giờ hiện số liệu tài chính cũ khi mất mạng.
- **Manifest:** `src/app/manifest.ts` (Next.js Metadata file convention, tự sinh route `/manifest.webmanifest` + tự chèn `<link rel="manifest">`) — `background_color`/`theme_color` = `#07080b` khớp token `--background` (dark-only).
- **Icon:** sinh PNG (192/512 "any" + 512 maskable) từ `scripts/generate-pwa-icons.mjs` bằng `ImageResponse` (`next/og.js`) — vẽ lại đúng mark trong `LogoMark.tsx` (gradient `#8b9bff → #2fc6ad` + 2 tam giác), không dùng ảnh thiết kế rời để tránh lệch khi đổi brand. Maskable thu nhỏ glyph còn ~34% canvas để nằm trong safe-zone hình tròn của Android. Chạy lại `pnpm icons:generate` mỗi khi đổi màu/mark trong `LogoMark.tsx`. Icon PNG (`public/icons/*.png`) **commit vào repo**, không sinh lại lúc build.
- **Service worker viết tay** (`public/sw.js`, đăng ký qua `ServiceWorkerRegister` — client component mount ở `layout.tsx`, **chỉ đăng ký khi `NODE_ENV=production`** vì `next dev`/Turbopack đổi chunk liên tục, SW cache sẽ phục vụ chunk cũ nếu bật lúc dev):
  - Cache-first cho asset tĩnh (`/_next/static/*`, `/icons/*`, `favicon.ico`).
  - Navigation request lỗi mạng → fallback `public/offline.html` (trang tĩnh không qua Next, không cần DB/auth).
  - Không đụng tới request API/RSC — để mặc định qua mạng.
  - Đổi `CACHE_VERSION` trong `sw.js` khi thay đổi chiến lược cache tĩnh (activate tự xoá cache cũ).
- **Không làm ở lần này (Backlog):** cache-first/stale-while-revalidate cho dữ liệu portfolio (xem offline được số liệu gần nhất), Web Push (hạ tầng cho cảnh báo giá).

## Chi phí

Tổng: **~$0/tháng** — Vercel, Neon, GitHub Actions đều dùng free tier, dữ liệu nhỏ nên không chạm giới hạn. Job Python chạy mỗi ngày cũng giữ cho DB không bị coi là "không hoạt động".
