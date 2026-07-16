import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import type { SettingValueType } from "@prisma/client";
import type {
  DividendHistoryRow,
  DividendHistorySummary,
} from "@/features/dividends/components/DividendHistoryList";
import { buildQuantityTimeline } from "@/features/dividends/position-trail";
import type { PositionTrailEvent } from "@/features/dividends/position-trail";
import type { DividendHolding } from "@/features/dividends/types";
import { getOpenHoldings } from "@/features/holdings/queries";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  AppError,
  parseSettingValue,
  pickEffectiveSetting,
  SETTING_KEYS,
} from "@/lib/settings";
import { valuateHoldings } from "@/lib/valuation";

// Danh sách Holding đang mở dùng cho HoldingSwitcher (DividendForm) — tái dùng
// getOpenHoldings() (features/holdings/queries.ts, đã filter userId + quantity
// > 0), chỉ thêm marketValue tại cutoff hiện tại. marketValue fallback về
// totalCostBasis khi MISSING_PRICE (docs/domain/04 "Thiếu giá": không mặc định
// 0, dùng vốn gốc làm ước lượng gần đúng cho màn chọn mã, không phải số chính
// thức hiển thị NAV).
export async function getOpenHoldingsForDividendSwitcher(): Promise<
  DividendHolding[]
> {
  const open = await getOpenHoldings();
  const cutoffDate = resolveCutoffDate(await getCutoffSelection());

  const valuations = await valuateHoldings(
    open.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );

  return open.map((holding) => {
    const valuation = valuations.get(holding.id);
    const marketValue =
      valuation?.status === "VALUED"
        ? valuation.nav.toString()
        : holding.totalCostBasis;

    return {
      id: holding.id,
      symbol: holding.symbol,
      name: holding.name,
      type: holding.type,
      quantity: holding.quantity,
      unit: holding.unit,
      avgCost: holding.avgCost,
      marketValue,
    };
  });
}

// parValueRows đã fetch 1 LẦN cho toàn bộ lịch sử — tránh N+1 khi suy ngược
// percentLabel cho từng dòng CASH (mỗi dòng có thể rơi vào một effective
// window mệnh giá khác nhau nếu Setting đổi theo thời gian).
function resolveParValueAt(
  rows: { value: string; valueType: SettingValueType; effectiveFrom: Date }[],
  atDate: Date,
): Decimal {
  const row = pickEffectiveSetting(rows, atDate);
  if (!row) {
    throw new AppError(
      "SETTING_NOT_FOUND",
      `Thiếu cấu hình DIVIDEND_PAR_VALUE cho ngày ${atDate.toISOString()}`,
    );
  }
  const parsed = parseSettingValue(row.value, row.valueType);
  if (!(parsed instanceof Decimal)) {
    throw new AppError(
      "INVALID_SETTING_VALUE",
      "Setting DIVIDEND_PAR_VALUE không phải kiểu DECIMAL",
    );
  }
  return parsed;
}

