# CLAUDE.md

Hướng dẫn cho Claude khi làm việc trên **Navtrack** — web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ, trái phiếu, vàng), tính lãi/lỗ theo XIRR. Phi thương mại, nhiều user riêng tư.

## Bắt buộc đọc trước khi code
- **Coding rules:** [`docs/coding-rules.md`](./docs/coding-rules.md) — index trỏ tới rules từng mảng trong `docs/rules/`. **Tuân thủ khi viết code.**
- **Domain specs:** [`docs/domain/README.md`](./docs/domain/README.md) — luật nghiệp vụ chính xác (XIRR, cost basis, thuế, cổ tức, pricing, access...).
- **Data model:** [`docs/02-data-model.md`](./docs/02-data-model.md) — schema Prisma.
- **Tech stack:** [`docs/04-tech-stack.md`](./docs/04-tech-stack.md).
- **Business overview:** [`docs/business-overview.md`](./docs/business-overview.md).

## Tiến trình triển khai
- **Theo dõi tại [`process/PROCESS.md`](./process/PROCESS.md)** — trỏ tới chi tiết từng phase (`process/phase-x.md`).
- **QUAN TRỌNG:** mỗi khi hoàn thành một phase, **cập nhật `process/PROCESS.md`** (đổi trạng thái) và tick tiêu chí trong `process/phase-x.md`.

## Tech stack (tóm tắt)
- Next.js + TypeScript (App Router), Prisma + PostgreSQL (Neon), Auth.js + Google OAuth (database sessions).
- Tailwind + shadcn/ui, Recharts. XIRR: thư viện + lớp bọc kiểm tra.
- Giá tự động: job **Python + vnstock** trên GitHub Actions ghi `PriceQuote`; app **chỉ đọc**.
- Hosting: Vercel + Neon + GitHub Actions (chi phí ~$0).

## Quy ước cốt lõi (chi tiết ở rules)
- **pnpm**; TS strict + `noUncheckedIndexedAccess`; ESLint + Prettier.
- **Component:** PascalCase, mỗi component một thư mục `Name/Name.tsx` + `index.ts`; Server Component làm container, Presentational thuần. File non-component kebab-case.
- **Tiền luôn `Decimal`**, không float. Convert `Decimal → string` ở biên server.
- **Tách dữ liệu theo user:** mọi truy vấn filter theo `userId` từ session (`auth()`), không tin client.
- **Ranh giới Python↔TS:** chỉ chia sẻ schema Postgres; Prisma sở hữu migration; job Python không chạy migration.
- **Lỗi & log:** phân loại lỗi lường trước (`ActionResult`) vs bất ngờ (`error.tsx`); log bằng **pino**, không log secret.

## Ngôn ngữ
- Code, comment, commit message: **tiếng Anh**. Tài liệu (`docs/`, `process/`): tiếng Việt.
