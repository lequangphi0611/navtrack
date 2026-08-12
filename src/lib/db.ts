import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// E2E_LOG_FILE chỉ set khi chạy `pnpm e2e` (scripts/e2e.mjs) — SQL query log có overhead
// và có thể chứa dữ liệu nhạy cảm (docs/rules/error-handling.md "không log secret"), nên
// không bật cố định ở production. Viết thành hàm (không ternary trong constructor) vì
// overload của PrismaClient suy type $on() theo đúng shape literal của `log`.
function createPrismaClient() {
  if (!process.env.E2E_LOG_FILE) return new PrismaClient();

  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("query", (e) => {
    logger.debug(
      { query: e.query, params: e.params, duration: e.duration },
      "prisma query",
    );
  });
  client.$on("warn", (e) => logger.warn({ message: e.message }, "prisma warn"));
  client.$on("error", (e) =>
    logger.error({ message: e.message }, "prisma error"),
  );

  return client;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
