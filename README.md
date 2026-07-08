# Navtrack

Web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ, trái phiếu, vàng), tính lãi/lỗ theo
XIRR. Phi thương mại, nhiều user riêng tư. Xem bối cảnh đầy đủ ở [`CLAUDE.md`](./CLAUDE.md) và
[`docs/`](./docs/).

> **Trạng thái hiện tại:** mới dựng khung hạ tầng (Next.js, Prisma, tooling, test runner). Các
> tính năng nghiệp vụ (đăng nhập, nhập vị thế, XIRR...) chưa được implement — xem
> [`process/PROCESS.md`](./process/PROCESS.md) để biết phase đang làm.

## Yêu cầu môi trường

- Node.js 20+ (xem [`.nvmrc`](./.nvmrc))
- pnpm
- Docker Desktop (chạy Postgres local)
- Python 3.12+ (chỉ cần khi làm việc trên `jobs/price-fetcher`)

## Chạy app local

```bash
pnpm install

# 1. Bật Postgres local (port host 5433 để tránh đụng Postgres cài sẵn trên máy, nếu có)
docker compose up -d

# 2. Copy .env.example -> .env (giá trị mặc định đã khớp docker-compose.yml)
cp .env.example .env

# 3. Áp schema Prisma vào DB
pnpm db:migrate

# 4. Chạy dev server
pnpm dev
```

Mở http://localhost:3000.

## Lệnh thường dùng

| Lệnh                        | Mục đích                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`                  | Chạy Next.js dev server                                                |
| `pnpm build` / `pnpm start` | Build & chạy bản production                                            |
| `pnpm lint`                 | ESLint                                                                 |
| `pnpm typecheck`            | `tsc --noEmit`                                                         |
| `pnpm format`               | Prettier ghi đè                                                        |
| `pnpm test`                 | Unit test (Vitest) — chỉ test logic thuần, xem `docs/rules/testing.md` |
| `pnpm e2e`                  | E2e test (Playwright) — tự khởi động dev server nếu chưa chạy          |
| `pnpm db:migrate`           | Tạo/áp migration Prisma (`prisma migrate dev`)                         |
| `pnpm db:seed`              | Seed dữ liệu mặc định (`prisma/seed.ts`)                               |

## Chạy e2e (Playwright)

```bash
docker compose up -d   # DB phải đang chạy — một số luồng e2e sau này sẽ cần ghi/đọc DB
pnpm e2e
```

Lần đầu chạy trên máy mới, cài trình duyệt Playwright:

```bash
pnpm exec playwright install chromium
```

Test đặt trong [`e2e/`](./e2e/). Xem báo cáo HTML sau khi chạy: `pnpm exec playwright show-report`.

## Job giá tự động (Python)

`jobs/price-fetcher/` là job Python tách riêng (chạy trên GitHub Actions theo lịch), ghi giá EOD
vào Postgres dùng chung. Xem [`jobs/price-fetcher/README.md`](./jobs/price-fetcher/README.md) để
setup, và [`docs/rules/python-job.md`](./docs/rules/python-job.md) cho quy ước.

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
jobs/price-fetcher/  # job Python (tách riêng khỏi app Next)
e2e/             # test Playwright
```

## Tài liệu liên quan

- [`CLAUDE.md`](./CLAUDE.md) — hướng dẫn cho Claude khi làm việc trên repo này
- [`docs/coding-rules.md`](./docs/coding-rules.md) — index coding rules
- [`docs/domain/README.md`](./docs/domain/README.md) — domain spec (XIRR, cost basis, thuế...)
- [`docs/04-tech-stack.md`](./docs/04-tech-stack.md) — quyết định tech stack + lý do
- [`process/PROCESS.md`](./process/PROCESS.md) — tiến trình triển khai theo phase
