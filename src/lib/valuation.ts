import Decimal from "decimal.js";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  AUTO_PRICED_ASSET_TYPES,
  resolvePrice,
  valuateHolding,
} from "@/lib/valuation-resolution";
import type {
  HoldingValuation,
  LatestQuoteRow,
  PriceSource,
  ResolvedPrice,
} from "@/lib/valuation-resolution";

// Re-export cho code cũ (docs/rules/typescript-style.md: một nguồn sự thật) —
// AUTO_PRICED_ASSET_TYPES/resolvePrice/valuateHolding/types giờ SỐNG ở
// valuation-resolution.ts (thuần, không import `db`) để dùng được từ client
// component (NavOverrideForm.tsx). File này giữ nguyên chữ ký
// getLatestNavOverrides/getLatestPriceQuotes/valuateHoldings cho mọi chỗ gọi hiện có.
export { AUTO_PRICED_ASSET_TYPES, resolvePrice, valuateHolding };
export type { HoldingValuation, LatestQuoteRow, PriceSource, ResolvedPrice };

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

// Job chạy 1 lần/ngày giao dịch (16:30 ICT, .github/workflows/price-fetcher.yml)
// — revalidate ngắn hơn nhiều so với cadence này vẫn "không kém tươi hơn job"
// (docs/rules/performance.md), chỉ để giá mới cập nhật lan tới UI trong vài
// chu kỳ sau giờ job chạy thay vì phải đợi tới tận nửa đêm (TTL reset theo
// đồng hồ tường, không theo lần job chạy — job không gọi revalidateTag vì ghi
// thẳng Postgres, ngoài Next.js).
const PRICE_QUOTE_REVALIDATE_SECONDS = 60 * 60; // 1 giờ

// Cache riêng theo TỪNG symbol (không theo cả tập/mảng symbol) — dùng chung
// được giữa nhiều user/nhiều holding cùng mã (process/DECISION.md 2026-07-12).
// unstable_cache cần giá trị trả về JSON-safe thuần (không Decimal/Date) —
// convert ở biên trong hàm cache, hàm bọc ngoài convert ngược lại (nhất quán
// "Decimal -> string tại biên", docs/rules/data-prisma.md).
const getCachedLatestPriceQuote = unstable_cache(
  async (
    symbol: string,
    cutoffDateIso: string,
  ): Promise<{ date: string; price: string } | null> => {
    const row = await db.priceQuote.findFirst({
      where: { symbol, date: { lte: new Date(cutoffDateIso) } },
      orderBy: { date: "desc" },
      select: { date: true, price: true },
    });
    return row
      ? { date: row.date.toISOString(), price: row.price.toString() }
      : null;
  },
  ["price-quote-latest"],
  { revalidate: PRICE_QUOTE_REVALIDATE_SECONDS, tags: ["price-quote"] },
);

export async function getLatestPriceQuotes(
  symbols: string[],
  cutoffDate: Date,
): Promise<Map<string, LatestQuoteRow>> {
  if (symbols.length === 0) return new Map();

  const cutoffDateIso = cutoffDate.toISOString();
  const entries = await Promise.all(
    [...new Set(symbols)].map(async (symbol) => {
      const cached = await getCachedLatestPriceQuote(symbol, cutoffDateIso);
      return cached
        ? ([
            symbol,
            { date: new Date(cached.date), price: new Decimal(cached.price) },
          ] as const)
        : null;
    }),
  );

  return new Map(
    entries.filter((e): e is [string, LatestQuoteRow] => e !== null),
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
