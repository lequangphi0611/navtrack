import Decimal from "decimal.js";

import type {
  AssetType,
  CashflowType,
  DividendType,
  Prisma,
  SettingValueType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { SETTING_KEYS } from "@/lib/settings";

// Nơi DUY NHẤT của feature dividends được `import { db }` / gọi `tx.*`
// (docs/rules/data-prisma.md mục "Tầng truy cập dữ liệu") — cùng quy ước với
// features/holdings/repository.ts. Mọi hàm tự filter `userId`; "không tồn
// tại" và "không thuộc user" đều trả `null`.

// Pass-through mỏng cho db.$transaction — xem giải thích ở
// features/holdings/repository.ts (cùng lý do, không lặp lại ở đây).
export function runInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return db.$transaction(fn, options);
}

// --- Ghi (actions.ts::recordDividend) ---

export type DividendPositionCashflow = {
  id: string;
  type: CashflowType;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
};

export type DividendPositionDividend = {
  id: string;
  type: DividendType;
  date: Date;
  createdAt: Date;
  stockQuantity: Decimal | null;
};

export type DividendPositionSource = {
  symbol: string;
  unit: string;
  quantity: Decimal;
  cashflows: DividendPositionCashflow[];
  dividends: DividendPositionDividend[];
};

// Nguồn dữ liệu cho buildPositionEvents() (lib/position-trail.ts) — dividends
// KHÔNG lọc theo type (khác holdings/repository.ts::positionSourceSelect):
// recordDividend cần biết CẢ CASH/STOCK/BOND_COUPON để buildPositionEvents tự
// switch-exhaustive, không lọc trước ở tầng query.
export async function findDividendPositionSource(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<DividendPositionSource | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: {
      userId: true,
      symbol: true,
      unit: true,
      quantity: true,
      cashflows: {
        select: {
          id: true,
          type: true,
          date: true,
          quantity: true,
          createdAt: true,
        },
      },
      dividends: {
        select: {
          id: true,
          type: true,
          date: true,
          stockQuantity: true,
          createdAt: true,
        },
      },
    },
  });
  if (!holding || holding.userId !== userId) return null;

  return {
    symbol: holding.symbol,
    unit: holding.unit,
    quantity: new Decimal(holding.quantity.toString()),
    cashflows: holding.cashflows.map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date,
      createdAt: cf.createdAt,
      quantity: new Decimal(cf.quantity.toString()),
    })),
    dividends: holding.dividends.map((dividend) => ({
      id: dividend.id,
      type: dividend.type,
      date: dividend.date,
      createdAt: dividend.createdAt,
      stockQuantity: dividend.stockQuantity
        ? new Decimal(dividend.stockQuantity.toString())
        : null,
    })),
  };
}

export type LatestQuote = { date: Date; price: Decimal };

// Đọc giá cũ (NavOverride) TRONG transaction — dùng `tx` (không phải
// getLatestNavOverrides của lib/valuation.ts: hàm đó đọc `db` NGOÀI
// transaction + unstable_cache, không an toàn với race của transaction ghi
// cổ tức, xem comment gốc ở dividends/actions.ts).
export async function findLatestNavOverride(
  holdingId: string,
  atDate: Date,
  tx: Prisma.TransactionClient = db,
): Promise<LatestQuote | null> {
  const row = await tx.navOverride.findFirst({
    where: { holdingId, date: { lte: atDate } },
    orderBy: { date: "desc" },
    select: { date: true, price: true },
  });
  return row
    ? { date: row.date, price: new Decimal(row.price.toString()) }
    : null;
}

export async function findLatestPriceQuote(
  symbol: string,
  atDate: Date,
  tx: Prisma.TransactionClient = db,
): Promise<LatestQuote | null> {
  const row = await tx.priceQuote.findFirst({
    where: { symbol, date: { lte: atDate } },
    orderBy: { date: "desc" },
    select: { date: true, price: true },
  });
  return row
    ? { date: row.date, price: new Decimal(row.price.toString()) }
    : null;
}

// Ghi/ghi đè NavOverride bù pha loãng khi ghi cổ tức (issue #61) — `note`
// BẮT BUỘC (khác holdings/repository.ts::upsertNavOverride, nơi user tự nhập
// tay không cần note): ghi rõ vì sao giá bị tự động thay, không mất dấu vết audit.
export async function upsertPriceAdjustmentOverride(
  params: { holdingId: string; date: Date; price: string; note: string },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.navOverride.upsert({
    where: {
      holdingId_date: { holdingId: params.holdingId, date: params.date },
    },
    create: {
      holdingId: params.holdingId,
      date: params.date,
      price: params.price,
      note: params.note,
    },
    update: { price: params.price, note: params.note },
  });
}

export async function insertDividend(
  data: {
    holdingId: string;
    type: DividendType;
    date: Date;
    paymentDate: Date | null;
    grossAmount?: string;
    taxAmount?: string;
    netAmount?: string;
    stockQuantity?: string;
    // BOND_COUPON (Phase 7) — ĐÓNG BĂNG thông số đã dùng để tính tại thời điểm
    // ghi. BondTerms sửa được về sau (nhập sai, hoặc lãi suất thả nổi); nếu
    // lịch sử đọc lại giá trị hiện tại thì mọi kỳ cũ hiển thị sai
    // (docs/domain/03-dividends.md, process/phase-7.md "Tiêu chí hoàn thành").
    parValueApplied?: string;
    couponRatePercentApplied?: string;
  },
  tx: Prisma.TransactionClient = db,
): Promise<{ id: string }> {
  return tx.dividend.create({ data, select: { id: true } });
}

