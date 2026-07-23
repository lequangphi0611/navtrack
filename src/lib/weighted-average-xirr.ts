import Decimal from "decimal.js";

import type { XirrResult } from "./xirr";

export type WeightedXirrEntry = {
  xirr: XirrResult;
  // Vốn mua vào của vị thế (trọng số) — grossInvested (Σ|BUY.amount|) của
  // riêng vị thế đó, KHÔNG phải NAV/tổng vốn ròng.
  capital: Decimal;
};

// "XIRR bình quân" của các vị thế ĐÃ ĐÓNG (tab "Đã đóng", mục 7 phase-6.md) —
// weighted average THEO VỐN MUA VÀO: Σ(xirr_i × vốn_i) / Σ(vốn_i), CHỈ tính
// trên entry `xirr.ok === true` (bỏ "không tính được" khỏi CẢ tử lẫn mẫu,
// KHÔNG quy về 0 — quy về 0 sẽ kéo trung bình sai lệch). Không entry nào OK,
// hoặc tổng vốn của các entry OK = 0 -> null (process/DECISION.md 2026-07-21
// mục (2)).
//
// KHÁC nguyên tắc "XIRR toàn danh mục" (docs/domain/05-returns-xirr-and-pnl.md
// "Quy tắc & bất biến" — gộp MỘT chuỗi cashflow của MỌI Holding, giải MỘT
// lần): hàm này lấy trung bình của N con số XIRR đã giải riêng lẻ cho từng vị
// thế đã đóng — hợp lý ở đây vì mỗi vị thế đã "chốt" độc lập (không còn dòng
// tiền tương lai chung để gộp XIRR kiểu toàn danh mục).
export function computeWeightedAverageXirr(
  entries: WeightedXirrEntry[],
): Decimal | null {
  const okEntries = entries.filter(
    (
      entry,
    ): entry is WeightedXirrEntry & {
      xirr: Extract<XirrResult, { ok: true }>;
    } => entry.xirr.ok,
  );
  if (okEntries.length === 0) return null;

  const totalCapital = okEntries.reduce(
    (sum, entry) => sum.plus(entry.capital),
    new Decimal(0),
  );
  if (totalCapital.isZero()) return null;

  const weightedSum = okEntries.reduce(
    (sum, entry) => sum.plus(entry.xirr.annualizedRate.mul(entry.capital)),
    new Decimal(0),
  );

  return weightedSum.div(totalCapital);
}
