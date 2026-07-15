import Decimal from "decimal.js";
import { unstable_cache } from "next/cache";

import type { AssetType } from "@/components/AssetTypeBadge";
import { db } from "@/lib/db";

// AssetType nào có nguồn giá TỰ ĐỘNG (vnstock, ghi vào PriceQuote) —
// docs/domain/04-pricing-and-valuation.md: "STOCK/FUND định giá tự động (vẫn
// cho sửa tay), BOND/GOLD mặc định nhập tay (nguồn tự động kém ổn định/chưa
// hỗ trợ)". Nguồn sự thật DUY NHẤT cho quy tắc này, dùng ở cả
// NavOverrideForm (badge "Tự động" mờ đi khi không hỗ trợ) và
// missingPriceReasonLabel (portfolio-valuation.ts, chọn câu "chưa có giá tự
// động" vs "chưa có giá nhập tay") — trước đây 2 nơi hard-code độc lập, dễ
// lệch khi thêm loại tài sản mới (code review #9).
//
// ĐỒNG BỘ THỦ CÔNG với jobs/price-fetcher/main.py (Python, không import được
// type/const này) — sửa danh sách ở đây thì nhớ soát lại `WHERE type IN
// (...)` trong file đó.
export const AUTO_PRICED_ASSET_TYPES: ReadonlySet<AssetType> = new Set([
  "STOCK",
  "FUND",
]);

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

// Pure — so ngày giữa NavOverride (nhập tay) và PriceQuote (tự động), dùng
// nguồn nào có `date` mới hơn (gần ngày định giá D nhất). Input đã là "dòng
// mới nhất <= D" cho từng nguồn (lọc ở tầng query bằng
// getLatestNavOverrides/getLatestPriceQuotes bên dưới). Chỉ có 1 nguồn ->
// dùng nguồn đó (GOLD/BOND không có PriceQuote, hành vi giữ nguyên như cũ).
// Cùng ngày -> ưu tiên NavOverride (issue #40: trước đây NavOverride luôn
// thắng bất kể ngày, gây "shadow" vĩnh viễn PriceQuote mới hơn cho STOCK/FUND
// — sửa để giá nhập tay cũ không còn che giá tự động mới hơn).
//
// ĐỒNG BỘ THỦ CÔNG với jobs/snapshot-cron/main.py (`resolve_price`, Python
// không import được hàm này) — sửa công thức ưu tiên giá ở đây thì nhớ soát
// lại hàm cùng tên bên đó (issue #36, process/DECISION.md 2026-07-14).
export function resolvePrice(
  latestNavOverride: LatestQuoteRow | null,
  latestPriceQuote: LatestQuoteRow | null,
): ResolvedPrice | null {
  if (latestNavOverride && latestPriceQuote) {
    return latestNavOverride.date >= latestPriceQuote.date
      ? {
          price: latestNavOverride.price,
          source: "MANUAL",
          priceDate: latestNavOverride.date,
        }
      : {
          price: latestPriceQuote.price,
          source: "AUTO",
          priceDate: latestPriceQuote.date,
        };
  }
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
// NAV = quantity * price ĐỒNG BỘ THỦ CÔNG với jobs/snapshot-cron/main.py
// (`run_snapshot`, cùng công thức, không import chéo được) — xem comment ở
// resolvePrice phía trên.
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
  { revalidate: PRICE_QUOTE_REVALIDATE_SECONDS },
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
