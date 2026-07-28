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
- **Rule clean-code ép bằng lint** (issue #111), khai trong `eslint.config.mjs`:
  - `sonarjs/cognitive-complexity` — `["error", 27]` cho `src/**/*.{ts,tsx}` (baseline đo thật, không phải ngưỡng lý tưởng — xem comment tại chỗ khai rule và [`clean-code.md`](./clean-code.md#4-kích-thước-hàm--độ-lồng) mục 4 để biết vì sao chọn Cognitive Complexity thay vì số dòng).
  - `max-depth` — `["error", 3]` cho `src/**/*.{ts,tsx}` (baseline đo thật, trùng với dấu hiệu "lồng rẽ nhánh ≥ 4 cấp" ở `clean-code.md` mục 4).
  - `@typescript-eslint/switch-exhaustiveness-check` — `"error"` cho `**/*.{ts,tsx}`, cần type-aware linting (`projectService: true`) — xem [`typescript-style.md`](./typescript-style.md) mục "Enum" để biết cách phối hợp với `assertNever`.
  - `no-restricted-imports` chặn `@/lib/db` — `"error"`, chỉ scope `src/features/{holdings,dividends}/**` (2 feature đã có `repository.ts` theo DAL issue #106), loại trừ chính `repository.ts`. Feature khác chưa tách repository (`settings`, `snapshots`, `members`) chưa nằm trong scope này.
  - Cố ý **không** bật `max-lines-per-function` hay `complexity` (cyclomatic) — lý do ở `clean-code.md` mục 4.
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
