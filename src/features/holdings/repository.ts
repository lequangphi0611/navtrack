import Decimal from "decimal.js";

import type {
  AssetType,
  BondIssuerType,
  CashflowType,
  Prisma,
  SettingValueType,
} from "@prisma/client";
import type {
  CashflowInputWithEvent,
  StockDividendInput,
} from "@/lib/cost-basis";
import { db } from "@/lib/db";
import { CASH_FLOW_DIVIDEND_TYPES } from "@/lib/enums";
import {
  positionSourceSelect,
  POSITION_TRAIL_ORDER_BY,
} from "@/lib/position-trail";
import type { SettingKey } from "@/lib/settings";

// Nơi DUY NHẤT của feature holdings được `import { db }` / gọi `tx.*`
// (docs/rules/data-prisma.md mục "Tầng truy cập dữ liệu"). Mọi hàm ở đây tự
// filter `userId` — "không tồn tại" và "không thuộc user" đều trả `null`,
// không lộ thông tin tồn tại. `tx: Prisma.TransactionClient = db` để một chữ
// ký chạy được cả trong lẫn ngoài `$transaction` — caller mở transaction,
// repository không tự mở (docs/rules/data-prisma.md mục "Ranh giới transaction").

// Pass-through mỏng cho db.$transaction — actions.ts (caller) vẫn là nơi
// QUYẾT ĐỊNH ranh giới/isolation level của transaction (không đổi bản chất
// "repository không tự mở transaction"), chỉ đổi CHỖ import `@/lib/db` để
// repository.ts thật sự là nơi duy nhất của feature chạm module đó.
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

type PositionSourceRow = Prisma.HoldingGetPayload<{
  select: typeof positionSourceSelect;
}>;

function toCashflowInput(
  cf: PositionSourceRow["cashflows"][number],
): CashflowInputWithEvent {
  return {
    id: cf.id,
    type: cf.type,
    date: cf.date,
    createdAt: cf.createdAt,
    quantity: new Decimal(cf.quantity.toString()),
    pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    feeAmount: new Decimal(cf.feeAmount.toString()),
  };
}

function toStockDividendInput(
  dividend: PositionSourceRow["dividends"][number],
): StockDividendInput {
  return {
    id: dividend.id,
    date: dividend.date,
    createdAt: dividend.createdAt,
    // positionSourceSelect.dividends đã lọc where: {type: "STOCK"} -> luôn có giá trị.
    quantity: new Decimal(dividend.stockQuantity!.toString()),
  };
}

// Nguồn dữ liệu DUY NHẤT cần để derivePosition() (lib/cost-basis.ts) — Domain
// (Decimal), không phải row Prisma thô (docs/rules/clean-code.md mục 2).
export type PositionSource = {
  cashflows: CashflowInputWithEvent[];
  dividends: StockDividendInput[];
};

function toPositionSource(holding: PositionSourceRow): PositionSource {
  return {
    cashflows: holding.cashflows.map(toCashflowInput),
    dividends: holding.dividends.map(toStockDividendInput),
  };
}

export async function findPositionSourceById(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<PositionSource | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: { userId: true, ...positionSourceSelect },
  });
  if (!holding || holding.userId !== userId) return null;
  return toPositionSource(holding);
}

// Không cần so `userId` sau khi đọc — khóa `userId_symbol_type` đã lọc theo
// đúng user ngay trong `where` (khớp hành vi createHolding trước refactor).
//
// `unit`/`quantity`/`avgCost` thêm ở issue #142 — nhánh "Vừa mua hôm nay" của
// createHolding() cần báo lại vị thế đang giữ (số lượng/đơn vị/giá vốn) khi
// phát hiện trùng mã, để DuplicateHoldingAlert hiển thị mà không phải query
// lại. Hàm này hiện chỉ có 1 caller (createHolding) — mở rộng return type an
// toàn, không có caller khác phải cập nhật theo.
export async function findPositionSourceBySymbol(
  key: { userId: string; symbol: string; type: AssetType },
  tx: Prisma.TransactionClient = db,
): Promise<
  | (PositionSource & {
      id: string;
      unit: string;
      quantity: Decimal;
      avgCost: Decimal;
    })
  | null
