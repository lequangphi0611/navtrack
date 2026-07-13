import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { CashflowType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { derivePosition } from "@/lib/cost-basis";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { db } from "@/lib/db";
import { valuateHoldings } from "@/lib/valuation";
import { computeXirr } from "@/lib/xirr";
import { buildXirrCashflows } from "@/lib/xirr-cashflow";

import { paginateRows } from "./cashflow-pagination";
import type {
  CashflowPage,
  CashflowRow,
  HoldingDetail,
  HoldingsOverview,
  HoldingSummary,
} from "./types";

// Số dòng lịch sử giao dịch mỗi trang (docs/rules/performance.md, mục pagination
// lịch sử giao dịch). Cursor theo `id`, tie-break khớp thứ tự dùng khắp queries.ts/
// actions.ts (date, createdAt, id) — nhưng đảo ngược (desc) vì hiển thị mới nhất trước.
const CASHFLOW_PAGE_SIZE = 20;

// Convert 1 row Cashflow (Decimal fields) sang CashflowRow hiển thị (string fields) —
// biên server duy nhất làm việc này, dùng chung cho getHoldingCashflowPage.
function toCashflowRow(cf: {
  id: string;
  type: CashflowType;
  date: Date;
  quantity: Decimal;
  pricePerUnit: Decimal;
  amount: Decimal;
  feeAmount: Decimal;
  taxAmount: Decimal;
  note: string | null;
}): CashflowRow {
  return {
    id: cf.id,
    type: cf.type,
    date: cf.date.toISOString(),
    quantity: cf.quantity.toString(),
    pricePerUnit: cf.pricePerUnit.toString(),
    amount: cf.amount.toString(),
    feeAmount: cf.feeAmount.toString(),
    taxAmount: cf.taxAmount.toString(),
    note: cf.note,
  };
}

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

// Cursor pagination cho lịch sử giao dịch HIỂN THỊ (docs/rules/performance.md,
// mục "Danh sách dài — pagination cho lịch sử giao dịch") — TÁCH biệt khỏi
// cashflows full-history mà getHoldingDetail() dùng cho derivePosition/XIRR:
// hiển thị chỉ cần trang hiện tại, tính toán cần toàn bộ lịch sử tới cutoff.
// Trước đây gộp chung một `include` không `take` — phình vô hạn theo số giao
// dịch đã ghi (bug #16).
export async function getHoldingCashflowPage(
  holdingId: string,
  cursor?: string,
): Promise<CashflowPage> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    select: { userId: true },
  });
  if (!holding || holding.userId !== session.user.id) notFound();

  // Cursor do client gửi lên — KHÔNG tin nó thuộc holding này. Validate tường
  // minh trước khi dùng làm Prisma `cursor`, tránh dùng id cashflow của
  // holding/user khác để dò dữ liệu (IDOR qua cursor).
  if (cursor) {
    const owned = await db.cashflow.findFirst({
      where: { id: cursor, holdingId },
      select: { id: true },
    });
    if (!owned) throw new Error("Invalid cursor");
  }

  const rows = await db.cashflow.findMany({
    where: { holdingId },
    // Mới nhất trước — ngược hướng với tie-break "asc" mà derivePosition/XIRR
    // dùng bên dưới, vì đây là danh sách hiển thị, không phải input tính toán.
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: CASHFLOW_PAGE_SIZE + 1,
    select: {
      id: true,
      type: true,
      date: true,
      quantity: true,
      pricePerUnit: true,
      amount: true,
      feeAmount: true,
      taxAmount: true,
      note: true,
    },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const { page, nextCursor } = paginateRows(rows, CASHFLOW_PAGE_SIZE);
  return { cashflows: page.map(toCashflowRow), nextCursor };
}

// cutoffDate: khi caller không truyền tường minh, tự đọc mốc chốt user đã
// chọn qua cookie (getCutoffSelection() — cùng cách Dashboard/Settings dùng),
// KHÔNG hard-code "TODAY" nữa (code review #4: 3 nơi gọi hàm này — trang chi
// tiết vị thế, form thêm/sửa giao dịch — đều không truyền, nên trước đây luôn
// lệch khỏi mốc chốt user đang xem ở Dashboard/Settings).
export async function getHoldingDetail(
  holdingId: string,
  cutoffDate?: Date,
): Promise<HoldingDetail> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const resolvedCutoffDate =
    cutoffDate ?? resolveCutoffDate(await getCutoffSelection());

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    select: {
      id: true,
      userId: true,
      symbol: true,
      name: true,
      type: true,
      unit: true,
      // select hẹp — derivePosition/XIRR chỉ cần 5 field này, KHÔNG kéo
      // id/feeAmount/taxAmount/note (lịch sử hiển thị đã tách sang
      // getHoldingCashflowPage riêng — docs/rules/data-prisma.md, mục
      // "Chọn select hẹp thay vì include full-row").
      cashflows: {
        // Khớp thứ tự tie-break dùng ở actions.ts/migration backfill (date, createdAt, id) —
        // derivePosition() chỉ sort theo date, cần thứ tự DB nhất quán khi trùng ngày để
        // không lệch với Holding.quantity/avgCost đã materialize (docs/domain/02).
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          type: true,
          date: true,
          quantity: true,
          pricePerUnit: true,
          amount: true,
        },
      },
    },
  });

  // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau, không lộ thông tin tồn tại.
  if (!holding || holding.userId !== session.user.id) notFound();

  // Cashflow TÍNH TỚI cutoffDate — dùng cho cả position-tại-cutoff lẫn XIRR,
  // hai input này PHẢI cùng phạm vi thời gian (code review #5: trước đây
  // `position` tính từ TOÀN BỘ lịch sử trong khi `cashflowsForXirr` đã lọc,
  // tự mâu thuẫn nội bộ — vd holding vừa đóng SAU cutoff vẫn báo isOpenPosition
  // sai). Không round-trip DB thứ hai — lọc lại trên `holding.cashflows` đã
  // fetch.
  const cashflowsUpToCutoff = holding.cashflows.filter(
    (cf) => cf.date.getTime() <= resolvedCutoffDate.getTime(),
  );

  // Vị thế TẠI THỜI ĐIỂM cutoff — KHÁC Holding.quantity/avgCost cache (luôn
  // là snapshot HIỆN TẠI, không đổi theo cutoff, dùng cho các nơi khác như
  // TotalInvestedSection). Dùng để valuate/xác định isOpenPosition đúng thời
  // điểm đang xem, nhất quán với cashflowsForXirr/dividends bên dưới.
  const position = derivePosition(
    cashflowsUpToCutoff.map((cf) => ({
      type: cf.type,
      date: cf.date,
      quantity: new Decimal(cf.quantity.toString()),
      pricePerUnit: new Decimal(cf.pricePerUnit.toString()),
    })),
  );

  const cashflowsForXirr = cashflowsUpToCutoff.map((cf) => ({
    date: cf.date,
    amount: new Decimal(cf.amount.toString()),
  }));

  const isOpenPosition = !position.quantity.isZero();

  // cashflowPage: trang đầu (mới nhất, tối đa CASHFLOW_PAGE_SIZE dòng) của lịch
  // sử giao dịch HIỂN THỊ — round-trip DB riêng (getHoldingCashflowPage tự
  // check ownership), gộp cùng dividends/valuations qua Promise.all để không
  // tăng round-trip tuần tự. KHÔNG dùng để tính position/XIRR ở trên — hai
  // phép tính đó dùng holding.cashflows (full history) đã fetch riêng.
  const [dividends, valuations, cashflowPage] = await Promise.all([
    getCashDividends(holding.id, resolvedCutoffDate),
    valuateHoldings(
      [{ id: holding.id, symbol: holding.symbol, quantity: position.quantity }],
      resolvedCutoffDate,
    ),
    getHoldingCashflowPage(holding.id),
  ]);

  const valuation = valuations.get(holding.id);
  const currentNav = valuation?.status === "VALUED" ? valuation.nav : null;

  const xirr = computeXirr(
    buildXirrCashflows({
      cashflows: cashflowsForXirr,
      dividends,
      isOpenPosition,
      cutoffDate: resolvedCutoffDate,
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
    cashflows: cashflowPage.cashflows,
    cashflowsNextCursor: cashflowPage.nextCursor,
    xirr,
  };
}

// Tra 1 cashflow cụ thể để sửa (EditTransactionFormSection) — KHÔNG dựa vào
// HoldingDetail.cashflows (chỉ là trang đầu tối đa 20 dòng kể từ khi tách
// pagination, bug #16); sửa một giao dịch cũ hơn 20 dòng gần nhất phải vẫn
// tìm được. Query round-trip riêng, scoped theo holdingId + userId.
export async function getCashflowForEdit(
  holdingId: string,
  cashflowId: string,
): Promise<CashflowRow | null> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cashflow = await db.cashflow.findUnique({
    where: { id: cashflowId },
    select: {
      id: true,
      holdingId: true,
      type: true,
      date: true,
      quantity: true,
      pricePerUnit: true,
      amount: true,
      feeAmount: true,
      taxAmount: true,
      note: true,
      holding: { select: { userId: true } },
    },
  });

  if (
    !cashflow ||
    cashflow.holdingId !== holdingId ||
    cashflow.holding.userId !== session.user.id
  ) {
    return null;
  }

  return toCashflowRow(cashflow);
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