// percentLabel suy ngược từ dữ liệu đã lưu (Dividend không lưu percent trực
// tiếp — xem docs/domain/03-dividends.md). before=0 (hiếm, dữ liệu bất
// thường) -> "0" thay vì chia cho 0.
function roundPercentLabel(numerator: Decimal, denominator: Decimal): string {
  if (denominator.isZero()) return "0";
  return numerator
    .div(denominator)
    .mul(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toString();
}

// Lịch sử cổ tức của MỘT Holding (mockup Phase 4 Screens, 4e) — verify
// holding.userId === session (cùng pattern getHoldingDetail, notFound() khi
// không khớp, không lộ thông tin tồn tại).
export async function getDividendHistory(holdingId: string): Promise<{
  holding: { symbol: string; name: string | null };
  summary: DividendHistorySummary;
  rows: DividendHistoryRow[];
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const holding = await db.holding.findUnique({
    where: { id: holdingId },
    select: {
      userId: true,
      symbol: true,
      name: true,
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
        },
      },
    },
  });

  if (!holding || holding.userId !== session.user.id) notFound();

  if (holding.dividends.length === 0) {
    return {
      holding: { symbol: holding.symbol, name: holding.name },
      summary: {
        cashNetTotal: "0",
        cashCount: 0,
        stockAddedQuantityTotal: "0",
        stockCount: 0,
        unit: holding.unit,
      },
      rows: [],
    };
  }

  const parValueRows = await db.setting.findMany({
    where: { key: SETTING_KEYS.DIVIDEND_PAR_VALUE },
    select: { value: true, valueType: true, effectiveFrom: true },
  });

  const events: PositionTrailEvent[] = [
    ...holding.cashflows.map((cf) => ({
      id: cf.id,
      date: cf.date,
      createdAt: cf.createdAt,
      delta:
        cf.type === "BUY"
          ? new Decimal(cf.quantity.toString())
          : new Decimal(cf.quantity.toString()).neg(),
    })),
    ...holding.dividends.map((dividend) => ({
      id: dividend.id,
      date: dividend.date,
      createdAt: dividend.createdAt,
      delta:
        dividend.type === "STOCK"
          ? // stockQuantity luôn có giá trị khi type === STOCK.
            new Decimal(dividend.stockQuantity!.toString())
          : new Decimal(0),
    })),
  ];

  const timeline = buildQuantityTimeline(events);

  let cashNetTotal = new Decimal(0);
  let cashCount = 0;
  let stockAddedQuantityTotal = new Decimal(0);
  let stockCount = 0;

  // Mới nhất trước — sort trên Date GỐC (không phải chuỗi đã format, tránh
  // parse ngược locale) trước khi map sang row hiển thị.
  const sortedDividends = [...holding.dividends].sort((a, b) => {
    const dateDiff = b.date.getTime() - a.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const rows: DividendHistoryRow[] = sortedDividends.map((dividend) => {
    // Mọi dividend đều là 1 event trong `events` phía trên -> luôn có entry.
    const { before, after } = timeline.get(dividend.id)!;
    const dateLabel = formatDate(dividend.date);

    if (dividend.type === "CASH") {
      // grossAmount/taxAmount/netAmount luôn có giá trị khi type === CASH.
      const grossAmount = new Decimal(dividend.grossAmount!.toString());
      const taxAmount = new Decimal(dividend.taxAmount!.toString());
      const netAmount = new Decimal(dividend.netAmount!.toString());
      const parValueAtDate = resolveParValueAt(parValueRows, dividend.date);

      cashNetTotal = cashNetTotal.plus(netAmount);
      cashCount += 1;

      return {
        id: dividend.id,
        type: "CASH",
        percentLabel: roundPercentLabel(
          grossAmount,
          before.mul(parValueAtDate),
        ),
        date: dateLabel,
        grossAmount: grossAmount.toString(),
        taxAmount: taxAmount.toString(),
        netAmount: netAmount.toString(),
      } satisfies DividendHistoryRow;
    }

    // stockQuantity luôn có giá trị khi type === STOCK.
    const stockQuantity = new Decimal(dividend.stockQuantity!.toString());
    stockAddedQuantityTotal = stockAddedQuantityTotal.plus(stockQuantity);
    stockCount += 1;

    return {
      id: dividend.id,
      type: "STOCK",
      percentLabel: roundPercentLabel(stockQuantity, before),
      date: dateLabel,
      unit: holding.unit,
      quantityBefore: before.toString(),
      quantityAfter: after.toString(),
      addedQuantity: stockQuantity.toString(),
    } satisfies DividendHistoryRow;
  });

  return {
    holding: { symbol: holding.symbol, name: holding.name },
    summary: {
      cashNetTotal: cashNetTotal.toString(),
      cashCount,
      stockAddedQuantityTotal: stockAddedQuantityTotal.toString(),
      stockCount,
      unit: holding.unit,
    },
    rows,
  };
}
