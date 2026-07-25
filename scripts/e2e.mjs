// Chạy Playwright với DB riêng, ephemeral (docker-compose.test.yml): tự up + migrate +
// seed trước, tự down sau khi xong — kể cả khi test fail — để không đụng DB dev (service
// `db`). Seed dùng CHUNG prisma/seed.ts với DB dev (không phải seed riêng cho e2e) — mọi
// Setting toàn cục cần cho luồng chính (thuế/phí/cổ tức/cảnh báo tập trung...) có sẵn ngay,
// spec chỉ cần tự seed thêm giá trị RIÊNG cho kịch bản đang test (vd đổi thuế suất theo
// ngày ở tax-and-fee.spec.ts) — xem e2e/GOTCHAS.md #15. Chạy qua `pnpm e2e`.
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

const composeFile = "docker-compose.test.yml";
const { parsed: testEnv } = loadEnv({ path: ".env.test", processEnv: {} });
const env = { ...process.env, ...testEnv };

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env,
  });
  return result.status ?? 1;
}

const upStatus = run("docker", [
  "compose",
  "-f",
  composeFile,
  "up",
  "-d",
  "--wait",
]);
if (upStatus !== 0) process.exit(upStatus);

let exitCode;
try {
  const migrateStatus = run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  if (migrateStatus !== 0) {
    exitCode = migrateStatus;
  } else {
    const seedStatus = run("pnpm", ["exec", "prisma", "db", "seed"]);
    exitCode =
      seedStatus === 0
        ? run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)])
        : seedStatus;
  }
} finally {
  run("docker", ["compose", "-f", composeFile, "down"]);
}

process.exit(exitCode);
