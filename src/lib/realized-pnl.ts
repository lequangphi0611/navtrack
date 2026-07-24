import Decimal from "decimal.js";

import type { CashflowType } from "@prisma/client";

// Tách thuần khỏi lib/cost-basis.ts (không đụng DB) — CỐ Ý KHÔNG mở rộng
// CashflowInput/derivePosition() ở đó: field cần ở đây (Cashflow.amount đã
// materialize, gồm phí/thuế) khác input derivePosition() cần
// (quantity/pricePerUnit/feeAmount thô, dùng ở 4 Server Action ghi giao dịch
// có test suite lớn) — process/DECISION.md issue #67.
export type RealizedGainCashflowInput = {
  type: CashflowType;
  date: Date;
  quantity: Decimal;
  // Cashflow.amount đã materialize: BUY âm (gồm phí mua), SELL dương (đã trừ
  // phí + thuế bán) — docs/domain/02-transactions-and-cost-basis.md.
  amount: Decimal;
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
export function computeRealizedGainForHolding(
  cashflows: RealizedGainCashflowInput[],
): Decimal {
  const sorted = [...cashflows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  let quantity = new Decimal(0);
  let avgCost = new Decimal(0);
  let realizedGain = new Decimal(0);

  for (const cf of sorted) {
    if (cf.type === "BUY") {
      const newQuantity = quantity.plus(cf.quantity);
      avgCost = newQuantity.isZero()
        ? new Decimal(0)
        : quantity.mul(avgCost).plus(cf.amount.abs()).div(newQuantity);
      quantity = newQuantity;
    } else {
      realizedGain = realizedGain.plus(
        cf.amount.minus(cf.quantity.mul(avgCost)),
      );
      quantity = quantity.minus(cf.quantity);
      if (quantity.isZero()) avgCost = new Decimal(0);
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
