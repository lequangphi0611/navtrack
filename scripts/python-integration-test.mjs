// Chạy integration test của một job Python trên Postgres thật, ephemeral
// (docker-compose.test.yml, service db-test, cổng 5434) — tự up + migrate trước, tự down
// sau khi xong, kể cả khi test fail. Tái dùng đúng hạ tầng DB test đã có cho Playwright e2e
// (scripts/e2e.mjs) — không dựng compose riêng cho job Python. Chạy qua
// `pnpm test:python-integration` (job mặc định: jobs/snapshot-cron, xem package.json).
//
// Chỉ chạy pytest -m integration (test_integration.py, đánh dấu @pytest.mark.integration) —
// unit test thường (test_main.py) đã bị loại khỏi lệnh `pytest` mặc định qua `addopts` trong
// pyproject.toml, không kéo Docker.
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

const jobDir = process.argv[2];
if (!jobDir) {
  console.error("Usage: node scripts/python-integration-test.mjs <job-dir>");
  process.exit(1);
}

const composeFile = "docker-compose.test.yml";
const { parsed: testEnv } = loadEnv({ path: ".env.test", processEnv: {} });
const env = { ...process.env, ...testEnv };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env,
    ...options,
  });
  return result.status ?? 1;
}

// Ưu tiên venv của chính job (đã cài pytest/psycopg qua requirements-dev.txt) — tránh lệ
// thuộc PATH đã activate venv hay chưa. Fallback `python` khi job chưa có `.venv` local.
// Dùng path.resolve (không path.join) để trả về đường dẫn TUYỆT ĐỐI — lệnh pytest chạy với
// `cwd: jobDir`, nếu path tương đối thì sẽ bị resolve lại theo cwd MỚI (jobDir) thay vì thư
// mục gốc repo, tìm nhầm sang `<jobDir>/<jobDir>/.venv/...`.
function resolvePythonExecutable(dir) {
  const windowsVenvPython = path.resolve(dir, ".venv", "Scripts", "python.exe");
  const posixVenvPython = path.resolve(dir, ".venv", "bin", "python");
  if (existsSync(windowsVenvPython)) return windowsVenvPython;
  if (existsSync(posixVenvPython)) return posixVenvPython;
  return "python";
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
    const python = resolvePythonExecutable(jobDir);
    exitCode = run(python, ["-m", "pytest", "-m", "integration"], {
      cwd: jobDir,
    });
  }
} finally {
  run("docker", ["compose", "-f", composeFile, "down"]);
}

process.exit(exitCode);