// Ngày trả lãi GẦN NHẤT đã ghi của một Holding — đầu vào `lastPaidCouponDate`
// cho computeNextCouponDate() (lib/bond-schedule.ts). Lấy max(date), KHÔNG phải
// bản ghi mới tạo nhất: user có thể ghi bù một kỳ cũ bỏ sót, và lịch phải neo
// theo kỳ xa nhất đã về tay (docs/domain/10-cashflow-calendar.md).
export async function findLastBondCouponDate(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<Date | null> {
  const row = await tx.dividend.findFirst({
    where: { holdingId, holding: { userId }, type: "BOND_COUPON" },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

// Cộng thẳng vào cache Holding.quantity khi ghi cổ tức cổ phiếu — KHÔNG gọi
// lại derivePosition()/persistPosition (features/holdings/repository.ts) để
// tính lại từ đầu: avgCost giữ nguyên, không sửa (docs/domain/01-assets-and-holdings.md).
export async function updateHoldingQuantity(
  holdingId: string,
  quantity: string,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.holding.update({ where: { id: holdingId }, data: { quantity } });
}

// --- Đọc (queries.ts) ---

// Cùng lý do findDividendPositionSource: không lọc theo type ở tầng query,
// caller (getTotalCashDividendReceived) truyền tập type cần cộng dồn. Lọc
// thêm `holding: { userId }` — hàm repository tự filter userId
// (docs/rules/data-prisma.md), không dựa vào caller đã verify từ trước.
export async function findCashLikeDividendNetAmounts(
  holdingId: string,
  userId: string,
  types: DividendType[],
  tx: Prisma.TransactionClient = db,
): Promise<Decimal[]> {
  const rows = await tx.dividend.findMany({
    where: {
      holdingId,
      holding: { userId },
      type: { in: types },
      netAmount: { not: null },
    },
    select: { netAmount: true },
  });
  // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
  return rows.map((row) => new Decimal(row.netAmount!.toString()));
}

export type DividendHistoryCashflow = {
  id: string;
  type: CashflowType;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
};

export type DividendHistoryDividend = {
  id: string;
  type: DividendType;
  date: Date;
  createdAt: Date;
  grossAmount: Decimal | null;
  taxAmount: Decimal | null;
  netAmount: Decimal | null;
  stockQuantity: Decimal | null;
  // BOND_COUPON — điều khoản đã đóng băng lúc ghi (issue #56/#58).
  parValueApplied: Decimal | null;
  couponRatePercentApplied: Decimal | null;
};

export type DividendHistorySource = {
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  cashflows: DividendHistoryCashflow[];
  dividends: DividendHistoryDividend[];
};

export async function findDividendHistorySource(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<DividendHistorySource | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: {
      userId: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      cashflows: {
        select: {
          id: true,
          type: true,
          date: true,
          quantity: true,
          createdAt: true,
        },
      },
      dividends: {
        select: {
          id: true,
          type: true,
          date: true,
          createdAt: true,
          grossAmount: true,
          taxAmount: true,
          netAmount: true,
          stockQuantity: true,
          parValueApplied: true,
          couponRatePercentApplied: true,
        },
      },
    },
  });
  if (!holding || holding.userId !== userId) return null;

  return {
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    cashflows: holding.cashflows.map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date,
      createdAt: cf.createdAt,
      quantity: new Decimal(cf.quantity.toString()),
    })),
    dividends: holding.dividends.map((dividend) => ({
      id: dividend.id,
      type: dividend.type,
      date: dividend.date,
      createdAt: dividend.createdAt,
      grossAmount: dividend.grossAmount
        ? new Decimal(dividend.grossAmount.toString())
        : null,
      taxAmount: dividend.taxAmount
        ? new Decimal(dividend.taxAmount.toString())
        : null,
      netAmount: dividend.netAmount
        ? new Decimal(dividend.netAmount.toString())
        : null,
      stockQuantity: dividend.stockQuantity
        ? new Decimal(dividend.stockQuantity.toString())
        : null,
      parValueApplied: dividend.parValueApplied
        ? new Decimal(dividend.parValueApplied.toString())
        : null,
      couponRatePercentApplied: dividend.couponRatePercentApplied
        ? new Decimal(dividend.couponRatePercentApplied.toString())
        : null,
    })),
  };
}

export type ParValueSettingRow = {
  value: string;
  valueType: SettingValueType;
  effectiveFrom: Date;
};

export async function findParValueSettingRows(
  tx: Prisma.TransactionClient = db,
): Promise<ParValueSettingRow[]> {
  return tx.setting.findMany({
    where: { key: SETTING_KEYS.DIVIDEND_PAR_VALUE },
    select: { value: true, valueType: true, effectiveFrom: true },
  });
}
