# Deploy lên Vercel + Neon

Hướng dẫn đưa Navtrack lên production: app chạy trên **Vercel**, database PostgreSQL trên
**Neon**. Chi phí mục tiêu ~$0 (free tier cả hai). Xem thêm [`04-tech-stack.md`](./04-tech-stack.md).

> **Nguyên tắc bảo mật:** mọi connection string, secret, client secret trong tài liệu này đều là
> **placeholder** (`<...>`). Không bao giờ commit giá trị thật vào repo, không dán vào `.env` đã
> theo dõi bởi git, không đưa vào commit message hay screenshot. Secret chỉ sống ở **Vercel
> Environment Variables** và **Neon Console**.

## Tổng quan các bước

1. Tạo database trên Neon, lấy 2 connection string (pooled + direct).
2. Tạo project trên Vercel, kết nối repo GitHub.
3. Khai báo Environment Variables trên Vercel.
4. Cấu hình Build Command để tự áp migration mỗi lần deploy.
5. Áp migration lần đầu + seed admin (chạy tay 1 lần từ máy local).
6. Cấu hình Google OAuth redirect URI theo domain thật.

## 1. Neon — hai loại connection string

Neon cấp 2 kiểu connection string cho cùng một database:

| Loại | Host chứa | Dùng cho |
| --- | --- | --- |
| **Pooled** | `...-pooler.neon.tech` | Runtime của app (query serverless, nhiều kết nối ngắn) |
| **Direct** | `...neon.tech` (không có `-pooler`) | `prisma migrate deploy` (chạy DDL/khóa migration) |

Lấy cả hai ở **Neon Console → project → Connection Details** (bật/tắt "Connection pooling" để đổi
giữa hai bản). Cả hai đều thêm `?sslmode=require`.

> Migration chạy qua pooler dễ lỗi ở các lệnh DDL/advisory lock → luôn dùng **direct** cho migrate.
> Runtime thì dùng **pooled** để chịu tải serverless.

## 2 & 3. Vercel — project + Environment Variables

Import repo GitHub vào Vercel (framework tự nhận là Next.js). Khai báo các biến sau ở
**Settings → Environment Variables** (scope: Production, và Preview nếu muốn):

| Biến | Giá trị | Ghi chú |
| --- | --- | --- |
| `DATABASE_URL` | connection string **pooled** của Neon | app query lúc runtime |
| `DIRECT_URL` | connection string **direct** của Neon | dùng cho `migrate deploy` (xem mục 4) |
| `AUTH_SECRET` | chuỗi ngẫu nhiên | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | OAuth client ID | từ Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | OAuth client secret | từ Google Cloud Console |
| `LOG_LEVEL` | `info` | tùy chọn |

Lưu ý:

- **Không** khai báo `SEED_ADMIN_EMAIL` trên Vercel — seed chỉ chạy tay 1 lần ở local (mục 5).
- Auth.js v5 tự tin tưởng host khi chạy trên Vercel (biến `VERCEL` có sẵn), nên **không cần**
  `AUTH_URL` / `AUTH_TRUST_HOST` trong trường hợp thường.
- `schema.prisma` cần khai báo `directUrl = env("DIRECT_URL")` để Prisma dùng direct cho migrate
  và pooled cho runtime. Nếu chưa tách, xem mục 4.

## 4. Build Command — tự áp migration mỗi lần deploy

Ở **Settings → Build & Development Settings → Build Command**, đặt:

```
prisma migrate deploy && next build
```

Như vậy mỗi lần deploy, Vercel áp các migration **đã commit** (không tạo mới) trước khi build. Để
`migrate deploy` dùng đúng direct connection, `prisma/schema.prisma` nên có:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — runtime
  directUrl = env("DIRECT_URL")     // direct — prisma migrate deploy
}
```

> `migrate deploy` an toàn khi chạy lại nhiều lần: chỉ áp migration nào chưa có trong bảng
> `_prisma_migrations`. Khác với `migrate dev` (chỉ dùng lúc code local, có thể tạo migration mới).

## 5. Migration lần đầu + seed admin (chạy tay 1 lần)

Trước lần deploy đầu (hoặc ngay sau), áp schema và tạo admin đầu tiên **từ máy local**, trỏ vào
Neon. Không lưu URL vào `.env` — chỉ set biến tạm cho lệnh.

**Áp migration** (dùng direct connection):

```bash
DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require" \
  pnpm db:migrate:deploy
