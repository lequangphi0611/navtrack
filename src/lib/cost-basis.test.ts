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

  // Phase 7 (process/phase-7.md mục 2): xác nhận công thức chung SELL/MATURITY
  // ở computeCashflowAmount() cũng đúng cho tất toán trái phiếu — không "sửa
  // mù" chỉ vì switch compile được. gross=100*100.000=10.000.000; amount =
  // gross - fee - tax = 10.000.000 - 10.000 - 6.500 = 9.983.500.
  test("MATURITY: amount dương, trừ phí và thuế lãi — cùng công thức với SELL", () => {
    const amount = computeCashflowAmount({
      type: "MATURITY",
      quantity: new Decimal(100),
      pricePerUnit: new Decimal(100_000),
      feeAmount: new Decimal(10_000),
      taxAmount: new Decimal(6_500),
    });
    expect(amount.toString()).toBe("9983500");
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
  // Sửa lần 5 (bugfix, process/DECISION.md 2026-08-13): trước đây test này
  // assert "avgCost KHÔNG đổi" — đó là oracle SAI, xác nhận đúng bug thay vì
  // bắt bug. avgCost phải PHA LOÃNG (dilute) theo công thức đóng: avgCost_mới
  // = SL_trước × avgCost_cũ / SL_sau. Chọn SL cổ tức=25 để SL_sau=125 chỉ có
  // ước số nguyên tố 5 (tránh thập phân vô hạn tuần hoàn khi đối chiếu số cụ
  // thể) — xem docs/domain/03-dividends.md mục "Cách tính".
  test("cổ tức cổ phiếu cộng vào SL VÀ pha loãng avgCost theo công thức đóng (docs/domain/03-dividends.md)", () => {
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
          quantity: new Decimal(25),
        },
      ],
    );

    // SL: 100 + 25 = 125. avgCost = 100×100.000/125 = 80.000.
    expect(position.quantity.toString()).toBe("125");
    expect(position.avgCost.toString()).toBe("80000");
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
  // nội bộ chỉ-cashflow của nó không bao giờ về 0, điều kiện reset avgCost
  // không kích hoạt. Test này là oracle bắt đúng bug đó — vẫn là oracle dùng
  // để đối chiếu chéo với realized-pnl.test.ts.
  //
  // Sửa lần 5 (bugfix, process/DECISION.md 2026-08-13): bộ số ĐỔI so với bản
  // gốc — cổ tức cổ phiếu giờ PHA LOÃNG avgCost (trước đây "KHÔNG đổi" là
  // bug), nên số cũ (SL cổ tức=20, SELL=105, BUY=85, avgCost kỳ vọng=171.500)
  // không còn đúng nữa. Đổi SL cổ tức=25 để SL ngay-sau-cổ-tức=125 chỉ có ước
  // số nguyên tố 5 (tránh thập phân vô hạn tuần hoàn) — đổi ĐỒNG BỘ cả SELL/
  // BUY theo sau để vẫn giữ đúng tinh thần ca biên gốc (bán một phần không
  // đóng hết, rồi mua tiếp).
  test("bán một phần (không đóng hết) rồi mua tiếp: avgCost tính đúng theo SL thực gồm cổ tức, có pha loãng", () => {
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
        quantity: new Decimal(100),
        pricePerUnit: new Decimal(12_000),
        feeAmount: new Decimal(0),
      },
      {
        id: "buy-2",
        type: "BUY" as const,
        date: new Date("2026-04-01"),
        createdAt: new Date("2026-04-01"),
        quantity: new Decimal(75),
        pricePerUnit: new Decimal(200_000),
        feeAmount: new Decimal(0),
      },
    ];
    const stockDividends = [
      {
        id: "div-1",
        date: new Date("2026-02-01"),
        createdAt: new Date("2026-02-01"),
        quantity: new Decimal(25),
      },
    ];

    const position = derivePosition(cashflows, stockDividends);

    // SL thực: 100 (buy-1) +25 (div-1) =125 -100 (sell-1) =25 +75 (buy-2) =100.
    // avgCost sau div-1 (dilute) = 100×10.000/125 = 8.000 (SELL không đổi avgCost).
    // avgCost sau buy-2 = (25×8.000 + 75×200.000) / 100 = 152.000.
    expect(position.quantity.toString()).toBe("100");
    expect(position.avgCost.toString()).toBe("152000");
    expect(position.wentNegative).toBe(false);
  });

  // Phase 7 (process/phase-7.md mục 2, "Rà lại các predicate === 'BUY'"):
  // MATURITY phải rơi vào nhánh "không phải BUY" ở vòng lặp avgCost (chỉ trừ
  // quantity, KHÔNG gộp giá đáo hạn vào giá vốn bình quân) — xác nhận bằng
  // test thay vì chỉ tin switch compile được.
  test("MATURITY (tất toán trái phiếu) hành xử như SELL: giảm SL về 0, avgCost reset về 0", () => {
    const position = derivePosition(
      [
        {
          id: "buy-1",
          type: "BUY",
          date: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(1_000_000),
          feeAmount: new Decimal(0),
        },
        {
          id: "maturity-1",
          type: "MATURITY",
          date: new Date("2026-06-01"),
          createdAt: new Date("2026-06-01"),
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(1_000_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    expect(position.quantity.toString()).toBe("0");
    expect(position.avgCost.toString()).toBe("0");
    expect(position.wentNegative).toBe(false);
  });

  test("MATURITY tất toán MỘT PHẦN rồi mua tiếp: avgCost chỉ theo SL thực còn lại, KHÔNG bị pricePerUnit đáo hạn (parValue) làm lệch", () => {
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
          id: "maturity-1",
          type: "MATURITY",
          date: new Date("2026-03-01"),
          createdAt: new Date("2026-03-01"),
          quantity: new Decimal(40),
          // pricePerUnit cố tình lệch xa avgCost thật — nếu MATURITY bị tính
          // nhầm vào avgCost (như BUY) thì kết quả sẽ sai rất lớn.
          pricePerUnit: new Decimal(999_999_999),
          feeAmount: new Decimal(0),
        },
        {
          id: "buy-2",
          type: "BUY",
          date: new Date("2026-04-01"),
          createdAt: new Date("2026-04-01"),
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(200_000),
          feeAmount: new Decimal(0),
        },
      ],
      [],
    );

    // SL thực: 100 - 40 (MATURITY) + 50 = 110.
    // avgCost = (60*100.000 + 50*200.000) / 110 = 16.000.000 / 110 = 145.454,545...
    expect(position.quantity.toString()).toBe("110");
    expect(position.avgCost.toFixed(2)).toBe("145454.55");
    expect(position.wentNegative).toBe(false);
  });
});
