import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import {
  computeRealizedGainForHolding,
  computeUnrealizedGain,
  type RealizedGainCashflowInput,
  type RealizedGainStockDividendInput,
} from "./realized-pnl";

const d = (isoDate: string): Date => new Date(isoDate);

describe("computeRealizedGainForHolding", () => {
  test("mua rồi bán một phần: lãi chốt = tiền nhận - SL bán * avgCost", () => {
    const cashflows: RealizedGainCashflowInput[] = [
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-06-01"),
        createdAt: d("2023-06-01"),
        quantity: new Decimal(40),
        amount: new Decimal(480_000),
      },
    ];

    // avgCost = 1.000.000 / 100 = 10.000; realized = 480.000 - 40*10.000 = 80.000.
    expect(computeRealizedGainForHolding(cashflows).toString()).toBe("80000");
  });

  test("bán hết rồi mua lại: avgCost reset đúng theo giao dịch mua sau", () => {
    const cashflows: RealizedGainCashflowInput[] = [
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-03-01"),
        createdAt: d("2023-03-01"),
        quantity: new Decimal(100),
        amount: new Decimal(1_200_000),
      },
      {
        id: "cf3",
        type: "BUY",
        date: d("2023-06-01"),
        createdAt: d("2023-06-01"),
        quantity: new Decimal(50),
        amount: new Decimal(-400_000),
      },
      {
        id: "cf4",
        type: "SELL",
        date: d("2023-09-01"),
        createdAt: d("2023-09-01"),
        quantity: new Decimal(50),
        amount: new Decimal(450_000),
      },
    ];

    // Lần 1: avgCost=10.000, realized=1.200.000-100*10.000=200.000, SL về 0
    // (avgCost reset). Lần 2: avgCost=8.000 (KHÔNG kế thừa avgCost=10.000 cũ),
    // realized=450.000-50*8.000=50.000. Tổng = 250.000.
    expect(computeRealizedGainForHolding(cashflows).toString()).toBe("250000");
  });

  test("nhiều lần bán xen kẽ mua (3 mua + 3 bán): avgCost cập nhật đúng bình quân di động mỗi lần mua", () => {
    const cashflows: RealizedGainCashflowInput[] = [
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
      // avgCost=10.000, realized += 220.000-20*10.000=20.000, qty=80.
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-02-01"),
        createdAt: d("2023-02-01"),
        quantity: new Decimal(20),
        amount: new Decimal(220_000),
      },
      // newQty=100, avgCost=(80*10.000+240.000)/100=10.400.
      {
        id: "cf3",
        type: "BUY",
        date: d("2023-03-01"),
        createdAt: d("2023-03-01"),
        quantity: new Decimal(20),
        amount: new Decimal(-240_000),
      },
      // realized += 550.000-50*10.400=30.000, qty=50.
      {
        id: "cf4",
        type: "SELL",
        date: d("2023-04-01"),
        createdAt: d("2023-04-01"),
        quantity: new Decimal(50),
        amount: new Decimal(550_000),
      },
      // newQty=100, avgCost=(50*10.400+450.000)/100=9.700.
      {
        id: "cf5",
        type: "BUY",
        date: d("2023-05-01"),
        createdAt: d("2023-05-01"),
        quantity: new Decimal(50),
        amount: new Decimal(-450_000),
      },
      // realized += 1.000.000-100*9.700=30.000, qty=0.
      {
        id: "cf6",
        type: "SELL",
        date: d("2023-06-01"),
        createdAt: d("2023-06-01"),
        quantity: new Decimal(100),
        amount: new Decimal(1_000_000),
      },
    ];

    // Tổng realized = 20.000 + 30.000 + 30.000 = 80.000.
    expect(computeRealizedGainForHolding(cashflows).toString()).toBe("80000");
  });

  test("sort theo date tăng dần bất kể thứ tự truyền vào", () => {
    const buyLast: RealizedGainCashflowInput[] = [
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-06-01"),
        createdAt: d("2023-06-01"),
        quantity: new Decimal(40),
        amount: new Decimal(480_000),
      },
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
    ];

    expect(computeRealizedGainForHolding(buyLast).toString()).toBe("80000");
  });

  // Issue #83 code review #1 — cổ tức cổ phiếu không tạo Cashflow (cộng thẳng
  // vào Holding.quantity, features/dividends/actions.ts) nên realQuantity phải
  // gồm cả cổ tức để biết đúng lúc vị thế thực sự đóng hết. Số đã tính tay
  // (oracle bắt đúng bug — vẫn đúng với thiết kế "1 bộ đếm realQuantity" sửa
  // lần 2, process/DECISION.md sau 2026-07-24 (2)):
  // 1. BUY 100, amount=-1.000.000 -> avgCost=10.000, realQuantity=100.
  // 2. Cổ tức cổ phiếu +20 -> realQuantity=120, avgCost KHÔNG đổi.
  // 3. SELL 120, amount=1.300.000 -> realizedGain = 1.300.000-120*10.000=100.000;
  //    realQuantity về 0.
  // 4. BUY 50, amount=-600.000 -> realQuantityTrước=0 nên avgCost lô mới =
  //    (0*10.000+600.000)/50=12.000 (nếu không "quên" avgCost cũ đúng lúc sẽ
  //    ra 13.333,33 — bắt đúng bug qua bước 5).
  // 5. SELL 30, amount=390.000 -> += 390.000-30*12.000=30.000.
  // Tổng kỳ vọng = 100.000 + 30.000 = 130.000.
  test("cổ tức cổ phiếu: realQuantity quyết định avgCost, kể cả khi về 0 rồi mua lại", () => {
    const cashflows: RealizedGainCashflowInput[] = [
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-03-01"),
        createdAt: d("2023-03-01"),
        quantity: new Decimal(120),
        amount: new Decimal(1_300_000),
      },
      {
        id: "cf3",
        type: "BUY",
        date: d("2023-04-01"),
        createdAt: d("2023-04-01"),
        quantity: new Decimal(50),
        amount: new Decimal(-600_000),
      },
      {
        id: "cf4",
        type: "SELL",
        date: d("2023-05-01"),
        createdAt: d("2023-05-01"),
        quantity: new Decimal(30),
        amount: new Decimal(390_000),
      },
    ];
    const stockDividends: RealizedGainStockDividendInput[] = [
      {
        id: "div1",
        date: d("2023-02-01"),
        createdAt: d("2023-02-01"),
        quantity: new Decimal(20),
      },
    ];

    expect(
      computeRealizedGainForHolding(cashflows, stockDividends).toString(),
    ).toBe("130000");
  });

  // Sửa lần 2 (retrofit, process/DECISION.md sau 2026-07-24 (2)) — ca biên
  // thiết kế "2 bộ đếm song song" cũ (đã merge) KHÔNG xử lý đúng: BÁN MỘT
  // PHẦN (không đóng hết, kể cả tính CP từ cổ tức) rồi mua tiếp, khác test
  // trên (đóng hết rồi mua lại). Bộ số khớp test cost-basis.test.ts
  // "bán một phần (không đóng hết) rồi mua tiếp" để đối chiếu avgCost 171.500.
  // Tính tay theo thiết kế MỚI (1 bộ đếm realQuantity, oracle đúng):
  // 1. BUY 100, amount=-1.000.000 -> avgCost=10.000, realQuantity=100.
  // 2. Cổ tức cổ phiếu +20 -> realQuantity=120, avgCost KHÔNG đổi.
  // 3. SELL 105, amount=1.260.000 -> realizedGain += 1.260.000-105*10.000=210.000;
  //    realQuantity=15 (KHÔNG về 0 — ca biên mà thiết kế cũ xử lý sai).
  // 4. BUY 85, amount=-17.000.000 -> avgCost mới = (15*10.000+17.000.000)/100
  //    = 171.500 (khớp test cost-basis). realQuantity=100.
  // 5. SELL 100 (đóng hết), amount=25.000.000 -> realizedGain +=
  //    25.000.000-100*171.500=7.850.000.
  // Tổng kỳ vọng = 210.000 + 7.850.000 = 8.060.000 (chính xác tuyệt đối).
  // Thiết kế "2 bộ đếm" CŨ (sai): avgCostQuantity chỉ-cashflow không bao giờ
  // về 0 (100-105=-5) nên không reset -> avgCost lô 2 tính SAI, ra tổng
  // realizedGain = 4.022.500 thay vì 8.060.000 — test này là oracle bắt đúng
  // bug đó.
  test("bán một phần (không đóng hết) rồi mua tiếp, sau đó đóng hết: realizedGain tính đúng theo avgCost mới", () => {
    const cashflows: RealizedGainCashflowInput[] = [
      {
        id: "cf1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_000_000),
      },
      {
        id: "cf2",
        type: "SELL",
        date: d("2023-03-01"),
        createdAt: d("2023-03-01"),
        quantity: new Decimal(105),
        amount: new Decimal(1_260_000),
      },
      {
        id: "cf3",
        type: "BUY",
        date: d("2023-04-01"),
        createdAt: d("2023-04-01"),
        quantity: new Decimal(85),
        amount: new Decimal(-17_000_000),
      },
      {
        id: "cf4",
        type: "SELL",
        date: d("2023-05-01"),
        createdAt: d("2023-05-01"),
        quantity: new Decimal(100),
        amount: new Decimal(25_000_000),
      },
    ];
    const stockDividends: RealizedGainStockDividendInput[] = [
      {
        id: "div1",
        date: d("2023-02-01"),
        createdAt: d("2023-02-01"),
        quantity: new Decimal(20),
      },
    ];

    expect(
      computeRealizedGainForHolding(cashflows, stockDividends).toString(),
    ).toBe("8060000");
  });

  // Issue #83 code review #4 — tiebreak (date, createdAt, id) phải ổn định,
  // không phụ thuộc thứ tự phần tử trong mảng input truyền vào.
  test("2 cashflow cùng date khác id: kết quả không phụ thuộc thứ tự mảng đầu vào", () => {
    const cfA: RealizedGainCashflowInput = {
      id: "aaa",
      type: "BUY",
      date: d("2023-01-01"),
      createdAt: d("2023-01-01"),
      quantity: new Decimal(100),
      amount: new Decimal(-1_000_000),
    };
    const cfB: RealizedGainCashflowInput = {
      id: "bbb",
      type: "SELL",
      date: d("2023-01-01"),
      createdAt: d("2023-01-01"),
      quantity: new Decimal(40),
      amount: new Decimal(480_000),
    };

    const forward = computeRealizedGainForHolding([cfA, cfB]);
    const reversed = computeRealizedGainForHolding([cfB, cfA]);

    expect(forward.toString()).toBe(reversed.toString());
  });
});