```

**Seed admin đầu tiên** — chạy **sau** khi migrate xong (phải có bảng rồi mới seed được):

```bash
DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require" \
SEED_ADMIN_EMAIL="<email-admin-cua-ban>" \
  pnpm db:seed
```

PowerShell (đặt biến rồi chạy, biến chỉ sống trong session shell — không ghi ra file):

```powershell
$env:DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require"
$env:SEED_ADMIN_EMAIL="<email-admin-cua-ban>"
pnpm db:migrate:deploy
pnpm db:seed
```

Seed ([`prisma/seed.ts`](../prisma/seed.ts)) **idempotent** (dùng `upsert`), tạo tối thiểu:

- **`AllowedUser` admin đầu tiên** (`canInvite = true`) từ `SEED_ADMIN_EMAIL`. App có allowlist —
  **không seed thì không ai đăng nhập được**, kể cả bạn.
- **Mọi `Setting` app cần để chạy đúng** (`MAX_MEMBERS`, ngưỡng cảnh báo tập trung, thuế/phí giao
  dịch, thuế cổ tức...) — xem danh sách đầy đủ trong chính `prisma/seed.ts`. **Không có migration
  nào insert `Setting`** (toàn bộ 14 key hiện tại đều seed-only, cố ý — xem
  [`docs/domain/09-settings.md`](./domain/09-settings.md)); thiếu dòng nào, tính năng đọc đúng key
  đó sẽ throw `SETTING_NOT_FOUND` ngay lần đầu chạy (docs/rules/error-handling.md — "thiếu cấu hình
  -> báo lỗi", cố ý không fallback ngầm).

**Re-seed BẮT BUỘC mỗi khi `prisma/seed.ts` có thêm `Setting` key mới** (vd phase sau thêm ngưỡng/
loại phí mới) — chạy lại đúng lệnh `db:seed` ở trên sau khi deploy migration mới, **không phải chỉ
1 lần duy nhất lúc khởi tạo**. `upsert` khiến việc chạy lại an toàn (dữ liệu cũ giữ nguyên, chỉ thêm
key thiếu) — khác thêm thành viên (dùng chức năng **mời thành viên** trong app, không qua seed).
Đừng đưa seed vào Build Command Vercel (chạy lại vô ích mỗi lần deploy + phải lộ
`SEED_ADMIN_EMAIL` trong env production) — vẫn phải nhớ chạy tay khi seed.ts đổi.

## 6. Google OAuth redirect URI

Trong **Google Cloud Console → Credentials → OAuth client**, thêm **Authorized redirect URI** khớp
domain production:

```
https://<domain-vercel-cua-ban>/api/auth/callback/google
```

(Path callback của Auth.js v5 là cố định `/api/auth/callback/google`.) Nếu dùng Preview
deployments cần đăng nhập, thêm cả domain preview tương ứng.

## Checklist deploy

- [ ] Neon: có DB, lấy được cả pooled + direct connection string.
- [ ] Vercel: khai báo `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `AUTH_SECRET`,
      `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- [ ] `schema.prisma` có `directUrl`; Build Command = `prisma migrate deploy && next build`.
- [ ] Chạy tay: `db:migrate:deploy` → `db:seed` (kèm `SEED_ADMIN_EMAIL`) trỏ vào Neon — lặp lại
      `db:seed` mỗi lần `prisma/seed.ts` có thêm `Setting` key mới, không chỉ lần đầu.
- [ ] Google OAuth redirect URI khớp domain production.
- [ ] Đăng nhập thử bằng email admin → vào được app.
- [ ] Không có secret nào lọt vào git (`.env`, commit, log).
