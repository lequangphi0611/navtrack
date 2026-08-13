// Chạy Playwright với DB riêng, ephemeral: tự dựng DB sạch trước, tự dọn sau khi xong — kể
// cả khi test fail — để không đụng DB dev. Seed dùng CHUNG prisma/seed.ts với DB dev (không
// phải seed riêng cho e2e) — mọi Setting toàn cục cần cho luồng chính (thuế/phí/cổ tức/cảnh
// báo tập trung...) có sẵn ngay, spec chỉ cần tự seed thêm giá trị RIÊNG cho kịch bản đang
// test (vd đổi thuế suất theo ngày ở tax-and-fee.spec.ts) — xem e2e/GOTCHAS.md #15. Chạy qua
// `pnpm e2e`.
//
// Cách dựng DB rẽ nhánh theo hạ tầng (xem TOOLS.md, dòng "Chạy E2E test"):
// - Claude Local: `docker-compose.test.yml` — Postgres ephemeral, tmpfs, tự sạch khi
//   container down.
// - Claude Cloud (`CLAUDE_CODE_REMOTE=true`): không có Docker daemon, nên dùng Postgres cài
//   trực tiếp trong sandbox thay cho container. VIỆC CÀI ĐẶT (apt install + start service +
//   tạo role) KHÔNG nằm trong repo — đó là "setup script" của environment, cấu hình ở Claude
//   Code on the web (chạy MỘT LẦN lúc provision container, TRƯỚC khi session bắt đầu), nội
//   dung script do user tự lưu/dán vào phần cấu hình environment (xem README.md mục "Chạy
//   e2e trên Claude Cloud" để lấy nội dung). File này chỉ **check** Postgres đã sẵn sàng chưa
//   (báo lỗi rõ nếu chưa, không tự cài) rồi **reset DB sạch + chạy** — "sạch từ đầu mỗi lần
//   chạy" ở đây phải tự DROP + CREATE lại DB (không có container để huỷ thay như tmpfs). Xem
//   process/decisions/agent-workflow-and-tooling.md,
//   mục 2026-08-13 — quyết định này KHÔNG mâu thuẫn với việc từ chối Neon ở 2026-08-12: Neon
//   bị từ chối vì là 1 DB dùng CHUNG giữa nhiều phiên Cloud chạy song song (race), còn
//   Postgres native ở đây nằm gọn trong 1 sandbox, không chia sẻ với phiên nào khác — cùng
//   tính cô lập như Docker.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const composeFile = "docker-compose.test.yml";
const isCloud = process.env.CLAUDE_CODE_REMOTE === "true";
const { parsed: testEnv } = loadEnv({ path: ".env.test", processEnv: {} });
const env = { ...process.env, ...testEnv };

// Cluster Postgres cài qua apt trên Cloud lắng nghe cổng mặc định 5432 — không cần đổi sang
// 5434 như `.env.test` (giá trị đó tồn tại để tránh đụng DB dev cổng 5433 trên Local; Cloud
// không bao giờ chạy DB dev song song nên không có gì để đụng).
const CLOUD_DB_PORT = "5432";
const CLOUD_DB_USER = "navtrack";
const CLOUD_DB_PASSWORD = "navtrack";
const CLOUD_DB_NAME = "navtrack";
if (isCloud) {
  env.DATABASE_URL = `postgresql://${CLOUD_DB_USER}:${CLOUD_DB_PASSWORD}@localhost:${CLOUD_DB_PORT}/${CLOUD_DB_NAME}?schema=public`;
}

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

// Không dùng `shell: true` cho 2 hàm dưới: chuỗi SQL truyền cho `psql -c`/`-tAc` chứa dấu
// nháy đơn (password) — `su postgres -c "<toàn bộ chuỗi>"` chỉ cần đúng 1 lớp shell (của
// chính `su -c`, phía OS user `postgres`), thêm `shell: true` ở spawnSync sẽ tạo lớp shell
// thứ 2 phá quoting.
function runAsPostgres(sql) {
  const result = spawnSync(
    "su",
    ["postgres", "-c", `psql -v ON_ERROR_STOP=1 -c "${sql}"`],
    { stdio: "inherit", env },
  );
  return result.status ?? 1;
}

function isPostgresReady() {
  return (
    spawnSync("pg_isready", ["-h", "localhost", "-p", CLOUD_DB_PORT], { env })
      .status === 0
  );
}

// CHỈ check + reset — không cài đặt gì ở đây (đó là setup script của environment, cấu hình
// ngoài repo, chạy lúc provision). Postgres chưa sẵn sàng ở đây nghĩa là environment đang
// chạy chưa cấu hình setup script đó — báo lỗi rõ thay vì tự âm thầm cài.
function checkAndResetCloudDb() {
  if (!isPostgresReady()) {
    console.error(
      `Postgres chưa sẵn sàng ở localhost:${CLOUD_DB_PORT}. Environment Claude Cloud này chưa ` +
        'cấu hình setup script cài Postgres (xem README.md mục "Chạy e2e trên Claude Cloud") ' +
        "— cấu hình rồi khởi động lại environment trước khi `pnpm e2e`.",
    );
    return 1;
  }
  // Sạch từ đầu mỗi lần chạy — tương đương tmpfs của docker-compose.test.yml. Không có
  // container để huỷ trên Cloud nên phải tự DROP + CREATE lại DB ở đây.
  runAsPostgres(`DROP DATABASE IF EXISTS ${CLOUD_DB_NAME}`);
  return runAsPostgres(
    `CREATE DATABASE ${CLOUD_DB_NAME} OWNER ${CLOUD_DB_USER}`,
  );
}

const upStatus = isCloud
  ? checkAndResetCloudDb()
  : run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
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
  // Cloud: không "down" gì cả — cluster do setup script của environment dựng sẵn ở lại cho
  // lần `pnpm e2e` kế tiếp trong CÙNG session, state DB tự làm sạch ở đầu
  // `checkAndResetCloudDb()` lần sau. Toàn bộ sandbox (kể cả cluster) tự huỷ khi session Cloud
  // kết thúc nên không rò rỉ dữ liệu sang session khác.
  if (!isCloud) {
    run("docker", ["compose", "-f", composeFile, "down"]);
  }
}

process.exit(exitCode);
