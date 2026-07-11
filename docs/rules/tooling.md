# Tooling

Công cụ và cấu hình kỹ thuật cho Navtrack.

- Package manager **pnpm**; commit lockfile (`pnpm-lock.yaml`).

```
❌ Bad: trộn npm/yarn, commit package-lock.json + pnpm-lock.yaml
✅ Good: chỉ dùng pnpm, chỉ commit pnpm-lock.yaml
```

- `tsconfig` bật `strict: true` **và `noUncheckedIndexedAccess: true`** (an toàn hơn khi truy cập mảng/record — hợp app tài chính).

```jsonc
// ✅ Good — tsconfig.json (trích)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```ts
// Vì sao noUncheckedIndexedAccess:
const first = holdings[0];        // ✅ kiểu là Holding | undefined → buộc kiểm tra
console.log(first.symbol);        // ❌ lỗi compile nếu chưa guard → tránh crash runtime
```

- **ESLint** (next + typescript) lo đúng/sai; **Prettier** lo format — cấu hình để không chồng lấn (vd `eslint-config-prettier` tắt rule format của ESLint).
- Pin Node version qua `.nvmrc` và/hoặc `engines` trong `package.json`.
- **Pre-commit hook** (husky + lint-staged) chạy lint/format trên file staged.
- Scripts chuẩn trong `package.json`:

```jsonc
// ✅ Good
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint", // `next lint` deprecated từ Next 15+, dùng ESLint flat config trực tiếp
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy", // CI/production, không tạo migration mới
    "db:seed": "prisma db seed"
  }
}
```