> {
  const holding = await tx.holding.findUnique({
    where: { userId_symbol_type: key },
    select: {
      id: true,
      unit: true,
      quantity: true,
      avgCost: true,
      ...positionSourceSelect,
    },
  });
  if (!holding) return null;
  return {
    id: holding.id,
    unit: holding.unit,
    quantity: new Decimal(holding.quantity.toString()),
    avgCost: new Decimal(holding.avgCost.toString()),
    ...toPositionSource(holding),
  };
}

export async function findPositionSourceByCashflow(
  cashflowId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<(PositionSource & { holdingId: string }) | null> {
  const cashflow = await tx.cashflow.findUnique({
    where: { id: cashflowId },
    select: {
      holdingId: true,
      holding: { select: { userId: true, ...positionSourceSelect } },
    },
  });
  if (!cashflow || cashflow.holding.userId !== userId) return null;
  return {
    holdingId: cashflow.holdingId,
    ...toPositionSource(cashflow.holding),
  };
}

export async function insertHolding(
  data: {
    userId: string;
    symbol: string;
    type: AssetType;
    unit: string;
    name?: string;
  },
  tx: Prisma.TransactionClient = db,
): Promise<{ id: string }> {
  return tx.holding.create({ data, select: { id: true } });
}

export async function insertCashflow(
  data: {
    holdingId: string;
    type: CashflowType;
    date: Date;
    quantity: string;
    pricePerUnit: string;
    amount: string;
    feeAmount: string;
    taxAmount: string;
    note?: string;
  },
  tx: Prisma.TransactionClient = db,
): Promise<{ id: string }> {
  return tx.cashflow.create({ data, select: { id: true } });
}

export async function updateCashflowRow(
  cashflowId: string,
  data: {
    type: CashflowType;
    date: Date;
    quantity: string;
    pricePerUnit: string;
    amount: string;
    feeAmount: string;
    taxAmount: string;
    note?: string;
  },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.cashflow.update({ where: { id: cashflowId }, data });
}

export async function deleteCashflowRow(
  cashflowId: string,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.cashflow.delete({ where: { id: cashflowId } });
}

// Ghi lại materialized cache vị thế lên Holding từ kết quả derivePosition đã tính sẵn.
// Gọi trong CÙNG transaction với mọi thay đổi cashflow — giữ cache luôn khớp nguồn sự thật
// (Cashflow), không bao giờ cập nhật cộng/trừ tay (docs/domain/02-transactions-and-cost-basis.md).
export async function persistPosition(
  holdingId: string,
  position: { quantity: Decimal; avgCost: Decimal },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.holding.update({
    where: { id: holdingId },
    data: {
      quantity: position.quantity.toString(),
      avgCost: position.avgCost.toString(),
    },
  });
}

// Existence + ownership check — dùng cho saveNavOverride (verify quyền sở hữu
// trước khi upsert giá tay) VÀ để validate `?fromHolding=` khi back-navigate từ
// /snapshots (TransactionSnapshotBanner, không tin thẳng holdingId từ query).
export async function findHoldingOwnerId(
  holdingId: string,
  tx: Prisma.TransactionClient = db,
): Promise<string | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: { userId: true },
  });
  return holding?.userId ?? null;
}

export async function isHoldingOwnedByUser(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<boolean> {
  return (await findHoldingOwnerId(holdingId, tx)) === userId;
}

export async function upsertNavOverride(
  holdingId: string,
  date: Date,
  price: string,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.navOverride.upsert({
    where: { holdingId_date: { holdingId, date } },
    create: { holdingId, date, price },
    update: { price },
  });
}

// --- Đọc (queries.ts) ---

export type HoldingRow = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  quantity: Decimal;
  avgCost: Decimal;
};

// Đọc thuần materialized cache (quantity/avgCost) trên Holding — KHÔNG kéo
// cashflow. Cache được 4 hàm ghi ở trên recompute-in-transaction nên luôn khớp
// nguồn sự thật. Chi phí O(số holding), không phình theo lịch sử giao dịch.
export async function findHoldingRows(
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<HoldingRow[]> {
  const holdings = await tx.holding.findMany({
    where: { userId },
    select: {
      id: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      quantity: true,
      avgCost: true,
    },
    orderBy: { symbol: "asc" },
  });

  return holdings.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    name: h.name,
    type: h.type,
    unit: h.unit,
    quantity: new Decimal(h.quantity.toString()),
    avgCost: new Decimal(h.avgCost.toString()),
  }));
}

export type CashDividendRow = {
  id: string;
  date: Date;
  paymentDate: Date | null;
  netAmount: Decimal;
};

