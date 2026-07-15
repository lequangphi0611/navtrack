// Chạy integration test của (các) job Python trên Postgres thật, ephemeral
// (docker-compose.test.yml, service db-test, cổng 5434) — tự up + migrate trước, tự down
// sau khi xong, kể cả khi test fail. Tái dùng đúng hạ tầng DB test đã có cho Playwright e2e
// (scripts/e2e.mjs) — không dựng compose riêng cho job Python. Chạy qua
// `pnpm test:python-integration` (xem package.json).
//
// Truyền job path qua argv để chỉ chạy riêng job đó (vd
// `pnpm test:python-integration -- jobs/price-fetcher`, có thể truyền nhiều path). Không
// truyền gì thì tự quét toàn bộ `jobs/*/test_integration.py` đang có sẵn — job Python mới
// sau này tự động được gộp vào một lượt chạy, không cần sửa script hay package.json.
//
// Chỉ chạy pytest -m integration (test_integration.py, đánh dấu @pytest.mark.integration) —
// unit test thường (test_main.py) đã bị loại khỏi lệnh `pytest` mặc định qua `addopts` trong
// pyproject.toml, không kéo Docker.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

function discoverJobDirs() {
  const jobsRoot = "jobs";
  if (!existsSync(jobsRoot)) return [];
  return readdirSync(jobsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(jobsRoot, entry.name))
    .filter((jobDir) => existsSync(path.join(jobDir, "test_integration.py")));
}

// `pnpm test:python-integration -- jobs/price-fetcher` khiến Node nhận nguyên văn "--" trong
// process.argv (không tự lược bỏ như npm) — lọc bỏ để không bị hiểu nhầm thành 1 job path.
const argvJobDirs = process.argv.slice(2).filter((arg) => arg !== "--");
const jobDirs = argvJobDirs.length > 0 ? argvJobDirs : discoverJobDirs();

if (jobDirs.length === 0) {
  console.error(
    "Khong tim thay job Python nao co test_integration.py duoi jobs/*. " +
      "Truyen truc tiep path neu muon chi dinh, vd: " +
      "node scripts/python-integration-test.mjs jobs/price-fetcher",
  );
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

let exitCode = 0;
try {
  const migrateStatus = run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  if (migrateStatus !== 0) {
    exitCode = migrateStatus;
  } else {
    // Chạy hết tất cả job dù có job fail giữa chừng — muốn thấy đủ lỗi trong 1 lần chạy,
    // không dừng ở job đầu tiên fail. Giữ lại mã lỗi khác 0 đầu tiên gặp được.
    for (const jobDir of jobDirs) {
      const python = resolvePythonExecutable(jobDir);
      const jobExitCode = run(python, ["-m", "pytest", "-m", "integration"], {
        cwd: jobDir,
      });
      if (jobExitCode !== 0 && exitCode === 0) {
        exitCode = jobExitCode;
      }
    }
  }
} finally {
  run("docker", ["compose", "-f", composeFile, "down"]);
}

process.exit(exitCode);
