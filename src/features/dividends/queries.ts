import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import type { DividendType } from "@prisma/client";
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
import { CASH_FLOW_DIVIDEND_TYPES } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import {
  buildPositionEvents,
  buildQuantityTimeline,
} from "@/lib/position-trail";
import { valuateHoldings } from "@/lib/valuation";

import {
  deriveCouponFrequencyMonths,
  resolveParValueAt,
  roundPercentLabel,
} from "./dividend-percent-label";
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

// Tổng cổ tức tiền mặt (net) ĐÃ nhận từ trước tới nay của MỘT Holding — dùng
// cho DividendRecordedResult.totalDividendReceived (mockup Phase 4, 4d).
// KHÔNG lọc theo cutoffDate (đây là tổng lịch sử, không phải input XIRR) và
// đọc TRỰC TIẾP từ DB nên luôn phản ánh dividend VỪA ghi khi gọi SAU
// transaction của recordDividend (features/dividends/actions.ts).
// Phase 7 (#58): gồm CẢ trái tức — cùng ý nghĩa "tiền đã thực nhận" với CASH.
// Dùng chung hằng số CASH_FLOW_DIVIDEND_TYPES với bộ lọc dòng tiền XIRR
// (lib/enums.ts) để hai nơi không lệch nhau.
const CASH_LIKE_DIVIDEND_TYPES: DividendType[] = [...CASH_FLOW_DIVIDEND_TYPES];

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

  // Thẻ "Trái tức" chỉ xuất hiện với vị thế trái phiếu (mockup 7d) — cổ phiếu/
  // quỹ giữ nguyên 2 thẻ như Phase 4, không hiện một ô 0 ₫ vô nghĩa. Bám LOẠI
  // TÀI SẢN (BOND) chứ không bám "có dòng trái tức nào chưa": trái phiếu chưa
  // ghi kỳ nào vẫn nên thấy ô 0 kỳ, còn cổ phiếu thì không bao giờ.
  const isBond = holding.type === "BOND";
  const bondSummaryFields = isBond
    ? { bondCouponNetTotal: "0", bondCouponCount: 0 }
    : {};

  if (holding.dividends.length === 0) {
    return {
      holding: { symbol: holding.symbol, name: holding.name },
      summary: {
        cashNetTotal: "0",
        cashCount: 0,
        stockAddedQuantityTotal: "0",
        stockCount: 0,
        unit: holding.unit,
        ...bondSummaryFields,
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
  let bondCouponNetTotal = new Decimal(0);
  let bondCouponCount = 0;

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
      case "BOND_COUPON": {
        // grossAmount/taxAmount/netAmount + 2 field đóng băng luôn có giá trị
        // khi type === BOND_COUPON (ràng buộc ở tầng ghi, actions.ts).
        const grossAmount = dividend.grossAmount!;
        const taxAmount = dividend.taxAmount!;
        const netAmount = dividend.netAmount!;
        const couponRatePercentApplied = dividend.couponRatePercentApplied!;

        bondCouponNetTotal = bondCouponNetTotal.plus(netAmount);
        bondCouponCount += 1;

        // Kỳ trả lãi suy NGƯỢC từ chính dòng này, KHÔNG đọc BondTerms hiện tại
        // — sửa điều khoản về sau không được làm đổi nhãn của kỳ đã ghi
        // (process/phase-7.md "Tiêu chí hoàn thành"). Xem
        // deriveCouponFrequencyMonths (dividend-percent-label.ts).
        const couponFrequencyMonths = deriveCouponFrequencyMonths({
          grossAmount,
          parValueApplied: dividend.parValueApplied!,
          couponRatePercentApplied,
          quantityAtDate: before,
        });

        return {
          id: dividend.id,
          type: "BOND_COUPON",
          // KHÔNG suy ngược như CASH/STOCK — lãi suất đã được đóng băng nguyên
          // vẹn lúc ghi (docs/domain/03-dividends.md "Hiển thị lịch sử").
          percentLabel: couponRatePercentApplied.toString(),
          couponRatePercentApplied: couponRatePercentApplied.toString(),
          ...(couponFrequencyMonths !== null ? { couponFrequencyMonths } : {}),
          date: dateLabel,
          isNew,
          grossAmount: grossAmount.toString(),
          taxAmount: taxAmount.toString(),
          netAmount: netAmount.toString(),
          // Miễn thuế nhận biết bằng THUẾ ĐÃ GHI bằng 0 trên chính dòng này.
          // Ở tầng lịch sử không có issuerType của thời điểm ghi (BondTerms
          // sửa được), nên dùng dữ liệu đã đóng băng thay vì đọc lại điều khoản
          // hiện tại — nhất quán với nguyên tắc "kỳ đã ghi không đổi".
          isTaxExempt: taxAmount.isZero(),
        } satisfies DividendHistoryRow;
      }
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
      ...(isBond
        ? {
            bondCouponNetTotal: bondCouponNetTotal.toString(),
            bondCouponCount,
          }
        : {}),
    },
    rows,
  };
}
