import { describe, expect, test } from "vitest";

import { computeHoldingPeriodLabel } from "./holding-period";

describe("computeHoldingPeriodLabel", () => {
  test("14 tháng 6 ngày (khớp ví dụ mockup 6i)", () => {
    const label = computeHoldingPeriodLabel(
      new Date("2024-01-19T00:00:00Z"),
      new Date("2025-03-25T00:00:00Z"),
    );
    expect(label).toBe("14 tháng 6 ngày");
  });

  test("mượn tháng khi ngày kết thúc < ngày bắt đầu trong tháng", () => {
    // 2024-01-31 -> 2024-03-05: tháng 2 chỉ mượn được tới cuối tháng 2 (năm
    // nhuận, 29 ngày) -> 1 tháng đầy + 3 ngày dư.
    const label = computeHoldingPeriodLabel(
      new Date("2024-01-31T00:00:00Z"),
      new Date("2024-03-05T00:00:00Z"),
    );
    expect(label).toBe("1 tháng 3 ngày");
  });

  test("mua bán cùng ngày -> 0 ngày", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(computeHoldingPeriodLabel(date, date)).toBe("0 ngày");
  });

  test("chỉ tròn tháng, không lẻ ngày", () => {
    const label = computeHoldingPeriodLabel(
      new Date("2024-01-10T00:00:00Z"),
      new Date("2024-04-10T00:00:00Z"),
    );
    expect(label).toBe("3 tháng");
  });

  test("dưới 1 tháng, chỉ hiện số ngày", () => {
    const label = computeHoldingPeriodLabel(
      new Date("2024-01-10T00:00:00Z"),
      new Date("2024-01-20T00:00:00Z"),
    );
    expect(label).toBe("10 ngày");
  });
});
