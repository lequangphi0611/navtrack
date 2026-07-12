import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getSession } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { resolveCutoffDate } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

import type {
  CashflowRow,
  HoldingDetail,
  HoldingsOverview,
  HoldingSummary,
} from "./types";

// Memo theo request (như getSession) — nhiều Suspense region (StatCard tổng vốn,
// danh sách vị thế open/closed) gọi độc lập vẫn chỉ tốn 1 DB round-trip/request.
//
// Đọc thuần materialized cache (quantity/avgCost) trên Holding — KHÔNG kéo cashflow.
// Cache được 4 action ghi cashflow recompute-in-transaction nên luôn khớp nguồn sự thật
// (docs/domain/02-transactions-and-cost-basis.md). Chi phí O(số holding), không phình
// theo lịch sử giao dịch.
const getHoldingsRaw = cache(async (): Promise<HoldingsOverview> => {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holdings = await db.holding.findMany({
    where: { userId: session.user.id },
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

  const open: HoldingSummary[] = [];
  const closed: HoldingSummary[] = [];
  let totalInvested = new Decimal(0);

  for (const holding of holdings) {
    const quantity = new Decimal(holding.quantity.toString());
    const avgCost = new Decimal(holding.avgCost.toString());
    const totalCostBasis = quantity.mul(avgCost);

    const summary: HoldingSummary = {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      unit: holding.unit,
      quantity: quantity.toString(),
      avgCost: avgCost.toString(),
      totalCostBasis: totalCostBasis.toString(),
    };

    if (quantity.gt(0)) {
      open.push(summary);
      totalInvested = totalInvested.plus(totalCostBasis);
    } else {
      closed.push(summary);
    }
  }

  return { open, closed, totalInvested: totalInvested.toString() };
});

export async function getOpenHoldings(): Promise<HoldingSummary[]> {
  return (await getHoldingsRaw()).open;
}

export async function getClosedHoldings(): Promise<HoldingSummary[]> {
  return (await getHoldingsRaw()).closed;
}

export async function getTotalInvested(): Promise<string> {
  return (await getHoldingsRaw()).totalInvested;
}

export async function hasAnyHolding(): Promise<boolean> {
  const { open, closed } = await getHoldingsRaw();
  return open.length > 0 || closed.length > 0;
}

// Cổ tức tiền mặt đã nhận <= cutoffDate — dòng tiền dương cho XIRR
// (docs/domain/03-dividends.md, docs/domain/05 "Cách tính": Dividend.netAmount).
// Chưa có UI nhập cổ tức (chưa có màn hình ghi Dividend) nên hiện tại luôn trả
// mảng rỗng — vô hại, công thức đã ghi rõ trong domain doc nên viết sẵn thay vì
// đoán tính năng tương lai.
async function getCashDividends(
  holdingId: string,
  cutoffDate: Date,
): Promise<{ date: Date; netAmount: Decimal }[]> {
  const rows = await db.dividend.findMany({
    where: {
      holdingId,
      type: "CASH",
      netAmount: { not: null },
      date: { lte: cutoffDate },
    },
    select: { date: true, netAmount: true },
  });

  return rows.map((row) => ({
    date: row.date,
    // netAmount đã lọc { not: null } ở where — non-null assertion an toàn ở đây.
    netAmount: new Decimal(row.netAmount!.toString()),
  }));
}

// cutoffDate mặc định "hôm nay" khi caller không truyền — mốc chọn được
// (hôm nay/cuối tháng/cuối năm/tùy chỉnh) do resolveCutoffDate (lib/cutoff.ts)
// resolve; nơi lưu lựa chọn của user (query param/Settings) là việc của
// wiring UI, chưa thuộc phạm vi ở đây.
export async function getHoldingDetail(
  holdingId: string,
  cutoffDate: Date = resolveCutoffDate({ key: "TODAY" }),
): Promise<HoldingDetail> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    include: {
      // Khớp thứ tự tie-break dùng ở actions.ts/migration backfill (date, createdAt, id) —
      // derivePosition() chỉ sort theo date, cần thứ tự DB nhất quán khi trùng ngày để
      // không lệch với Holding.quantity/avgCost đã materialize (docs/domain/02).
      cashflows: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau, không lộ thông tin tồn tại.
  if (!holding || holding.userId !== session.user.id) notFound();

  const position = derivePosition(
    holding.cashflows.map((cf) => ({
      type: cf.type,
      date: cf.date,
      quantity: new Decimal(cf.quantity.toString()),
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    })),
  );

  // Lịch sử giao dịch hiển thị mới nhất trước — đảo ngược mảng đã fetch theo thứ tự tăng dần.
  const cashflows: CashflowRow[] = [...holding.cashflows]
    .reverse()
    .map((cf) => ({
      id: cf.id,
      type: cf.type,
      date: cf.date.toISOString(),
      quantity: cf.quantity.toString(),
      pricePerUnit: cf.pricePerUnit.toString(),
      amount: cf.amount.toString(),
      feeAmount: cf.feeAmount.toString(),
      taxAmount: cf.taxAmount.toString(),
      note: cf.note,
    }));

  // Input XIRR: lọc cashflows đã fetch theo cutoffDate riêng cho XIRR (giữ
  // nguyên mảng `cashflows` phía trên đầy đủ lịch sử cho timeline hiển thị) —
  // không round-trip DB thứ hai cho Cashflow.
  const cashflowsForXirr = holding.cashflows
    .filter((cf) => cf.date.getTime() <= cutoffDate.getTime())
    .map((cf) => ({
      date: cf.date,
      amount: new Decimal(cf.amount.toString()),
    }));

  const isOpenPosition = !position.quantity.isZero();

  const [dividends, valuations] = await Promise.all([
    getCashDividends(holding.id, cutoffDate),
    valuateHoldings(
      [{ id: holding.id, symbol: holding.symbol, quantity: position.quantity }],
      cutoffDate,
    ),
  ]);

  const valuation = valuations.get(holding.id);
  const currentNav = valuation?.status === "VALUED" ? valuation.nav : null;

  const xirr = computeXirr(
    buildXirrCashflows({
      cashflows: cashflowsForXirr,
      dividends,
      isOpenPosition,
      cutoffDate,
      currentNav,
    }),
  );

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: position.quantity.toString(),
    avgCost: position.avgCost.toString(),
    totalCostBasis: position.quantity.mul(position.avgCost).toString(),
    cashflows,
    xirr,
  };
}

// Query hẹp riêng cho màn nhập giá tay (NavOverrideForm) — không kéo cashflows
// như getHoldingDetail (màn này không cần lịch sử giao dịch), chỉ cần metadata
// + số lượng/vốn để hiển thị preview NAV.
export async function getHoldingForPricing(holdingId: string): Promise<{
  id: string;
  symbol: string;
  name: string | null;
  type: HoldingSummary["type"];
  unit: string;
  quantity: string;
  totalCostBasis: string;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
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

  if (!holding || holding.userId !== session.user.id) notFound();

  const quantity = new Decimal(holding.quantity.toString());
  const avgCost = new Decimal(holding.avgCost.toString());

  return {
    id: holdingId,
    symbol: holding.symbol,
    name: holding.name,
    type: holding.type,
    unit: holding.unit,
    quantity: quantity.toString(),
    totalCostBasis: quantity.mul(avgCost).toString(),
  };
}
