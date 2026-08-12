import fs from "node:fs";
import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

// Next dev có thể phục vụ request qua nhiều render-worker/process con khác nhau (mỗi bên
// globalThis riêng), và Turbopack có thể nạp lại module này khi 1 route/Server Action lần
// đầu compile-on-demand — nên KHÔNG được tự xoá file ở đây (flags "a", chỉ nối thêm); việc
// reset về rỗng đã làm đúng 1 lần ở scripts/e2e.mjs (tiến trình ngoài, không bị reload).
// Cache qua globalThis để tránh mở nhiều file descriptor thừa trong CÙNG 1 process — cùng
// pattern globalForPrisma đang dùng ở lib/db.ts.
const globalForLogger = globalThis as unknown as { logger?: pino.Logger };

function createLogger(): pino.Logger {
  if (!process.env.E2E_LOG_FILE) return pino({ level });
  return pino(
    { level },
    pino.multistream([
      { stream: process.stdout },
      {
        stream: fs.createWriteStream(process.env.E2E_LOG_FILE, { flags: "a" }),
      },
    ]),
  );
}

// E2E_LOG_FILE chỉ được set bởi scripts/e2e.mjs khi chạy `pnpm e2e` — production/Vercel
// không set biến này nên hành vi (chỉ stdout) không đổi. Xem docs/rules/error-handling.md.
export const logger = globalForLogger.logger ?? createLogger();

if (process.env.NODE_ENV !== "production") globalForLogger.logger = logger;
