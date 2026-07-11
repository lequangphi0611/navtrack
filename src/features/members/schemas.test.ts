import { describe, expect, test } from "vitest";

import { inviteSchema } from "./schemas";

describe("inviteSchema", () => {
  test("email hợp lệ được chấp nhận", () => {
    const result = inviteSchema.safeParse({ email: "member@example.com" });
    expect(result.success).toBe(true);
  });

  test("email được chuyển về chữ thường", () => {
    const result = inviteSchema.safeParse({ email: "Member@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("member@example.com");
    }
  });

  test("khoảng trắng thừa quanh email bị trim", () => {
    const result = inviteSchema.safeParse({ email: "  member@example.com  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("member@example.com");
    }
  });

  test("chuỗi không phải email bị từ chối", () => {
    expect(inviteSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  test("email rỗng bị từ chối", () => {
    expect(inviteSchema.safeParse({ email: "" }).success).toBe(false);
  });
});
