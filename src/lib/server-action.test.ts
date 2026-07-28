import { describe, expect, test, vi } from "vitest";

import { Prisma } from "@prisma/client";

// server-action.ts import getSession từ @/lib/auth ở top-level (dùng bởi
// requireUserId/parseAuthenticated, KHÔNG dùng bởi handleWriteError — hàm duy
// nhất test này exercise). @/lib/auth kéo theo next-auth -> next/server, không
// resolve được trong môi trường Vitest node (lý do thật khiến features/*/
// actions.ts không có unit test trực tiếp, theo docs/rules/testing.md). Stub
// rỗng ở đây KHÔNG che giấu logic được test (handleWriteError không đụng
// module này) — chỉ né lỗi resolve module không liên quan tới hành vi đang
// kiểm chứng.
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { handleWriteError } from "./server-action";

// handleWriteError là logic phân nhánh THẬT (không phải vỏ mỏng chỉ chuyển
// tiếp I/O) — quyết định message theo err.code, ưu tiên override, và bắt buộc
// rethrow mọi lỗi khác. features/*/actions.ts (0 unit test theo docs/rules/
// testing.md "Tách core thuần") không exercise được nhánh throw non-race lẫn
// nhánh default-message vì mọi test action hiện có đều đi qua Prisma thật
// (chỉ e2e mới tạo race thật) — viết trực tiếp ở đây để không phải mock DB.
function makeKnownRequestError(
  code: string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`mock ${code}`, {
    code,
    clientVersion: "test",
  });
}

describe("handleWriteError", () => {
  test("P2002 dùng message mặc định khi không có override", () => {
    const result = handleWriteError(makeKnownRequestError("P2002"), {
      action: "testAction",
    });
    expect(result).toEqual({
      ok: false,
      error: "Có giao dịch trùng đang được xử lý, vui lòng thử lại",
    });
  });

  test("P2034 dùng message mặc định khi không có override", () => {
    const result = handleWriteError(makeKnownRequestError("P2034"), {
      action: "testAction",
    });
    expect(result).toEqual({
      ok: false,
      error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
    });
  });

  test("dùng message override riêng cho từng mã lỗi khi ctx.messages có mặt", () => {
    const messages = {
      p2002: "Có thao tác mời đang xử lý đồng thời, vui lòng thử lại",
      p2034: "Có thao tác mời đang xử lý đồng thời, vui lòng thử lại",
    };

    const p2002Result = handleWriteError(makeKnownRequestError("P2002"), {
      action: "inviteMember",
      messages,
    });
    const p2034Result = handleWriteError(makeKnownRequestError("P2034"), {
      action: "inviteMember",
      messages,
    });

    expect(p2002Result).toEqual({ ok: false, error: messages.p2002 });
    expect(p2034Result).toEqual({ ok: false, error: messages.p2034 });
  });

  test("override chỉ có p2002 thì p2034 vẫn rơi về mặc định (Partial override)", () => {
    const result = handleWriteError(makeKnownRequestError("P2034"), {
      action: "testAction",
      messages: { p2002: "custom p2002 only" },
    });
    expect(result).toEqual({
      ok: false,
      error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
    });
  });

  test("mã lỗi Prisma khác P2002/P2034 (vd P2025) bị rethrow nguyên trạng, không nuốt", () => {
    const err = makeKnownRequestError("P2025");
    expect(() => handleWriteError(err, { action: "testAction" })).toThrow(err);
  });

  test("lỗi không phải PrismaClientKnownRequestError bị rethrow nguyên trạng", () => {
    const err = new Error("unexpected failure");
    expect(() => handleWriteError(err, { action: "testAction" })).toThrow(err);
  });
});
