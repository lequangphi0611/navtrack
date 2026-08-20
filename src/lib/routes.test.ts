import { describe, expect, test } from "vitest";

import { resolveBackHref, ROUTES } from "./routes";

// resolveBackHref — hạ tầng chung cho route đa lối-vào (fan-in), xem
// docs/rules/component-architecture.md mục "Route đa lối-vào (fan-in)" +
// process/decisions/architecture-and-code-quality.md 2026-08-20.
describe("resolveBackHref", () => {
  test("from là internal path hợp lệ -> trả đúng from", () => {
    const backHref = resolveBackHref("/holdings/abc123", ROUTES.dashboard);

    expect(backHref).toBe("/holdings/abc123");
  });

  test("from là undefined -> fallback", () => {
    const backHref = resolveBackHref(undefined, ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("from là URL ngoài -> fallback (chặn open-redirect)", () => {
    const backHref = resolveBackHref("https://evil.com", ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("from là protocol-relative //evil.com -> fallback", () => {
    const backHref = resolveBackHref("//evil.com", ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });

  // Trình duyệt (WHATWG URL spec) coi backslash tương đương forward-slash
  // ngay sau ký tự đầu của 1 URL tương đối với scheme "special" (http/https):
  // `new URL("/\\evil.com", "https://navtrack.app")` thực tế trả về
  // "https://evil.com/" — tức "/\evil.com" LÀ protocol-relative dù không bắt
  // đầu bằng "//". isSafeInternalPath() hiện chỉ chặn "//", bỏ sót biến thể
  // backslash này -> open-redirect. Test này phải PASS để coi là đã vá.
  test("from là protocol-relative bằng backslash /\\evil.com -> fallback", () => {
    const backHref = resolveBackHref("/\\evil.com", ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("from là string rỗng -> fallback", () => {
    const backHref = resolveBackHref("", ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("from không bắt đầu bằng / -> fallback", () => {
    const backHref = resolveBackHref("dashboard", ROUTES.holdings);

    expect(backHref).toBe(ROUTES.holdings);
  });
});
