import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";

// Tách thuần khỏi features/snapshots/queries.ts (không đụng DB) — cùng tinh
// thần các hàm thuần khác trong codebase (dividend-math.ts, cost-drag.ts):
// dễ unit test ca biên mà không cần mock Prisma/next-auth. Định nghĩa
// NavTrendPeriod/NavTrendPoint TẠI ĐÂY (không ở features/snapshots/queries.ts)
// vì lib/ không được phụ thuộc ngược vào features/ (cùng lý do đã ghi ở
// lib/portfolio-valuation.ts::PortfolioValuation và lib/cutoff.ts) —
// queries.ts re-export lại 2 type này để giữ nguyên surface hiện có cho các
// consumer đang import từ đó.
export type NavTrendPeriod = "MONTH" | "YEAR" | "ALL";

export type NavTrendPoint = {
  date: string; // ISO
  value: string; // NAV Decimal đã serialize
  changePercentFromStart: number; // % so với điểm đầu danh sách đã lọc (kỳ đang chọn)
};

// Thứ tự nhóm cố định — khớp ASSET_TYPE_ORDER ở features/snapshots/queries.ts
// và lib/portfolio-valuation.ts (STOCK, FUND, BOND, GOLD). Khai riêng ở đây
// (không import lại từ 2 nơi kia) vì cả 3 file đều là chỗ hợp lệ để giữ hằng
// số cục bộ này — tránh vòng phụ thuộc lib -> features.
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

// Chuyển nguyên logic tính điểm/% đổi đã có ở getNavTrend() (issue #35, mục 9
// phase-6.md) — dedup nếu đã có frozen row đúng hôm nay, nối điểm động nếu
// chưa, tính changePercentFromStart so với điểm đầu kỳ. `rows` PHẢI đã sort
// tăng dần theo date (caller — DB query `orderBy: { date: "asc" }`, hoặc kết
// quả groupSnapshotRowsByType() — đảm bảo thứ tự này).
export function buildNavTrendSeries(
  rows: { date: Date; value: Decimal }[],
  todayValue: Decimal,
  today: Date,
): { points: NavTrendPoint[]; changePercent: number } {
  const lastRow = rows[rows.length - 1];
  const hasFrozenToday =
    lastRow !== undefined && lastRow.date.getTime() === today.getTime();

  const rawPoints: { date: Date; value: Decimal }[] = rows.map((row) => ({
    date: row.date,
    value: row.value,
  }));

  if (!hasFrozenToday) {
    rawPoints.push({ date: today, value: todayValue });
  }

  const startValue = rawPoints[0]?.value;
  const points: NavTrendPoint[] = rawPoints.map((p) => ({
    date: p.date.toISOString(),
    value: p.value.toString(),
    changePercentFromStart:
      !startValue || startValue.isZero()
        ? 0
        : p.value.minus(startValue).div(startValue).mul(100).toNumber(),
  }));

  const changePercent =
    points.length > 0
      ? (points[points.length - 1]?.changePercentFromStart ?? 0)
      : 0;

  return { points, changePercent };
}

// Gộp nhiều dòng Snapshot per-holding (userId, holdingId != null, frozen)
// thành 1 điểm mỗi (loại tài sản, ngày) — cộng dồn NAV của mọi holding cùng
// loại chốt cùng ngày. Dùng cho getNavTrendByAssetType() (issue #141) — 1
// round-trip DB đọc TOÀN BỘ lịch sử rồi group/cắt kỳ thuần ở JS, thay vì lặp
// lại query theo từng loại × từng kỳ (15 round-trip).
//
// Ca biên MISSING_PRICE (docs/domain/04-pricing-and-valuation.md): holding
// thiếu giá tại một mốc vốn dĩ KHÔNG có row trong Snapshot (cả job Python
// upsert_holding_snapshot() lẫn freezeManualSnapshot() chỉ ghi cho holding đã
// VALUED) — hàm này KHÔNG tự chèn giá trị 0 cho ngày thiếu row, chỉ cộng dồn
// đúng những gì thực sự có trong `rows`.
//
// Ca biên bán sạch một mã: khi holding đã đóng vị thế, không còn row mới nào
// được ghi cho nó nữa (job/manual freeze chỉ chốt holding ĐANG MỞ) — mảng
// điểm của loại đó tự nhiên dừng ở ngày cuối còn dữ liệu lịch sử. Hàm này
// KHÔNG tự chèn điểm 0 tại ngày đóng vị thế; điểm "hôm nay" (tính riêng ở
// getNavTrendByAssetType() qua computeTodayNavByType()) mới phản ánh đúng giá
// trị hiện tại của nhóm. Đường vẽ nối thẳng từ điểm lịch sử cuối cùng tới
// "hôm nay" là dữ liệu THẬT (khoảng trống không có snapshot ở giữa), không
// phải bug hiển thị.
export function groupSnapshotRowsByType(
  rows: { date: Date; value: Decimal; type: AssetType }[],
): Record<AssetType, { date: Date; value: Decimal }[]> {
  const sumByTypeAndDate = new Map<AssetType, Map<number, Decimal>>();

  for (const row of rows) {
    let byDate = sumByTypeAndDate.get(row.type);
    if (!byDate) {
      byDate = new Map();
      sumByTypeAndDate.set(row.type, byDate);
    }
    const dateKey = row.date.getTime();
    const prev = byDate.get(dateKey) ?? new Decimal(0);
    byDate.set(dateKey, prev.plus(row.value));
  }

  const result = {} as Record<AssetType, { date: Date; value: Decimal }[]>;
  for (const type of ASSET_TYPE_ORDER) {
    const byDate = sumByTypeAndDate.get(type);
    result[type] = byDate
      ? [...byDate.entries()]
          .sort(([a], [b]) => a - b)
          .map(([time, value]) => ({ date: new Date(time), value }))
      : [];
  }

  return result;
}

// % biên độ = (cao nhất − thấp nhất) / thấp nhất × 100 — LUÔN dương (high >= low
// theo định nghĩa minMaxPointValue). Đo mức "trồi sụt" NAV trong kỳ, không phải
// lãi/lỗ. undefined khi low = 0 (không có mẫu số hợp lệ).
export function computeSpreadPercent(
  high: string,
  low: string,
): number | undefined {
  const lowDecimal = new Decimal(low);
  if (lowDecimal.isZero()) return undefined;
  return new Decimal(high)
    .minus(lowDecimal)
    .div(lowDecimal)
    .mul(100)
    .toNumber();
}
