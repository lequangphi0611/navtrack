import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { computeCashflowAmount, derivePosition } from "./cost-basis";

describe("computeCashflowAmount", () => {
  test("BUY: amount âm, gồm cả phí", () => {
    const amount = computeCashflowAmount({
      type: "BUY",
      quantity: new Decimal(100),
      pricePerUnit: new Decimal(100_000),
      feeAmount: new Decimal(0),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("-10000000");
  });

  test("SELL: amount dương, trừ phí và thuế", () => {
    const amount = computeCashflowAmount({
      type: "SELL",
      quantity: new Decimal(50),
      pricePerUnit: new Decimal(130_000),
      feeAmount: new Decimal(0),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("6500000");
  });

  test("BUY có phí: trừ thêm vào tiền bỏ ra", () => {
    const amount = computeCashflowAmount({
      type: "BUY",
      quantity: new Decimal(100),
      pricePerUnit: new Decimal(100_000),
      feeAmount: new Decimal(20_000),
      taxAmount: new Decimal(0),
    });
    expect(amount.toString()).toBe("-10020000");
  });

  test("SELL có phí + thuế: trừ khỏi tiền nhận", () => {
    const amount = computeCashflowAmount({
      type: "SELL",
      quantity: new Decimal(50),
      pricePerUnit: new Decimal(130_000),
      feeAmount: new Decimal(10_000),
      taxAmount: new Decimal(6_500),
    });
    expect(amount.toString()).toBe("6483500");
  });
});

// derivePosition() (lib/cost-basis.ts) là cài đặt DUY NHẤT của công thức bình
// quân di động — nhận CẢ Cashflow (BUY/SELL) LẪN cổ tức cổ phiếu. Nhóm test
// đầu (không có cổ tức nào, stockDividends=[]) trước từng thuộc về một hàm
// "gốc" chỉ-Cashflow riêng (đã xoá, process/DECISION.md 2026-07-24 (4)) — gộp
// về đây để tránh lặp lại pattern "2 cài đặt song song của cùng công thức".
describe("derivePosition", () => {
  test("ví dụ FPT: mua-mua-bán một phần, giá vốn bình quân đúng theo domain doc", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-2",
          type: "BUY",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(130_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("150");
    expect(position.avgCost.toString()).toBe("110000");
    expect(position.wentNegative).toBe(false);
  });

  test("giá vốn bình quân sau lần mua đầu tiên bằng đúng giá mua", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.avgCost.toString()).toBe("100000");
  });

  test("bán vượt số lượng đang giữ tại thời điểm bán -> wentNegative = true", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(150),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.wentNegative).toBe(true);
  });

  test("bán hết rồi mua lại: giá vốn bình quân bắt đầu lại từ đầu", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-2",
          type: "BUY",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(200_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("50");
    expect(position.avgCost.toString()).toBe("200000");
    expect(position.wentNegative).toBe(false);
  });

  test("bán đúng hết số lượng đang giữ -> quantity và avgCost về 0", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("0");
    expect(position.avgCost.toString()).toBe("0");
    expect(position.wentNegative).toBe(false);
  });

  test("số lượng thập phân (vàng tính theo chỉ) tính giá vốn bình quân đúng", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal("0.5"),
          pricePerUnit: new Decimal(6_000_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-2",
          type: "BUY",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal("0.25"),
          pricePerUnit: new Decimal(6_400_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("0.75");
    // (0.5*6,000,000 + 0.25*6,400,000) / 0.75 = 6,133,333.33...
    expect(position.avgCost.toFixed(2)).toBe("6133333.33");
  });

  test("không có giao dịch nào -> vị thế rỗng", () => {
    const position = derivePosition([], []);

    expect(position.quantity.toString()).toBe("0");
    expect(position.avgCost.toString()).toBe("0");
    expect(position.wentNegative).toBe(false);
  });

  test("thứ tự nhập không theo ngày vẫn được phát lại đúng theo ngày", () => {
    const position = derivePosition(
      [
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(130_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-2",
          type: "BUY",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("150");
    expect(position.avgCost.toString()).toBe("110000");
  });

  // Đóng issue #66 (docs/domain/07-tax.md mục "Ví dụ", docs/domain/02-transactions-and-cost-basis.md
  // mục "Cách tính") — phí mua giờ gộp vào avgCost.
  test("mua có phí: avgCost gộp phí mua theo đúng ví dụ domain doc (100 FPT giá 100k, phí 30.000 -> 100.300)", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(30_000),
        },
      ],
      [],
    );

    expect(position.avgCost.toString()).toBe("100300");
  });

  test("bán có phí KHÔNG ảnh hưởng avgCost — phí bán chỉ trừ vào amount khi bán, không gộp vào giá vốn", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(130_000),
          feeAmount: new Decimal(19_500),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("50");
    // avgCost vẫn 100.000 dù lệnh bán có phí 19.500 — phí bán không gộp vào
    // giá vốn (tránh trừ trùng ở bước "lãi/lỗ đã thực hiện").
    expect(position.avgCost.toString()).toBe("100000");
  });

  // Issue #59: một cài đặt chỉ-biết-Cashflow (đã xoá) bỏ sót Dividend{STOCK}
  // -> SL sai VÀ wentNegative có thể báo "bán vượt" SAI cho lệnh bán thực ra
  // hợp lệ (SL bán nằm trong phần cổ tức cổ phiếu, không phải mua). Xem
  // cost-basis.ts.
  test("cổ tức cổ phiếu cộng vào SL, KHÔNG đổi avgCost (docs/domain/03-dividends.md)", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(10),
        },
      ],
    );

    expect(position.quantity.toString()).toBe("110");
    expect(position.avgCost.toString()).toBe("100000");
    expect(position.wentNegative).toBe(false);
  });

  test("bán vượt số Cashflow-only nhưng HỢP LỆ nhờ cổ tức cổ phiếu đã nhận trước đó -> wentNegative = false", () => {
    // 100 mua + 10 cổ tức (nhận TRƯỚC khi bán) = 110 đang giữ -> bán 105 hợp lệ.
    // Một cài đặt chỉ tính Cashflow (không biết 10 CP thưởng) sẽ SAI báo âm.
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(105),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(10),
        },
      ],
    );

    expect(position.quantity.toString()).toBe("5");
    expect(position.wentNegative).toBe(false);
  });

  test("bán vượt THẬT SỰ (vẫn âm dù đã cộng cổ tức) -> wentNegative = true", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(200),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(10),
        },
      ],
    );

    expect(position.wentNegative).toBe(true);
  });

  test("cổ tức nhận SAU khi bán không hồi tố cho lệnh bán trước đó -> vẫn báo bán vượt đúng thời điểm", () => {
    // Bán 105 tại 2026-02-01 khi mới có 100 CP (cổ tức 10 CP đến SAU, 2026-03-01)
    // -> tại THỜI ĐIỂM bán vẫn là bán vượt, dù tổng cuối cùng (nếu cộng dồn không
    // quan tâm thứ tự) sẽ dương. Xác nhận phép replay tôn trọng thứ tự thời gian.
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(100_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "sell-1",
          type: "SELL",
          date: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
          quantity: new Decimal(105),
          pricePerUnit: new Decimal(120_000),
          feeAmount: new Decimal(0),
        },
      ],
      [
        {
          id: "div-1",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(10),
        },
      ],
    );

    expect(position.wentNegative).toBe(true);
  });

  // Sửa lần 2 (retrofit, process/DECISION.md sau 2026-07-24 (2)) — bug write-
  // path: bán một phần (không đóng hết, kể cả tính CP từ cổ tức) rồi mua tiếp.
  // Code CŨ lấy avgCost thẳng từ derivePosition(cashflows) cũ (chỉ-Cashflow,
  // đã xoá) — chỉ phát lại BUY/SELL, không biết cổ tức cổ phiếu — nên quantity
  // nội bộ chỉ-cashflow của nó là 100-105=-5 (không bao giờ về 0), điều kiện
  // reset avgCost không kích hoạt -> avgCost SAI = 211.875 thay vì đúng
  // 171.500 (đối chiếu tính tay bên dưới). Test này là oracle bắt đúng bug đó.
  test("bán một phần (không đóng hết) rồi mua tiếp: avgCost tính đúng theo SL thực gồm cổ tức", () => {
    const cashflows = [
      {
        id: "buy-1",
        type: "BUY" as const,
        date: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(10_000),
        feeAmount: new Decimal(0),
      },
      {
        id: "sell-1",
        type: "SELL" as const,
        date: new Date("2026-03-01"),
        createdAt: new Date("2026-03-01"),
        quantity: new Decimal(105),
        pricePerUnit: new Decimal(12_000),
        feeAmount: new Decimal(0),
      },
      {
        id: "buy-2",
        type: "BUY" as const,
        date: new Date("2026-04-01"),
        createdAt: new Date("2026-04-01"),
        quantity: new Decimal(85),
        pricePerUnit: new Decimal(200_000),
        feeAmount: new Decimal(0),
      },
    ];
    const stockDividends = [
      {
        id: "div-1",
        date: new Date("2026-02-01"),
        createdAt: new Date("2026-02-01"),
        quantity: new Decimal(20),
      },
    ];

    const position = derivePosition(cashflows, stockDividends);

    // SL thực: 100 (buy-1) +20 (div-1) =120 -105 (sell-1) =15 +85 (buy-2) =100.
    // avgCost = (15*10.000 + 85*200.000) / 100 = 171.500.
    expect(position.quantity.toString()).toBe("100");
    expect(position.avgCost.toString()).toBe("171500");
    expect(position.wentNegative).toBe(false);
  });
});
