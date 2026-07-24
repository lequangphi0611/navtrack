import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";
import { sortByPositionTrailOrder } from "@/lib/position-trail";

// Tách thuần khỏi lib/cost-basis.ts (không đụng DB) — CỐ Ý KHÔNG mở rộng
// CashflowInput/derivePosition() ở đó: field cần ở đây (Cashflow.amount đã
// materialize, gồm phí/thuế) khác input derivePosition() cần
// (quantity/pricePerUnit/feeAmount thô, dùng ở 4 Server Action ghi giao dịch
// có test suite lớn) — process/DECISION.md issue #67.
// id/createdAt thêm để sort chung với cổ tức cổ phiếu bằng
// sortByPositionTrailOrder() (khớp tie-break convention toàn repo khi trùng
// ngày), xem RealizedGainStockDividendInput bên dưới.
export type RealizedGainCashflowInput = {
  id: string;
  type: CashflowType;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
  // Cashflow.amount đã materialize: BUY âm (gồm phí mua), SELL dương (đã trừ
  // phí + thuế bán) — docs/domain/02-transactions-and-cost-basis.md.
  amount: Decimal;
};

// Cổ tức cổ phiếu — quantity LUÔN dương (số CP nhận thêm), không tạo Cashflow
// (cộng thẳng vào Holding.quantity, xem features/dividends/actions.ts). Chỉ
// ảnh hưởng realQuantity bên dưới, KHÔNG đổi avgCost (đúng quy tắc domain,
// docs/domain/03-dividends.md).
export type RealizedGainStockDividendInput = {
  id: string;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
};

// Lãi/lỗ ĐÃ CHỐT (đã bán thật) của MỘT holding, tích luỹ qua toàn bộ lịch sử
// — caller phải lọc input đúng 1 holdingId trước khi gọi. Phát lại theo
// avgCost bình quân di động (cùng công thức derivePosition() ở cost-basis.ts,
// nhưng dùng amount đã materialize thay vì pricePerUnit thô — tương đương vì
// amount BUY = -(quantity*price + fee), tử số avgCost ở đây dùng amount.abs()
// đã GỒM SẴN phí mua): mỗi lần bán, lãi/lỗ chốt = tiền thực nhận (amount) −
// (SL bán × avgCost tại thời điểm bán). Bất biến (issue #67): tổng lãi/lỗ
// chốt qua mọi holding + cổ tức tiền mặt, cộng với unrealized của các vị thế
// còn mở, bằng đúng absolutePnl toàn danh mục (khi cutoff = hôm nay, không
// thiếu giá) — vì avgCost bình quân di động đảm bảo phần vốn gốc trừ ra ở mỗi
// lần bán cộng với phần vốn gốc còn lại trong vị thế đang giữ luôn bằng đúng
// tổng tiền đã bỏ ra mua (Σ|BUY.amount|).
//
// Cổ tức cổ phiếu (issue #83 code review #1): không tạo Cashflow nên
// derivePosition()-style replay CHỈ theo BUY/SELL không đủ để biết khi nào vị
// thế THỰC SỰ đóng hết — một lệnh SELL hợp lệ (nhờ có thêm CP từ cổ tức) có
// thể khiến quantity nội bộ (chỉ tính BUY/SELL) âm mà không reset, làm sai
// avgCost/realizedGain cho các giao dịch sau. Sửa bằng 2 BỘ ĐẾM SONG SONG,
// mirror đúng cách derivePositionIncludingStockDividends() (lib/cost-basis.ts,
// issue #59) đã giải quyết vấn đề tương tự ở write-path:
// - avgCostQuantity/avgCost: CHỈ track BUY/SELL, công thức bình quân di động
//   giữ nguyên — avgCost ở đây PHẢI khớp avgCost cache thật trên Holding
//   (chỉ derive từ Cashflow, cổ tức cổ phiếu không đổi avgCost).
// - realQuantity: track CẢ BUY/SELL lẫn cổ tức cổ phiếu (luôn dương) — dùng
//   DUY NHẤT để biết khi nào vị thế thực sự về 0, quyết định thời điểm reset
//   avgCost/avgCostQuantity.
export function computeRealizedGainForHolding(
  cashflows: RealizedGainCashflowInput[],
  stockDividends: RealizedGainStockDividendInput[] = [],
): Decimal {
  type Event =
    | { kind: "CASHFLOW"; cf: RealizedGainCashflowInput }
    | { kind: "STOCK_DIVIDEND"; dividend: RealizedGainStockDividendInput };

  const events: (Event & { id: string; date: Date; createdAt: Date })[] = [
    ...cashflows.map((cf) => ({
      kind: "CASHFLOW" as const,
      cf,
      id: cf.id,
      date: cf.date,
      createdAt: cf.createdAt,
    })),
    ...stockDividends.map((dividend) => ({
      kind: "STOCK_DIVIDEND" as const,
      dividend,
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
    })),
  ];
  const sorted = sortByPositionTrailOrder(events);

  let avgCostQuantity = new Decimal(0);
  let avgCost = new Decimal(0);
  let realQuantity = new Decimal(0);
  let realizedGain = new Decimal(0);

  for (const event of sorted) {
    if (event.kind === "STOCK_DIVIDEND") {
      realQuantity = realQuantity.plus(event.dividend.quantity);
      continue;
    }

    const cf = event.cf;
    if (cf.type === "BUY") {
      const newAvgCostQuantity = avgCostQuantity.plus(cf.quantity);
      avgCost = newAvgCostQuantity.isZero()
        ? new Decimal(0)
        : avgCostQuantity
            .mul(avgCost)
            .plus(cf.amount.abs())
            .div(newAvgCostQuantity);
      avgCostQuantity = newAvgCostQuantity;
      realQuantity = realQuantity.plus(cf.quantity);
    } else {
      realizedGain = realizedGain.plus(
        cf.amount.minus(cf.quantity.mul(avgCost)),
      );
      avgCostQuantity = avgCostQuantity.minus(cf.quantity);
      realQuantity = realQuantity.minus(cf.quantity);
      // Reset theo realQuantity (KHÔNG avgCostQuantity) — vị thế THỰC SỰ đóng
      // hết (kể cả phần đến từ cổ tức cổ phiếu) mới xoá sạch phần dư đọng lại
      // trong avgCostQuantity do chênh lệch với realQuantity. Đây là fix mấu
      // chốt của issue #83 code review #1.
      if (realQuantity.isZero()) {
        avgCostQuantity = new Decimal(0);
        avgCost = new Decimal(0);
      }
    }
  }

  return realizedGain;
}

export type UnrealizedPositionInput = {
  navValue: Decimal;
  costBasis: Decimal;
};

// Lãi/lỗ TRÊN GIẤY (chưa chốt) của các vị thế đang mở — Σ (NAV hiện tại −
// vốn còn lại trong vị thế) qua tất cả holding truyền vào (caller lọc sẵn
// vị thế mở + định giá được, xem portfolio-valuation.ts).
export function computeUnrealizedGain(
  positions: UnrealizedPositionInput[],
): Decimal {
  return positions.reduce(
    (sum, p) => sum.plus(p.navValue.minus(p.costBasis)),
    new Decimal(0),
  );
}
