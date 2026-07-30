import type { z } from "zod";

import { Prisma } from "@prisma/client";
import type { ActionFailure } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const UNAUTHENTICATED_MESSAGE = "Chưa đăng nhập";

// Prologue dùng chung: lấy userId từ session server-side, KHÔNG tin bất kỳ id
// nào truyền từ client (docs/rules/data-prisma.md "Bảo mật / tách dữ liệu
// theo user"). Trả ActionFailure (không throw) — thiếu session là lỗi lường
// trước (docs/rules/error-handling.md "Phân loại lỗi"), không phải bug.
export async function requireUserId(): Promise<
  { ok: true; userId: string } | ActionFailure
> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: UNAUTHENTICATED_MESSAGE };
  return { ok: true, userId: session.user.id };
}

// Gộp 2 bước prologue lặp lại ở mọi Server Action ghi dữ liệu: parse Zod
// schema rồi mới check session — cố ý parse TRƯỚC auth (khớp thứ tự hiện có ở
// mọi action: input rác trả lỗi validate ngay, không cần round-trip session
// trước). Trả ActionFailure structurally khớp mọi state type theo pattern
// ActionResult<T> hiện có (kể cả *FormState dùng useActionState) — caller chỉ
// cần `return ctx;` khi `!ctx.ok`, TypeScript tự khớp nhánh fail của union.
export async function parseAuthenticated<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): Promise<
  { ok: true; data: z.infer<Schema>; userId: string } | ActionFailure
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  return { ok: true, data: parsed.data, userId: auth.userId };
}

type RaceMessages = { p2002?: string; p2034?: string };

// Message mặc định lấy nguyên văn từ createHolding (features/holdings/actions.ts)
// — action ĐẦU TIÊN xử lý cả P2002 lẫn P2034 đúng, các action khác (addTransaction/
// updateTransaction/deleteTransaction/recordDividend) trước đây chỉ bắt P2034
// bằng đúng câu này, nay cũng bắt cả P2002 với cùng default (an toàn: các
// action đó ghi qua insertCashflow/insertDividend, không có unique constraint
// nào khác id/cuid nên P2002 thực tế không nổ ra, chỉ nhất quán hơn).
const DEFAULT_RACE_MESSAGES: Required<RaceMessages> = {
  p2002: "Có giao dịch trùng đang được xử lý, vui lòng thử lại",
  p2034: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
};

// Epilogue catch dùng chung cho pattern check-rồi-ghi trong $transaction
// (docs/rules/data-prisma.md "Race condition khi check-rồi-ghi (TOCTOU)"):
// request thua trong đua tranh gặp lỗi ràng buộc unique (P2002) hoặc
// serialization conflict (P2034, khi transaction chạy Serializable) — đây LÀ
// lỗi lường trước được (docs/rules/error-handling.md "Phân loại lỗi"), map
// sang ActionFailure yêu cầu thử lại thay vì để throw ra `error.tsx`. Mọi mã
// lỗi khác/lỗi bất ngờ vẫn log rồi throw nguyên trạng — KHÔNG nuốt lỗi.
export function handleWriteError(
  err: unknown,
  ctx: { action: string; messages?: RaceMessages } & Record<string, unknown>,
): ActionFailure {
  const { action, messages, ...context } = ctx;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2002" || err.code === "P2034")
  ) {
    const key = err.code === "P2002" ? "p2002" : "p2034";
    const message = messages?.[key] ?? DEFAULT_RACE_MESSAGES[key];
    logger.warn({ ...context, code: err.code }, `${action} race, ask to retry`);
    return { ok: false, error: message };
  }
  logger.error({ ...context, err }, `${action} failed`);
  throw err;
}
