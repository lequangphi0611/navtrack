# Project structure

Quy tắc tổ chức thư mục và ranh giới module cho Navtrack (Next.js App Router + Prisma, job Python tách riêng).

## Bố cục thư mục gốc

- Đặt code app trong `src/` (không rải ở root).
- Cây chính trong `src/`:
  - `app/` — routes (App Router)
  - `features/` — module theo tính năng
  - `components/` — component dùng chung nhiều feature
  - `lib/` — tiện ích cross-cutting (db, auth, format, xirr)
- **Job Python đặt tách riêng ngoài app Next**, vd `jobs/price-fetcher/`, có `requirements.txt` + README riêng.
- `prisma/` (ở root) chứa `schema.prisma` + `migrations/`.
- Import qua path alias **`@/...`** từ gốc `src`; không dùng relative sâu (`../../..`).

## Quy ước App Router

- Route đặt trong `app/`; colocate `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` cùng route.
- Dùng route group `(group)/` để tổ chức mà không ảnh hưởng URL.
- Route folder đặt **kebab-case**; dynamic segment dạng `[id]`.
- Ưu tiên **Server Actions** cho mutation; chỉ dùng `app/api/` route handler khi cần (webhook, caller bên ngoài).

## Module theo feature

- Mỗi feature nằm ở `features/<name>/`, gồm:
  - `components/` — molecules/organisms của feature
  - `actions.ts` — server actions (`"use server"`)
  - `queries.ts` — truy vấn DB (chỉ chạy phía server)
  - `schemas.ts` — zod schema để validate
  - `types.ts` — kiểu dữ liệu của feature
- **Colocation:** để file gần nơi dùng; chỉ đẩy lên `components/` hoặc `lib/` chung khi thực sự tái dùng ở nhiều feature.

## Ranh giới data & Python↔TS

- **Chỉ code server** (server component, server action, `queries.ts`) được import Prisma. **Không** import Prisma trong client component.
- `lib/` chứa hạ tầng dùng chung:
  - `lib/db.ts` — Prisma client singleton
  - `lib/auth.ts` — cấu hình Auth.js
  - `lib/format.ts` — format tiền/số (tôn trọng privacy mode)
  - `lib/xirr.ts` — lớp bọc tính XIRR
- **Python và TS chỉ chia sẻ schema Postgres** — không bên nào import code bên kia. Prisma **sở hữu** migration; job Python chỉ đọc/ghi theo hình dạng bảng, **không** chạy migration.
- **Validate mọi input tại biên server** bằng zod (`schemas.ts`) trước khi đụng DB.

## Env & config

- `.env` cho app Next (gitignored); commit `.env.example` làm mẫu.
- Secrets của job Python để ở **GitHub Secrets**, không nằm trong repo.
- Dùng chung một `DATABASE_URL` giữa app và job Python.
