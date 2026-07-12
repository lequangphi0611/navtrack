import Decimal from "decimal.js";

import { db } from "@/lib/db";

// Nguồn giá — docs/domain/04-pricing-and-valuation.md: luôn là "tự động"
// (vnstock, PriceQuote) hoặc "nhập tay" (NavOverride). Nguồn sự thật cho type
// này — @/components/PriceSourceBadge import + re-export lại từ đây.
export type PriceSource = "AUTO" | "MANUAL";

export type ResolvedPrice = {
  price: Decimal;
  source: PriceSource;
  priceDate: Date; // ngày của giá đã dùng — có thể < cutoffDate (nghỉ lễ/gần nhất)
};

export type HoldingValuation =
  | { status: "CLOSED"; nav: Decimal } // SL = 0 (domain/01) — luôn NAV=0 dù có giá hay không
  | { status: "MISSING_PRICE" } // còn mở nhưng không có NavOverride lẫn PriceQuote <= D
  | ({ status: "VALUED"; nav: Decimal } & ResolvedPrice);

type LatestQuoteRow = { date: Date; price: Decimal };

// Pure — ưu tiên NavOverride (nhập tay), fallback PriceQuote (tự động) khi
// không có override. Input đã là "dòng mới nhất <= D" cho từng nguồn (lọc ở
// tầng query bằng getLatestNavOverrides/getLatestPriceQuotes bên dưới) — hàm
// này không tự so sánh ngày giữa 2 nguồn, override luôn thắng nếu có, bất kể
// PriceQuote có ngày mới hơn (đúng thứ tự ưu tiên trong domain doc, không phải
// "giá mới nhất trong 2 nguồn").
export function resolvePrice(
  latestNavOverride: LatestQuoteRow | null,
  latestPriceQuote: LatestQuoteRow | null,
): ResolvedPrice | null {
  if (latestNavOverride) {
    return {
      price: latestNavOverride.price,
      source: "MANUAL",
      priceDate: latestNavOverride.date,
    };
  }
  if (latestPriceQuote) {
    return {
      price: latestPriceQuote.price,
      source: "AUTO",
      priceDate: latestPriceQuote.date,
    };
  }
  return null;
}

// Pure — NAV của một vị thế tại ngày D (docs/domain/04 "Cách tính").
// SL=0 -> CLOSED (docs/domain/01 "Vị thế đóng": NAV=0 dù có giá hay không,
// không đóng góp vào tổng NAV). SL>0 & không định giá được -> MISSING_PRICE,
// KHÔNG mặc định 0 (0 sẽ làm sai tổng NAV/XIRR — docs/domain/04 "Thiếu giá").
export function valuateHolding(
  quantity: Decimal,
  resolved: ResolvedPrice | null,
): HoldingValuation {
  if (quantity.isZero()) return { status: "CLOSED", nav: new Decimal(0) };
  if (!resolved) return { status: "MISSING_PRICE" };
  return { status: "VALUED", nav: quantity.mul(resolved.price), ...resolved };
}

// --- Batched DB fetch (tránh N+1 — process/phase-2.md mục cache/N+1) ---
//
// Khác pickEffectiveSetting (lib/settings.ts): Setting chỉ vài dòng/key nên
// fetch hết rồi lọc ở JS chấp nhận được. PriceQuote/NavOverride tăng dần
// KHÔNG giới hạn theo thời gian (job EOD ghi mỗi ngày) — fetch hết lịch sử
// rồi lọc ở JS lặp lại đúng anti-pattern đã cảnh báo cho quan hệ 1-nhiều tăng
// dần (docs/rules/performance.md, data-prisma.md). Nên việc chọn "dòng ngày
// gần nhất <= D" phải làm ở tầng SQL: distinct + orderBy date desc (Postgres
// dịch thành DISTINCT ON) trả đúng 1 dòng/mã, không kéo lịch sử.

export async function getLatestNavOverrides(
  holdingIds: string[],
  cutoffDate: Date,
): Promise<Map<string, LatestQuoteRow>> {
  if (holdingIds.length === 0) return new Map();

  const rows = await db.navOverride.findMany({
    where: { holdingId: { in: holdingIds }, date: { lte: cutoffDate } },
    orderBy: [{ holdingId: "asc" }, { date: "desc" }],
    distinct: ["holdingId"],
    select: { holdingId: true, date: true, price: true },
  });

  return new Map(
    rows.map((row) => [
      row.holdingId,
      { date: row.date, price: new Decimal(row.price.toString()) },
    ]),
  );
}

export async function getLatestPriceQuotes(
  symbols: string[],
  cutoffDate: Date,
): Promise<Map<string, LatestQuoteRow>> {
  if (symbols.length === 0) return new Map();

  const rows = await db.priceQuote.findMany({
    where: { symbol: { in: symbols }, date: { lte: cutoffDate } },
    orderBy: [{ symbol: "asc" }, { date: "desc" }],
    distinct: ["symbol"],
    select: { symbol: true, date: true, price: true },
  });

  return new Map(
    rows.map((row) => [
      row.symbol,
      { date: row.date, price: new Decimal(row.price.toString()) },
    ]),
  );
}

// Cấp cao: định giá nhiều Holding cùng lúc tại ngày D — gom NavOverride theo
// holdingId + PriceQuote theo symbol MỖI THỨ MỘT LẦN QUERY duy nhất, không
// N+1 theo từng holding. Vị thế đã đóng (SL=0) được lọc ra trước khi build
// tập holdingIds/symbols cần fetch — không tốn round-trip cho vị thế không
// cần định giá.
export async function valuateHoldings(
  holdings: { id: string; symbol: string; quantity: Decimal }[],
  cutoffDate: Date,
): Promise<Map<string, HoldingValuation>> {
  const open = holdings.filter((h) => !h.quantity.isZero());
  const symbols = [...new Set(open.map((h) => h.symbol))];

  const [navOverrides, priceQuotes] = await Promise.all([
    getLatestNavOverrides(
      open.map((h) => h.id),
      cutoffDate,
    ),
    getLatestPriceQuotes(symbols, cutoffDate),
  ]);

  const result = new Map<string, HoldingValuation>();
  for (const holding of holdings) {
    if (holding.quantity.isZero()) {
      result.set(holding.id, { status: "CLOSED", nav: new Decimal(0) });
      continue;
    }
    const resolved = resolvePrice(
      navOverrides.get(holding.id) ?? null,
      priceQuotes.get(holding.symbol) ?? null,
    );
    result.set(holding.id, valuateHolding(holding.quantity, resolved));
  }
  return result;
}