// Cổ tức tiền mặt + TRÁI TỨC đã nhận <= cutoffDate — dòng tiền dương cho XIRR
// (docs/domain/03-dividends.md, docs/domain/05 "Cách tính": Dividend.netAmount).
// Lọc theo CASH_FLOW_DIVIDEND_TYPES (lib/enums.ts), KHÔNG hardcode `type:
// "CASH"`: bỏ sót BOND_COUPON ở đây khiến trái tức không vào XIRR mà không có
// test nào fail (process/phase-7.md mục 3).
export async function findCashDividendsForHolding(
  holdingId: string,
  cutoffDate: Date,
  tx: Prisma.TransactionClient = db,
): Promise<CashDividendRow[]> {
  const rows = await tx.dividend.findMany({
    where: {
      holdingId,
      type: { in: [...CASH_FLOW_DIVIDEND_TYPES] },
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: {
      id: true,
      date: true,
      createdAt: true,
      paymentDate: true,
      netAmount: true,
    },
    // Khớp tie-break convention dùng cho cashflows (date, createdAt, id) —
    // createdAt chỉ dùng để order, không trả ra ngoài.
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    paymentDate: row.paymentDate,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
  }));
}

export type BondTermsRow = {
  issuerType: BondIssuerType;
  parValue: Decimal;
  couponRatePercent: Decimal | null;
  couponFrequencyMonths: number | null;
  firstCouponDate: Date | null;
  maturityDate: Date | null;
  nextCouponDateOverride: Date | null;
};

// Điều khoản trái phiếu của MỘT Holding (Phase 7). Sống ở repository của
// feature HOLDINGS — `BondTerms` là đặc tả của chính vị thế (nhập trên form vị
// thế, 1-1 với Holding), không phải dữ liệu của feature dividends; nhánh ghi
// trái tức (features/dividends/actions.ts) import từ đây thay vì mỗi feature
// tự viết một truy vấn cùng bảng (docs/rules/clean-code.md mục 1).
//
// Tự filter userId qua quan hệ `holding` (docs/rules/data-prisma.md): "không
// tồn tại" và "không thuộc user" đều trả null. Đọc NGOÀI transaction ghi là an
// toàn — BondTerms là dữ liệu HỢP ĐỒNG tĩnh, không phải trạng thái suy ra từ
// Cashflow/Dividend đang ghi, nên không có bất biến TOCTOU cần bảo vệ.
export async function findBondTerms(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<BondTermsRow | null> {
  const row = await tx.bondTerms.findFirst({
    where: { holdingId, holding: { userId } },
    select: {
      issuerType: true,
      parValue: true,
      couponRatePercent: true,
      couponFrequencyMonths: true,
      firstCouponDate: true,
      maturityDate: true,
      nextCouponDateOverride: true,
    },
  });
  if (!row) return null;

  return {
    issuerType: row.issuerType,
    parValue: new Decimal(row.parValue.toString()),
    couponRatePercent: row.couponRatePercent
      ? new Decimal(row.couponRatePercent.toString())
      : null,
    couponFrequencyMonths: row.couponFrequencyMonths,
    firstCouponDate: row.firstCouponDate,
    maturityDate: row.maturityDate,
    nextCouponDateOverride: row.nextCouponDateOverride,
  };
}

// Tạo/cập nhật điều khoản trái phiếu. Upsert theo `holdingId` (@unique) — form
// 7a dùng chung cho cả lần nhập đầu lẫn lần sửa, không cần caller tự phân biệt.
// KHÔNG bao giờ được gọi từ nhánh ghi trái tức: `recordDividend` đọc BondTerms
// và không ghi ngược gì (docs/domain/10-cashflow-calendar.md).
export async function upsertBondTerms(
  holdingId: string,
  data: {
    issuerType: BondIssuerType;
    parValue: string;
    couponRatePercent: string | null;
    couponFrequencyMonths: number | null;
    firstCouponDate: Date | null;
    maturityDate: Date | null;
  },
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.bondTerms.upsert({
    where: { holdingId },
    create: { holdingId, ...data },
    update: data,
  });
}

export type BondSettlementSource = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  quantity: Decimal;
  avgCost: Decimal;
  bondTerms: {
    issuerType: BondIssuerType;
    parValue: Decimal;
    maturityDate: Date | null;
  } | null;
};

