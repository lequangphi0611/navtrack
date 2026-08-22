import type { HoldingRow } from "./repository";

// Xuất danh mục dạng JSON cho fin-report-analyzer (issue #151) — pure, không
// I/O. Chỉ lấy vị thế CỔ PHIẾU đang mở (STOCK + quantity > 0): fin-report-analyzer
// phân tích BCTC theo mã cổ phiếu, không cần FUND/BOND/GOLD hay vị thế đã đóng.

export type PortfolioExportHolding = {
  symbol: string;
  // .toFixed(4) — KHÔNG .toString() (khác getOpenHoldings ở
  // queries/holdings-overview.ts): consumer ngoài (fin-report-analyzer) cần độ
  // chính xác cố định, không phụ thuộc Decimal cắt số 0 thừa.
  quantity: string;
  avg_cost: string;
  unit: string;
};

export type PortfolioExportPayload = {
  schema_version: 1;
  source: "navtrack";
  source_version: string;
  // ISO 8601 với offset +07:00 cố định (giờ Việt Nam, không DST).
  as_of: string;
  holdings: PortfolioExportHolding[];
};

// Giữ nguyên tại thời điểm viết (package.json "version": "0.1.0") — không
// import JSON qua đường dẫn tương đối sâu, không có tiền lệ nào trong repo
// làm vậy (xem docs/rules/typescript-style.md).
const SOURCE_VERSION = "0.1.0";

// UTC+7 cố định, Việt Nam không có Daylight Saving Time — cùng hằng số với
// src/lib/cutoff.ts (không import chéo, xem plan issue #151).
const ICT_OFFSET_HOURS = 7;

// Format một instant thành ISO 8601 với offset +07:00 cố định, KHÔNG dùng
// `Intl.DateTimeFormat` (không cần chiếu theo lịch ICT như cutoff.ts — chỉ
// cần quy đổi giờ UTC + 7h rồi tự gắn offset literal).
function toIctIsoString(date: Date): string {
  const shifted = new Date(date.getTime() + ICT_OFFSET_HOURS * 60 * 60 * 1000);

  const pad = (value: number, length = 2): string =>
    String(value).padStart(length, "0");

  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hours = pad(shifted.getUTCHours());
  const minutes = pad(shifted.getUTCMinutes());
  const seconds = pad(shifted.getUTCSeconds());
  const milliseconds = pad(shifted.getUTCMilliseconds(), 3);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+07:00`;
}

export function buildPortfolioExportPayload(
  holdings: HoldingRow[],
  asOf: Date,
): PortfolioExportPayload {
  const stockHoldings = holdings.filter(
    (holding) => holding.type === "STOCK" && holding.quantity.gt(0),
  );

  return {
    schema_version: 1,
    source: "navtrack",
    source_version: SOURCE_VERSION,
    as_of: toIctIsoString(asOf),
    holdings: stockHoldings.map((holding) => ({
      symbol: holding.symbol,
      quantity: holding.quantity.toFixed(4),
      avg_cost: holding.avgCost.toFixed(4),
      unit: holding.unit,
    })),
  };
}
