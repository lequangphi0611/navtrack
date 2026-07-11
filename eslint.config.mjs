import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
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
