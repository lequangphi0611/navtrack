# Tooling

Công cụ và cấu hình kỹ thuật cho Navtrack.

- Package manager **pnpm**; commit lockfile (`pnpm-lock.yaml`).
- `tsconfig` bật `strict: true` **và `noUncheckedIndexedAccess: true`** (an toàn hơn khi truy cập mảng/record — hợp với app tài chính).
- **ESLint** (next + typescript) lo đúng/sai; **Prettier** lo format — cấu hình để không chồng lấn.
- Pin Node version qua `.nvmrc` và/hoặc `engines` trong `package.json`.
- **Pre-commit hook** (husky + lint-staged) chạy lint/format trên file staged.
- Scripts chuẩn trong `package.json`: `dev`, `build`, `lint`, `typecheck`, `format`, `db:migrate`, `db:seed`.
