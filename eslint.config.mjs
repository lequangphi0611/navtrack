import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

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
