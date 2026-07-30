import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  {
    // Quy ước `_`-prefix cho tham số bắt buộc theo chữ ký nhưng không dùng
    // (vd `_prevState` trong action khớp useActionState) — áp dụng cả khi
    // đó là tham số cuối cùng bị unused (mặc định `args: "after-used"` chỉ
    // bỏ qua tham số đứng trước một tham số có dùng).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Lượng hoá độ khó hiểu (docs/rules/clean-code.md mục 4). Chỉ đăng ký
    // đúng rule cần dùng từ sonarjs — KHÔNG dùng preset `sonarjs/recommended`
    // (preset kéo theo nhiều rule khác chưa được cân nhắc/đo baseline).
    //
    // KHÔNG bật max-lines-per-function: đo sai thứ (số dòng, không phải độ khó hiểu). Sẽ bắt
    // oan hàm dài-tuyến-tính-1-trách-nhiệm (vd getHoldingDetail ~200 dòng, 1 cấp rẽ nhánh) và
    // bỏ lọt hàm ngắn-mà-rối. Metric đúng đã bật ở dưới: sonarjs/cognitive-complexity + max-depth.
    // Xem docs/rules/clean-code.md mục 4.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { sonarjs },
    rules: {
      // Baseline đo thật ngày 2026-07-28 (set tạm ["warn", 0], chạy `pnpm lint`, đọc
      // "reduce its Cognitive Complexity from X to the 0 allowed" trên toàn bộ output):
      // cao nhất X = 27, tại TransactionForm.tsx (features/holdings/components), hàm
      // xử lý submit form giao dịch. Ngưỡng "lý tưởng" (default của chính rule này,
      // không phải số tự nghĩ ra) là 15 — baseline 27 cao hơn hẳn. Chốt threshold =
      // baseline đo được (không siết xuống mức chưa ai đạt, tránh vừa bật đã phải tắt),
      // severity "error". Mục tiêu dài hạn: tách TransactionForm submit handler theo
      // dấu hiệu (2) ở clean-code.md mục 4 (nhiều nhánh rẽ lồng nhau theo loại tài sản/
      // loại giao dịch), rồi siết dần threshold xuống gần 15.
      "sonarjs/cognitive-complexity": ["error", 27],
      // Baseline đo thật cùng ngày (set tạm ["warn", 0], đọc "Blocks are nested too
      // deeply (X)"): cao nhất X = 3 (vd src/lib/xirr.ts, src/features/holdings/
      // queries/holdings-valuation.ts). Đã thấp hơn default ESLint (4) và đúng bằng
      // dấu hiệu "lồng rẽ nhánh ≥ 4 cấp" ở clean-code.md mục 4 — set thẳng "error" ở
      // baseline đo được, không cần nới thêm.
      "max-depth": ["error", 3],
    },
  },
  {
    // Type-aware linting (issue #111 bước 4). Đo thật ngày 2026-07-28 trên máy dev:
    // `time pnpm lint` KHÔNG type-aware ~11.4-11.6s (2 lần chạy); BẬT type-aware
    // (`projectService: true` như dưới đây) ~23.6-24.7s (2 lần chạy) — tăng ~2.1x,
    // vẫn nằm trong ngưỡng chấp nhận được (~20-30s tổng, không phải 3-5x trở lên).
    // QUYẾT ĐỊNH: giữ bật thật, không chỉ thử nghiệm rồi revert — đổi lại vòng lặp
    // dev chậm hơn ~13s để đổi lấy `switch-exhaustiveness-check` (cơ chế thứ 2 song
    // song `assertNever`, xem docs/rules/typescript-style.md mục "Enum"). Khai gói
    // chính thức `typescript-eslint` làm devDependency tường minh trong package.json
    // — trước đây chỉ là transitive dependency ẩn qua `eslint-config-next`.
    // `projectService: true` cho `typescript-eslint` build type info từ
    // tsconfig.json thay vì liệt kê thủ công `project: [...]`.
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // DAL (issue #106): chỉ `repository.ts` được import `@/lib/db` trực tiếp,
    // chỗ khác trong feature phải gọi qua hàm repository. Scope CHỈ 2 feature
    // đã có `repository.ts` tính tới lúc này — `holdings` và `dividends`.
    // `features/{settings,snapshots,members}` vẫn import `@/lib/db` trực tiếp
    // trong `actions.ts`/`queries.ts` — đó là phạm vi cố ý của #106 (chưa tách
    // repository), KHÔNG phải vi phạm. Mở rộng `files` bên dưới khi feature đó
    // có `repository.ts` riêng.
    //
    // Lưu ý flat config semantics: `ignores` ở CÙNG object với `files` chỉ loại
    // trừ file khỏi phạm vi áp dụng CỦA OBJECT NÀY (không phải global ignore).
    files: [
      "src/features/holdings/**/*.{ts,tsx}",
      "src/features/dividends/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/features/holdings/repository.ts",
      "src/features/dividends/repository.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Chỉ repository.ts được import @/lib/db trực tiếp (DAL, issue #106) — gọi hàm repository thay vì Prisma trực tiếp. Xem docs/rules/data-prisma.md.",
            },
          ],
        },
      ],
    },
  },
  // `ignores`-only config objects are unioned with eslint-config-next's own
  // default ignores (.next/**, out/**, build/**, next-env.d.ts), not a
  // replacement — only list what's extra here.
  globalIgnores([
    // Python job, e2e artifacts:
    "jobs/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
