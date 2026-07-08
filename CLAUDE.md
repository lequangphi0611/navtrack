# CLAUDE.md

Hướng dẫn cho Claude khi làm việc trên **Navtrack** — web app quản lý danh mục đầu tư cá nhân (cổ phiếu, quỹ, trái phiếu, vàng), tính lãi/lỗ theo XIRR. Phi thương mại, nhiều user riêng tư.

## Bắt buộc đọc trước khi code
Đọc **mọi lần**, bất kể đang làm phần nào — nền tảng chung của cả dự án:
- **README:** [`README.md`](./README.md) — cách cài đặt, chạy app local, chạy e2e (Playwright), setup job Python.
- **Coding rules:** [`docs/coding-rules.md`](./docs/coding-rules.md) — index trỏ tới rules từng mảng trong `docs/rules/`. **Tuân thủ khi viết code.**
- **Domain specs:** [`docs/domain/README.md`](./docs/domain/README.md) — luật nghiệp vụ chính xác (XIRR, cost basis, thuế, cổ tức, pricing, access...).
- **Data model:** [`docs/02-data-model.md`](./docs/02-data-model.md) — schema Prisma.
- **Tech stack:** [`docs/04-tech-stack.md`](./docs/04-tech-stack.md).
- **Business overview:** [`docs/business-overview.md`](./docs/business-overview.md).

## Đọc khi cần (theo ngữ cảnh)
Chỉ cần mở khi việc đang làm chạm đúng phần liên quan:
- **AGENTS.md:** [`AGENTS.md`](./AGENTS.md) — **đọc trước khi viết code đụng tới API/quy ước của Next.js**. Dự án dùng Next.js 16 (rất mới so với kiến thức huấn luyện của model) — có breaking changes về API/cấu trúc file so với các bản Next.js cũ quen thuộc. Trỏ tới `node_modules/next/dist/docs/` để tra API/convention chính xác thay vì suy đoán từ training data.
- **Từng file `docs/rules/*`:** đọc file tương ứng khi code phần đó (vd sửa Prisma schema → `docs/rules/schema.md` + `data-prisma.md`; sửa job Python → `python-job.md`; dựng component → `component-architecture.md`).
- **`process/phase-x.md`:** đọc phase đang làm (xem `process/PROCESS.md` để biết đang ở phase nào).

## Tiến trình triển khai
- **Theo dõi tại [`process/PROCESS.md`](./process/PROCESS.md)** — trỏ tới chi tiết từng phase (`process/phase-x.md`).
- **QUAN TRỌNG:** mỗi khi hoàn thành một phase, **cập nhật `process/PROCESS.md`** (đổi trạng thái) và tick tiêu chí trong `process/phase-x.md`.

## Đồng bộ tài liệu khi có quyết định quan trọng
- **BẮT BUỘC:** mỗi khi có quyết định quan trọng làm thay đổi **business / domain / spec / data model / rules**, phải **phản ánh đầy đủ vào TẤT CẢ tài liệu liên quan** trong cùng lần thay đổi — không chỉ sửa một chỗ.
- Rà các nơi có thể bị ảnh hưởng và cập nhật cho nhất quán: `docs/business-overview.md`, `docs/domain/*`, `docs/02-data-model.md`, `docs/04-tech-stack.md`, `docs/03-roadmap.md`, `docs/rules/*` (+ index), `process/PROCESS.md` & `process/phase-x.md`.
- Giữ **cross-reference đồng bộ**: đổi tên/khái niệm ở một file thì cập nhật mọi chỗ tham chiếu (dùng grep để tìm hết). Ghi rõ **lý do** quyết định để sau này còn hiểu.
- Commit riêng cho thay đổi tài liệu với message mô tả quyết định.

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
