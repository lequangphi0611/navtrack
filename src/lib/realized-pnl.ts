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
// thể khiến quantity nội bộ (chỉ tính BUY/SELL) âm mà không về đúng 0, làm sai
// avgCost/realizedGain cho các giao dịch sau.
//
// Sửa lần 2 (retrofit, process/DECISION.md sau 2026-07-24 (2)): thiết kế đầu
// (2 BỘ ĐẾM SONG SONG — avgCostQuantity chỉ track BUY/SELL, reset tường minh
// khi realQuantity chạm 0) chỉ đúng cho ca ĐÓNG HẾT vị thế rồi mở lại; ca BÁN
// MỘT PHẦN (không đóng hết, kể cả tính CP từ cổ tức) rồi mua tiếp thì
// avgCostQuantity không bao giờ được reset dù đã lệch khỏi realQuantity — sai.
// Đổi sang 1 BỘ ĐẾM `realQuantity` DUY NHẤT (gồm cả BUY/SELL lẫn cổ tức cổ
// phiếu — khớp SL thực trên Holding). avgCost chỉ đổi ở BUY, dùng `realQuantity`
// NGAY TRƯỚC sự kiện đó (không phải một biến cashflow-only riêng) làm cơ sở
// bình quân: newAvgCost = (realQuantityTrước*avgCostCũ + tiềnMua) / (realQuantityTrước+SLMua).
// Khi vị thế đóng hết thật (realQuantityTrước=0), số hạng 0*avgCostCũ=0 tự
// "quên" avgCost cũ — không cần bước reset tường minh nào nữa, đúng cho CẢ ca
// đóng hết LẪN ca bán một phần. Mirror đúng cách derivePosition()
// (lib/cost-basis.ts, issue #59, sửa lần 2 cùng đợt) đã fix bug write-path
// cùng họ.
//
// Ca lý thuyết "cổ tức cổ phiếu xen giữa lúc realQuantity=0 và BUY kế tiếp"
// (holding không giữ cổ phần nào mà vẫn nhận cổ tức) là trạng thái dữ liệu
// không hợp lệ theo domain — không xử lý, chỉ ghi chú ở đây.
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
      const newRealQuantity = realQuantity.plus(cf.quantity);
      avgCost = newRealQuantity.isZero()
        ? new Decimal(0)
        : realQuantity.mul(avgCost).plus(cf.amount.abs()).div(newRealQuantity);
      realQuantity = newRealQuantity;
    } else {
      realizedGain = realizedGain.plus(
        cf.amount.minus(cf.quantity.mul(avgCost)),
      );
      realQuantity = realQuantity.minus(cf.quantity);
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