// Vị thế + điều khoản trái phiếu cần cho màn/Server Action tất toán đáo hạn
// (Phase 7, issue #101). Đọc NGOÀI transaction ghi được: `bondTerms` là dữ liệu
// hợp đồng tĩnh và `quantity`/`avgCost` ở đây chỉ dùng để PREFILL form + resolve
// thuế suất — số thật đưa vào `persistPosition` vẫn derive lại TRONG transaction
// từ toàn bộ Cashflow (bất biến "cache chỉ ghi bằng derivePosition",
// docs/domain/02-transactions-and-cost-basis.md).
export async function findBondSettlementSource(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<BondSettlementSource | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: {
      id: true,
      userId: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      quantity: true,
      avgCost: true,
      bondTerms: {
        select: { issuerType: true, parValue: true, maturityDate: true },
      },
    },
  });
  if (!holding || holding.userId !== userId) return null;

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: new Decimal(holding.quantity.toString()),
    avgCost: new Decimal(holding.avgCost.toString()),
    bondTerms: holding.bondTerms
      ? {
          issuerType: holding.bondTerms.issuerType,
          parValue: new Decimal(holding.bondTerms.parValue.toString()),
          maturityDate: holding.bondTerms.maturityDate,
        }
      : null,
  };
}

export type HoldingDetailCashflowRow = {
  id: string;
  type: CashflowType;
  date: Date;
  createdAt: Date;
  quantity: Decimal;
  pricePerUnit: Decimal;
  amount: Decimal;
  feeAmount: Decimal;
  taxAmount: Decimal;
  note: string | null;
};

export type HoldingDetailSource = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  cashflows: HoldingDetailCashflowRow[];
  dividends: StockDividendInput[];
};

// Nguồn dữ liệu cho getHoldingDetail() (queries.ts) — cashflows cần ĐẦY ĐỦ
// field (amount/taxAmount/note cho hiển thị) nên không dùng
// positionSourceSelect.cashflows (select hẹp hơn, chỉ đủ cho derivePosition);
// chỉ tái dùng orderBy + dividends (Issue #59: vị thế phải gồm cổ tức cổ phiếu).
export async function findHoldingDetailSource(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<HoldingDetailSource | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    include: {
      cashflows: { orderBy: POSITION_TRAIL_ORDER_BY },
      dividends: positionSourceSelect.dividends,
    },
  });
  if (!holding || holding.userId !== userId) return null;

  return {
    id: holding.id,
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
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
      amount: new Decimal(cf.amount.toString()),
      feeAmount: new Decimal(cf.feeAmount.toString()),
      taxAmount: new Decimal(cf.taxAmount.toString()),
      note: cf.note,
    })),
    dividends: holding.dividends.map(toStockDividendInput),
  };
}

export type SettingRow = {
  key: string;
  value: string;
  valueType: SettingValueType;
  effectiveFrom: Date;
};

// Setting không scoped theo user (app-wide config) — không cần filter userId.
export async function findSettingRowsByKeys(
  keys: SettingKey[],
  tx: Prisma.TransactionClient = db,
): Promise<SettingRow[]> {
  return tx.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true, valueType: true, effectiveFrom: true },
  });
}

export type HoldingPricingRow = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  quantity: Decimal;
  avgCost: Decimal;
};

