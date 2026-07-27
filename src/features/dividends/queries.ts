import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import type { DividendType, SettingValueType } from "@prisma/client";
import type {
  DividendHistoryRow,
  DividendHistorySummary,
} from "@/features/dividends/components/DividendHistoryList";
import type { DividendHolding } from "@/features/dividends/types";
import { getOpenHoldings } from "@/features/holdings/queries";
import { assertNever } from "@/lib/assert-never";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate } from "@/lib/cutoff";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { formatDate } from "@/lib/format";
import {
  buildPositionEvents,
  buildQuantityTimeline,
} from "@/lib/position-trail";
import {
  AppError,
  parseSettingValue,
  pickEffectiveSetting,
} from "@/lib/settings";
import { valuateHoldings } from "@/lib/valuation";

import {
  findCashLikeDividendNetAmounts,
  findDividendHistorySource,
  findParValueSettingRows,
} from "./repository";

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

// Tổng cổ tức tiền mặt (net) ĐÃ nhận từ trước tới nay của MỘT Holding — dùng
// cho DividendRecordedResult.totalDividendReceived (mockup Phase 4, 4d).
// KHÔNG lọc theo cutoffDate (đây là tổng lịch sử, không phải input XIRR) và
// đọc TRỰC TIẾP từ DB nên luôn phản ánh dividend VỪA ghi khi gọi SAU
// transaction của recordDividend (features/dividends/actions.ts).
// Phase 7 (#101) sẽ cần cộng thêm "BOND_COUPON" vào mảng này — trái tức cũng
// là dòng tiền tiền mặt đã nhận, cùng ý nghĩa với CASH ở đây.
const CASH_LIKE_DIVIDEND_TYPES: DividendType[] = ["CASH"];

export async function getTotalCashDividendReceived(
  holdingId: string,
  userId: string,
): Promise<Decimal> {
  const netAmounts = await findCashLikeDividendNetAmounts(
    holdingId,
    userId,
    CASH_LIKE_DIVIDEND_TYPES,
  );
  return netAmounts.reduce((sum, amount) => sum.plus(amount), new Decimal(0));
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

  // "Không tồn tại" và "không thuộc user hiện tại" đều trả `null` — xử lý
  // giống nhau, không lộ thông tin tồn tại (findDividendHistorySource tự
  // filter userId, xem repository.ts).
  const holding = await findDividendHistorySource(holdingId, session.user.id);
  if (!holding) notFound();

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

  const parValueRows = await findParValueSettingRows();

  const events = buildPositionEvents({
    cashflows: holding.cashflows,
    dividends: holding.dividends,
  });

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

  const rows: DividendHistoryRow[] = sortedDividends.map((dividend, index) => {
    // Mọi dividend đều là 1 event trong `events` phía trên -> luôn có entry.
    const { before, after } = timeline.get(dividend.id)!;
    const dateLabel = formatDate(dividend.date);
    // sortedDividends đã sort mới nhất trước (theo date rồi createdAt) -> dòng
    // đầu tiên (index 0) LUÔN là bản ghi mới nhất trong toàn bộ lịch sử của
    // holding này (badge "MỚI", mockup 4e) — không cần biết đây có phải vừa từ
    // action nào ghi hay không.
    const isNew = index === 0;

    switch (dividend.type) {
      case "CASH": {
        // grossAmount/taxAmount/netAmount luôn có giá trị khi type === CASH.
        const grossAmount = dividend.grossAmount!;
        const taxAmount = dividend.taxAmount!;
        const netAmount = dividend.netAmount!;
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
          isNew,
          grossAmount: grossAmount.toString(),
          taxAmount: taxAmount.toString(),
          netAmount: netAmount.toString(),
        } satisfies DividendHistoryRow;
      }
      case "STOCK": {
        // stockQuantity luôn có giá trị khi type === STOCK.
        const stockQuantity = dividend.stockQuantity!;
        stockAddedQuantityTotal = stockAddedQuantityTotal.plus(stockQuantity);
        stockCount += 1;

        return {
          id: dividend.id,
          type: "STOCK",
          percentLabel: roundPercentLabel(stockQuantity, before),
          date: dateLabel,
          isNew,
          unit: holding.unit,
          quantityBefore: before.toString(),
          quantityAfter: after.toString(),
          addedQuantity: stockQuantity.toString(),
        } satisfies DividendHistoryRow;
      }
      case "BOND_COUPON":
        // Chưa hỗ trợ hiển thị lịch sử trái tức — issue #101 sẽ triển khai
        // đủ format/tổng hợp. Lỗi lường trước (AppError), không throw Error
        // trần — cùng convention error-handling.md.
        throw new AppError(
          "NOT_IMPLEMENTED",
          "Trái tức chưa được hỗ trợ ở lịch sử cổ tức — xem issue #101",
        );
      default:
        return assertNever(dividend.type);
    }
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
