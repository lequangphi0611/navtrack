# Navtrack

Web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ, trái phiếu, vàng), tính lãi/lỗ theo
XIRR. Phi thương mại, nhiều user riêng tư. Xem bối cảnh đầy đủ ở [`CLAUDE.md`](./CLAUDE.md) và
[`docs/`](./docs/).

> **Trạng thái hiện tại:** Phase 1 (đăng nhập, tách dữ liệu theo user, nhập vị thế, CRUD giao
> dịch mua/bán, mời thành viên) đã implement. Cách đưa lên production xem
> [`docs/05-deploy.md`](./docs/05-deploy.md) (Vercel + Neon). **Chưa có định giá thị trường / XIRR
> / biểu đồ** (thuộc Phase 2+) — xem [`process/PROCESS.md`](./process/PROCESS.md) để biết chi tiết.

## Yêu cầu môi trường

- Node.js 20+ (xem [`.nvmrc`](./.nvmrc))
- pnpm
- Docker Desktop (chạy Postgres local)
- Python 3.12+ (chỉ cần khi làm việc trên `jobs/price-fetcher`)

## Chạy app local

```bash
# 1. Bật Postgres local (port host 5433 để tránh đụng Postgres cài sẵn trên máy, nếu có)
#    --wait để chờ healthcheck pass trước khi migrate, tránh race lúc DB chưa sẵn sàng
docker compose up -d --wait

# 2. Copy .env.example -> .env (giá trị mặc định đã khớp docker-compose.yml)
#    Điền AUTH_SECRET (openssl rand -base64 32), AUTH_GOOGLE_ID/SECRET, SEED_ADMIN_EMAIL
cp .env.example .env

# 3. Cài dependency (postinstall tự chạy `prisma generate`)
pnpm install

# 4. Áp schema Prisma vào DB rồi seed dữ liệu mặc định
pnpm db:migrate
pnpm db:seed

# 5. Chạy dev server
pnpm dev
```

Mở http://localhost:3000.

## Lệnh thường dùng

| Lệnh                           | Mục đích                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Chạy Next.js dev server                                                                                                                                               |
| `pnpm build` / `pnpm start`    | Build & chạy bản production                                                                                                                                           |
| `pnpm lint`                    | ESLint                                                                                                                                                                |
| `pnpm typecheck`               | `tsc --noEmit`                                                                                                                                                        |
| `pnpm format`                  | Prettier ghi đè                                                                                                                                                       |
| `pnpm test`                    | Unit test (Vitest) — chỉ test logic thuần, xem `docs/rules/testing.md`                                                                                                |
| `pnpm e2e`                     | E2e test (Playwright) — tự khởi động dev server, tự docker compose DB test riêng                                                                                      |
| `pnpm test:python-integration` | Integration test cho mọi job Python có `test_integration.py` (tự quét `jobs/*/`) trên Postgres thật — tự docker compose DB test riêng, xem `docs/rules/python-job.md` |
| `pnpm db:migrate`              | Tạo/áp migration Prisma lúc dev (`prisma migrate dev`)                                                                                                                |
| `pnpm db:migrate:deploy`       | Áp migration đã có, không tạo mới — dùng cho CI/production (`prisma migrate deploy`)                                                                                  |
| `pnpm db:seed`                 | Seed dữ liệu mặc định (`prisma/seed.ts`) — cần `SEED_ADMIN_EMAIL`                                                                                                     |

## Chạy e2e (Playwright)

```bash
pnpm e2e
```

`pnpm e2e` (`scripts/e2e.mjs`) tự lo hết: `docker compose -f docker-compose.test.yml up`
một Postgres riêng (service `db-test`, cổng 5434, dữ liệu ở tmpfs) → áp migration → chạy
Playwright → `down` container đó khi xong (kể cả khi test fail). DB này **tách biệt hoàn
toàn** với DB dev ở `docker-compose.yml`/`.env` (cổng 5433) — không cần DB dev đang chạy,
và data dev không bao giờ bị e2e đụng tới. Cấu hình kết nối ở `.env.test`.

Lần đầu chạy trên máy mới, cài trình duyệt Playwright:

```bash
pnpm exec playwright install chromium
```

Test đặt trong [`e2e/`](./e2e/). Xem báo cáo HTML sau khi chạy: `pnpm exec playwright show-report`.

### Chạy e2e trên Claude Cloud (không có Docker)

Claude Cloud không có Docker daemon (xem `TOOLS.md`), nên `pnpm e2e` dùng Postgres cài trực
tiếp trong sandbox thay cho `docker-compose.test.yml`. Việc **cài đặt** (apt install Postgres,
tạo role) **không nằm trong repo** — đây là cấu hình ở cấp **environment**, dán vào ô "setup
script" khi tạo/sửa environment Claude Cloud trong
[Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web). Copy nội
dung dưới đây vào đó:

Nền tảng tự **cache** kết quả setup script (snapshot filesystem sau lần chạy đầu tiên, tái
dùng cho mọi phiên sau — không chạy lại setup script, không cần cài lại mỗi phiên) trừ khi bạn
đổi setup script/network access hoặc cache hết hạn (~7 ngày). Không cần tự thêm gì để "cache
việc cài" — nền tảng đã lo phần đó. Điều **không** được cache là tiến trình đang chạy: service
Postgres luôn tắt ở đầu một phiên mới dù gói đã cài từ trước — `scripts/e2e.mjs` tự
`service postgresql start` mỗi lần cần, không phải việc của setup script.

