import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";

// Tách khỏi valuation.ts (cùng lý do settings.ts/settings-resolution.ts):
// NavOverrideForm.tsx, "use client", cần AUTO_PRICED_ASSET_TYPES để hiện badge
// "Tự động" mờ đi khi không hỗ trợ. valuation.ts `import { db } from "@/lib/db"`
// ở đầu file — nếu client component import từ đó, cả PrismaClient (và
// logger.ts, dùng `node:fs`) sẽ bị kéo vào bundle client và vỡ build (chunk
// "does not support external modules: node:fs"). File này KHÔNG được import
// `db` hay bất kỳ thứ gì phụ thuộc Node-only.

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

export type LatestQuoteRow = { date: Date; price: Decimal };

// Pure — so ngày giữa NavOverride (nhập tay) và PriceQuote (tự động), dùng
// nguồn nào có `date` mới hơn (gần ngày định giá D nhất). Input đã là "dòng
// mới nhất <= D" cho từng nguồn (lọc ở tầng query bằng
// getLatestNavOverrides/getLatestPriceQuotes ở valuation.ts). Chỉ có 1 nguồn ->
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