// Query hẹp riêng cho màn nhập giá tay (NavOverrideForm) — không kéo cashflows
// như findHoldingDetailSource (màn này không cần lịch sử giao dịch).
export async function findHoldingForPricing(
  holdingId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<HoldingPricingRow | null> {
  const holding = await tx.holding.findUnique({
    where: { id: holdingId },
    select: {
      userId: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      quantity: true,
      avgCost: true,
    },
  });
  if (!holding || holding.userId !== userId) return null;

  return {
    id: holdingId,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: new Decimal(holding.quantity.toString()),
    avgCost: new Decimal(holding.avgCost.toString()),
  };
}

export type CashflowForXirrRow = {
  holdingId: string;
  date: Date;
  amount: Decimal;
  type: CashflowType;
  taxAmount: Decimal;
  feeAmount: Decimal;
};

// Batch cashflow theo tập holdingId cho NHIỀU vị thế cùng lúc (không N+1).
// type/taxAmount/feeAmount thêm cho computeCostDrag() (grossInvested riêng
// từng vị thế đã đóng). Lọc thêm `holding: { userId }` (không chỉ tin
// `holdingIds` caller truyền vào đã scoped sẵn) — hàm repository tự filter
// userId, không dựa vào caller (docs/rules/data-prisma.md).
export async function findCashflowsForHoldings(
  holdingIds: string[],
  userId: string,
  cutoffDate: Date,
  tx: Prisma.TransactionClient = db,
): Promise<CashflowForXirrRow[]> {
  if (holdingIds.length === 0) return [];

  const rows = await tx.cashflow.findMany({
    where: {
      holdingId: { in: holdingIds },
      holding: { userId },
      date: { lte: cutoffDate },
    },
    select: {
      holdingId: true,
      date: true,
      amount: true,
      type: true,
      taxAmount: true,
      feeAmount: true,
    },
  });

  return rows.map((row) => ({
    holdingId: row.holdingId,
    date: row.date,
    amount: new Decimal(row.amount.toString()),
    type: row.type,
    taxAmount: new Decimal(row.taxAmount.toString()),
    feeAmount: new Decimal(row.feeAmount.toString()),
  }));
}

export type CashDividendForXirrRow = {
  id: string;
  holdingId: string;
  date: Date;
  paymentDate: Date | null;
  netAmount: Decimal;
  // taxAmount CÓ THỂ null (dividend CASH ghi trước khi thuế cổ tức có mặt,
  // hoặc chưa resolve được) — cho "chi phí ăn mòn" (lib/cost-drag.ts), coi
  // như 0 khi cộng dồn, KHÔNG ép non-null như netAmount.
  taxAmount: Decimal | null;
};

// Batch cổ tức tiền mặt + trái tức theo tập holdingId — `id` thêm cho
// ClosedHoldingRow.cashDividends (React key + timeline row id, cần liệt kê từng
// dòng cổ tức riêng, không chỉ tổng). Lọc thêm `holding: { userId }` — cùng lý
// do findCashflowsForHoldings; lọc type qua CASH_FLOW_DIVIDEND_TYPES — cùng lý
// do findCashDividendsForHolding ở trên. Nguồn DUY NHẤT cho computeXirrCore()
// (lib/portfolio-valuation.ts) — trước đây hàm đó tự viết một bản
// db.dividend.findMany() song song KHÔNG có filter userId trực tiếp (chỉ an
// toàn nhờ holdingIds truyền vào đã được caller lọc sẵn), khác nguyên tắc "mọi
// query tự filter userId, không dựa vào caller" đã áp cho mọi hàm khác ở đây
// (process/DECISION.md 2026-07-29, bonds-and-cashflow-calendar.md).
export async function findCashDividendsForHoldings(
  holdingIds: string[],
  userId: string,
  cutoffDate: Date,
  tx: Prisma.TransactionClient = db,
): Promise<CashDividendForXirrRow[]> {
  if (holdingIds.length === 0) return [];

  const rows = await tx.dividend.findMany({
    where: {
      holdingId: { in: holdingIds },
      holding: { userId },
      type: { in: [...CASH_FLOW_DIVIDEND_TYPES] },
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: {
      id: true,
      holdingId: true,
      date: true,
      paymentDate: true,
      netAmount: true,
      taxAmount: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    holdingId: row.holdingId,
    date: row.date,
    paymentDate: row.paymentDate,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
    taxAmount:
      row.taxAmount !== null ? new Decimal(row.taxAmount.toString()) : null,
  }));
}

export type CashflowDateRange = {
  holdingId: string;
  minDate: Date | null;
  maxDate: Date | null;
};

// Khoảng thời gian nắm giữ (ngày mua đầu tiên -> ngày bán cuối cùng) cho
// TOÀN BỘ vị thế đã đóng trong 1 lượt — dùng cho holdingPeriodLabel
// (getClosedHoldingsDetail, queries.ts). Lọc thêm `holding: { userId }` —
// cùng lý do findCashflowsForHoldings.
export async function findCashflowDateRangeForHoldings(
  holdingIds: string[],
  userId: string,
  tx: Prisma.TransactionClient = db,
): Promise<CashflowDateRange[]> {
  if (holdingIds.length === 0) return [];

  const rows = await tx.cashflow.groupBy({
    by: ["holdingId"],
    where: { holdingId: { in: holdingIds }, holding: { userId } },
    _min: { date: true },
    _max: { date: true },
  });

  return rows.map((row) => ({
    holdingId: row.holdingId,
    minDate: row._min.date,
    maxDate: row._max.date,
  }));
}
