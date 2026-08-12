// Chạy Playwright với DB riêng, ephemeral (docker-compose.test.yml): tự up + migrate +
// seed trước, tự down sau khi xong — kể cả khi test fail — để không đụng DB dev (service
// `db`). Seed dùng CHUNG prisma/seed.ts với DB dev (không phải seed riêng cho e2e) — mọi
// Setting toàn cục cần cho luồng chính (thuế/phí/cổ tức/cảnh báo tập trung...) có sẵn ngay,
// spec chỉ cần tự seed thêm giá trị RIÊNG cho kịch bản đang test (vd đổi thuế suất theo
// ngày ở tax-and-fee.spec.ts) — xem e2e/GOTCHAS.md #15. Chạy qua `pnpm e2e`.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const composeFile = "docker-compose.test.yml";
const { parsed: testEnv } = loadEnv({ path: ".env.test", processEnv: {} });
const env = { ...process.env, ...testEnv };

// Server (webServer của Playwright, spawn "pnpm dev") kế thừa `env` này — cho phép
// src/lib/logger.ts + src/lib/db.ts ghi log app + SQL query ra file để e2e-verifier đọc
// lại khi 1 test fail mà error-context (screenshot/DOM snapshot) không đủ giải thích.
//
// Việc "xoá sạch từ lần chạy trước" đặt Ở ĐÂY (tiến trình ngoài, chạy đúng 1 lần), KHÔNG
// đặt trong logger.ts: Next dev có thể phục vụ request qua nhiều render-worker/process con
// khác nhau, mỗi bên có globalThis riêng — nếu app tự mở file bằng flags "w" (ghi đè), bất
// kỳ worker/module nào nạp lại cũng xoá mất log của các worker khác (xem GOTCHAS.md #19).
// App phía dưới CHỈ được append, không bao giờ tự xoá.
const e2eLogDir = resolve(process.cwd(), ".e2e-logs");
mkdirSync(e2eLogDir, { recursive: true });
env.E2E_LOG_FILE = resolve(e2eLogDir, "server.log");
// Reset kèm 1 dòng marker (không để rỗng hoàn toàn): nếu Playwright tái dùng server có sẵn
// (`reuseExistingServer`, xem GOTCHAS.md #19) thay vì spawn mới, server đó không có
// E2E_LOG_FILE trong env nên sẽ không append gì thêm — file dừng lại đúng ở dòng marker.
// Nhờ vậy phân biệt được "server không log gì thêm vì bị tái dùng" với "chưa từng chạy".
writeFileSync(
  env.E2E_LOG_FILE,
  `# e2e run started ${new Date().toISOString()}\n`,
);
env.LOG_LEVEL ??= "debug"; // log SQL query (level debug) thật sự được in ra

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
