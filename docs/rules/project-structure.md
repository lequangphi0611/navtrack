# Project structure

Quy tắc tổ chức thư mục và ranh giới module cho Navtrack (Next.js App Router + Prisma, job Python tách riêng).

## Bố cục thư mục gốc

- Đặt code app trong `src/`. Job Python **tách riêng ngoài app Next**. `prisma/` ở root.

```
✅ Good — cây thư mục mục tiêu
navtrack/
├─ src/
│  ├─ app/                 # routes (App Router)
│  ├─ features/            # module theo tính năng
│  │  └─ holdings/
│  │     ├─ components/
│  │     │  └─ HoldingTable/       # component = PascalCase, thư mục riêng
│  │     │     ├─ HoldingTable.tsx
│  │     │     └─ index.ts         # export { HoldingTable } from "./HoldingTable"
│  │     ├─ hooks/                 # use-*.ts (kebab-case)
│  │     ├─ actions.ts             # server actions
│  │     ├─ queries.ts             # truy vấn DB (server-only)
│  │     ├─ schemas.ts             # zod
│  │     └─ types.ts
│  ├─ components/          # dùng chung nhiều feature
│  │  ├─ ui/               # atoms shadcn (giữ nguyên quy ước shadcn, kebab)
│  │  └─ MoneyValue/       # component chung: PascalCase + index.ts
│  │     ├─ MoneyValue.tsx
│  │     └─ index.ts
│  └─ lib/                 # db, auth, format, xirr (kebab: db.ts, format.ts...)
├─ prisma/                 # schema.prisma + migrations/
├─ jobs/price-fetcher/     # job Python (requirements.txt, README)
└─ e2e/                    # test Playwright
```

- Import qua path alias **`@/...`** từ gốc `src`; không dùng relative sâu.

```ts
// ❌ Bad
import { db } from "../../../lib/db";
// ✅ Good
import { db } from "@/lib/db";
```

## Quy ước App Router

- Route đặt trong `app/`; colocate `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` cùng route.
- Dùng route group `(group)/` để tổ chức mà không ảnh hưởng URL.
- Route folder **kebab-case**; dynamic segment `[id]`.
- Ưu tiên **Server Actions** cho mutation; chỉ dùng `app/api/` route handler khi cần (webhook, caller ngoài).

```
✅ Good
app/(dashboard)/holdings/[id]/page.tsx
app/(dashboard)/holdings/loading.tsx

❌ Bad
app/Holdings/page.tsx          # PascalCase
app/holdings/holdingDetail.tsx # đặt file tùy tiện thay vì [id]/page.tsx
```

## Module theo feature

- Mỗi feature `features/<name>/` gồm: `components/`, `actions.ts`, `queries.ts`, `schemas.ts`, `types.ts`.
- **Colocation:** để file gần nơi dùng; chỉ đẩy lên `components/` hoặc `lib/` chung khi thực sự tái dùng ở nhiều feature.

## Ranh giới data & Python↔TS

- **Chỉ code server** (server component, server action, `queries.ts`) được import Prisma. **Không** import Prisma trong client component.

```tsx
// ❌ Bad — client component import Prisma (rò rỉ DB ra bundle client)
"use client";
import { db } from "@/lib/db";

// ✅ Good — client component nhận data qua props từ container server
"use client";
type Props = { rows: HoldingRow[] };
export function HoldingTable({ rows }: Props) { /* ... */ }
```

- `lib/` chứa hạ tầng dùng chung: `lib/db.ts`, `lib/auth.ts`, `lib/format.ts`, `lib/xirr.ts`.
- **Python và TS chỉ chia sẻ schema Postgres** — không bên nào import code bên kia. Prisma **sở hữu** migration; job Python chỉ đọc/ghi theo hình dạng bảng, **không** chạy migration.

```
❌ Bad: job Python tự CREATE TABLE / ALTER TABLE, hoặc TS gọi vào script Python
✅ Good: Prisma migrate quản schema; Python chỉ INSERT/SELECT theo bảng đã có
```

- **Validate mọi input tại biên server** bằng zod (`schemas.ts`) trước khi đụng DB.

## Env & config

- `.env` cho app Next (gitignored); commit `.env.example` làm mẫu.
- Secrets của job Python để ở **GitHub Secrets**, không nằm trong repo.
- Dùng chung một `DATABASE_URL` giữa app và job Python.

```
❌ Bad: commit .env có DATABASE_URL thật
✅ Good: .env trong .gitignore; .env.example chỉ có DATABASE_URL="postgresql://..."
```