```bash
#!/bin/bash
# Cài Postgres native cho e2e trên environment Claude Cloud của navtrack — chỉ cài đặt, KHÔNG
# start service (service không sống sót qua snapshot cache nên scripts/e2e.mjs tự start lại
# mỗi phiên, xem file đó). Idempotent — chạy lại (setup script đổi/cache hết hạn) không lỗi,
# không mất role đã tạo.
set -euo pipefail

DB_USER="navtrack"
DB_PASSWORD="navtrack"

if ! dpkg -s postgresql >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  # `|| true`: environment Cloud có sẵn vài PPA bên thứ 3 (deadsnakes, ondrej/php) không liên
  # quan tới Postgres — nếu chúng trả lỗi (403/hết ký) `apt-get update` thoát exit khác 0 dù
  # archive Ubuntu chính vẫn fetch được bình thường. Không để lỗi không liên quan này chặn cả
  # script (set -e sẽ dừng ngay nếu thiếu `|| true`).
  apt-get update -qq || true
  apt-get install -y postgresql
fi

# Cần service chạy tạm để tạo role — CREATE ROLE ghi vào data dir nên vẫn còn sau khi service
# tắt lại (chỉ tiến trình không được cache, dữ liệu trên đĩa thì có).
service postgresql start
if [ "$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"")" != "1" ]; then
  su postgres -c "psql -c \"CREATE ROLE ${DB_USER} WITH LOGIN SUPERUSER PASSWORD '${DB_PASSWORD}'\""
fi

echo "Postgres native đã cài, role=${DB_USER} sẵn sàng (đã ghi vào đĩa, được cache)."
```

Sau khi cấu hình, `pnpm e2e` (`scripts/e2e.mjs`) trên Cloud chỉ **check** Postgres đã cài chưa
(`dpkg -s postgresql`; báo lỗi rõ, không tự cài, nếu environment chưa cấu hình script trên),
tự `service postgresql start` nếu chưa chạy (không cần mạng, nhanh), rồi tự
DROP + CREATE lại DB `navtrack` sạch mỗi lần chạy trước khi migrate/seed/test — xem
`process/decisions/agent-workflow-and-tooling.md` mục 2026-08-13.

**`pnpm install` không nằm trong setup script trên.** Cố ý — setup script chỉ chạy 1 lần rồi
cache theo **environment** (~7 ngày), trong khi repo được clone **mới hoàn toàn mỗi phiên**;
nếu cache cả `node_modules`, các phiên sau (khác commit/lockfile) sẽ dùng dependency đóng băng
theo lần đầu, lệch với code thật đang chạy. Thay vào đó, `.claude/hooks/cloud-install-deps.sh`
(đăng ký qua `SessionStart` hook trong `.claude/settings.json`) tự chạy `pnpm install` mỗi
phiên Claude Cloud, sau khi repo đã clone xong — luôn khớp đúng bản đang có, không chạy trên
Claude Local (dev tự cài tay theo hướng dẫn ở trên). Đúng khuyến nghị của nền tảng: setup
script cho toolchain/OS package, SessionStart hook cho việc cài dependency theo repo.

## Deploy lên production

Xem [`docs/05-deploy.md`](./docs/05-deploy.md) — deploy lên Vercel + Neon: connection string
pooled/direct, biến môi trường, tự áp migration khi deploy, seed admin lần đầu, Google OAuth.

## Job giá tự động (Python)

`jobs/price-fetcher/` là job Python tách riêng (chạy trên GitHub Actions theo lịch), ghi giá EOD
vào Postgres dùng chung. Xem [`jobs/price-fetcher/README.md`](./jobs/price-fetcher/README.md) để
setup, và [`docs/rules/python-job.md`](./docs/rules/python-job.md) cho quy ước.

`jobs/snapshot-cron/` là job Python **riêng biệt** (workflow GitHub Actions riêng, không phụ
thuộc `vnstock`), chốt (đóng băng) `Snapshot` định kỳ (tháng + cuối năm) cho từng Holding đang mở
và tổng danh mục mỗi user. Xem [`jobs/snapshot-cron/README.md`](./jobs/snapshot-cron/README.md).

## Cấu trúc thư mục

Xem [`docs/rules/project-structure.md`](./docs/rules/project-structure.md) cho quy ước đầy đủ
(feature module, ranh giới client/server, path alias `@/...`).

```
src/
├─ app/          # routes (App Router)
├─ features/     # module theo tính năng (Phase 1+)
├─ components/   # ui/ (shadcn) + component dùng chung
└─ lib/          # db.ts, logger.ts, format.ts, xirr.ts...
prisma/          # schema.prisma + migrations/
jobs/price-fetcher/  # job Python lấy giá (tách riêng khỏi app Next)
jobs/snapshot-cron/  # job Python chốt snapshot định kỳ (tách riêng, workflow riêng)
e2e/             # test Playwright
```

## Tài liệu liên quan

- [`CLAUDE.md`](./CLAUDE.md) — hướng dẫn cho Claude khi làm việc trên repo này
- [`docs/coding-rules.md`](./docs/coding-rules.md) — index coding rules
- [`docs/domain/README.md`](./docs/domain/README.md) — domain spec (XIRR, cost basis, thuế...)
- [`docs/04-tech-stack.md`](./docs/04-tech-stack.md) — quyết định tech stack + lý do
- [`docs/05-deploy.md`](./docs/05-deploy.md) — hướng dẫn deploy lên Vercel + Neon
- [`process/PROCESS.md`](./process/PROCESS.md) — tiến trình triển khai theo phase
