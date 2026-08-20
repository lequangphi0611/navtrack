import { describe, expect, test } from "vitest";

import { ROUTES, resolveBackHref } from "./routes";

// resolveBackHref — hạ tầng chung cho route đa lối-vào (fan-in), xem
// docs/rules/component-architecture.md mục "Route đa lối-vào (fan-in)" +
// process/decisions/architecture-and-code-quality.md 2026-08-20.
describe("resolveBackHref", () => {
  test("source khớp key trong sourceMap -> trả đúng giá trị map", () => {
    const backHref = resolveBackHref(
      "dashboard",
      { dashboard: ROUTES.dashboard },
      ROUTES.holdings,
    );

    expect(backHref).toBe(ROUTES.dashboard);
  });

  test("source hợp lệ (thuộc EntrySource) nhưng route không khai trong sourceMap -> fallback", () => {
    const backHref = resolveBackHref(
      "allocation-stock",
      { dashboard: ROUTES.dashboard },
      ROUTES.holdings,
    );

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("source là string rác không thuộc EntrySource -> fallback", () => {
    const backHref = resolveBackHref(
      "some-random-value",
      { dashboard: ROUTES.dashboard },
      ROUTES.holdings,
    );

    expect(backHref).toBe(ROUTES.holdings);
  });

  test("from vắng mặt (undefined) -> fallback", () => {
    const backHref = resolveBackHref(
      undefined,
      { dashboard: ROUTES.dashboard },
      ROUTES.holdings,
    );

    expect(backHref).toBe(ROUTES.holdings);
  });
});