describe("computeUnrealizedGain", () => {
  test("nhiều vị thế, có vị thế lời có vị thế lỗ", () => {
    const result = computeUnrealizedGain([
      { navValue: new Decimal(1_200_000), costBasis: new Decimal(1_000_000) }, // +200.000
      { navValue: new Decimal(800_000), costBasis: new Decimal(1_000_000) }, // -200.000
      { navValue: new Decimal(500_000), costBasis: new Decimal(400_000) }, // +100.000
    ]);

    expect(result.toString()).toBe("100000");
  });

  test("mảng rỗng -> 0", () => {
    expect(computeUnrealizedGain([]).toString()).toBe("0");
  });
});

// Issue #67 — bất biến toán học: realizedPnl + unrealizedPnl == absolutePnl
// (cutoff = hôm nay, không thiếu giá). Portfolio giả lập: holding A đã đóng
// hẳn (SL=0), holding B bán một phần đang còn mở, có cổ tức tiền mặt net.
describe("bất biến realized + unrealized == absolutePnl (issue #67)", () => {
  test("khớp tuyệt đối (sai lệch <= 1 VND) khi cộng dồn nhiều holding + cổ tức", () => {
    // Holding A (đã đóng, SL=0): mua 100 (gồm phí 10.000), bán hết 100.
    const holdingACashflows: RealizedGainCashflowInput[] = [
      {
        id: "a1",
        type: "BUY",
        date: d("2023-01-01"),
        createdAt: d("2023-01-01"),
        quantity: new Decimal(100),
        amount: new Decimal(-1_010_000),
      },
      {
        id: "a2",
        type: "SELL",
        date: d("2023-06-01"),
        createdAt: d("2023-06-01"),
        quantity: new Decimal(100),
        amount: new Decimal(1_190_000),
      },
    ];

    // Holding B (còn mở): mua 200 (gồm phí 5.000), bán một phần 50, còn giữ 150.
    const holdingBCashflows: RealizedGainCashflowInput[] = [
      {
        id: "b1",
        type: "BUY",
        date: d("2023-02-01"),
        createdAt: d("2023-02-01"),
        quantity: new Decimal(200),
        amount: new Decimal(-1_005_000),
      },
      {
        id: "b2",
        type: "SELL",
        date: d("2023-07-01"),
        createdAt: d("2023-07-01"),
        quantity: new Decimal(50),
        amount: new Decimal(295_000),
      },
    ];

    // Cổ tức tiền mặt net (đã trừ thuế).
    const dividendNetAmount = new Decimal(20_000);

    const realizedGainA = computeRealizedGainForHolding(holdingACashflows);
    const realizedGainB = computeRealizedGainForHolding(holdingBCashflows);
    const realizedPnl = realizedGainA
      .plus(realizedGainB)
      .plus(dividendNetAmount);

    // Vị thế B còn mở: avgCost = 1.005.000/200 = 5.025, còn giữ 150 ->
    // costBasis = 150*5.025 = 753.750. Giá thị trường giả định 7.000/đv ->
    // navValue = 150*7.000 = 1.050.000.
    const avgCostB = new Decimal(1_005_000).div(200);
    const remainingQuantityB = new Decimal(200).minus(50);
    const costBasisB = remainingQuantityB.mul(avgCostB);
    const navValueB = remainingQuantityB.mul(7_000);

    const unrealizedPnl = computeUnrealizedGain([
      { navValue: navValueB, costBasis: costBasisB },
    ]);

    // absolutePnl tính ĐỘC LẬP bằng công thức tay (KHÔNG gọi lại
    // computeXirrAndPnlCore, hàm đó cần DB): NAV hiện tại (chỉ B còn mở, A đã
    // đóng NAV=0) - Σ|BUY.amount| + ΣSELL.amount + Σ dividend.netAmount.
    const navNow = navValueB;
    const grossBuy = new Decimal(1_010_000).plus(1_005_000);
    const grossSell = new Decimal(1_190_000).plus(295_000);
    const absolutePnl = navNow
      .minus(grossBuy)
      .plus(grossSell)
      .plus(dividendNetAmount);

    const diff = realizedPnl.plus(unrealizedPnl).minus(absolutePnl).abs();

    expect(diff.lte(1)).toBe(true);
    // Số liệu cụ thể (VND) để đối chiếu khi có sai lệch trong tương lai.
    expect(realizedPnl.toString()).toBe("243750");
    expect(unrealizedPnl.toString()).toBe("296250");
    expect(absolutePnl.toString()).toBe("540000");
  });
});
