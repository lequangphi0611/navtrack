// Chạy Playwright với DB riêng, ephemeral (docker-compose.test.yml): tự up + migrate
// trước, tự down sau khi xong — kể cả khi test fail — để không đụng DB dev (service `db`).
// Chạy qua `pnpm e2e`.
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
  exitCode =
    migrateStatus === 0
      ? run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)])
      : migrateStatus;
} finally {
  run("docker", ["compose", "-f", composeFile, "down"]);
}

process.exit(exitCode);
