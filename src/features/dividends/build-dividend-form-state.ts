import type Decimal from "decimal.js";

import type { DividendFormState } from "@/features/dividends/types";
import { assertNever } from "@/lib/assert-never";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

export type PriceAdjustment = { oldPrice: Decimal; newPrice: Decimal };

// Chỉ set khi CÓ điều chỉnh thật sự xảy ra (resolveOldPriceInTx không null VÀ
// compute*PriceAdjustment không null) — vắng mặt = ẩn khối "Đã điều chỉnh giá"
// (issue #61, xem comment DividendRecordedResult ở types.ts). Nhận tham số thay
// vì đọc `input.priceAdjustment` như trước: nhánh BOND_COUPON không có field
// này (cố ý — trái tức không bù pha loãng NAV), nên union không cho truy cập
// thẳng nữa.
function buildPriceAdjustmentFields(priceAdjustment?: PriceAdjustment) {
  return priceAdjustment
    ? {
        navOverrideAdjusted: true as const,
        oldPrice: priceAdjustment.oldPrice.toString(),
        newPrice: priceAdjustment.newPrice.toString(),
      }
    : {};
}

// Ghi chú audit trail khi recordDividend (actions.ts) tự động điều chỉnh
// NavOverride bù pha loãng (issue #61, review PR #62 finding #2) — dùng ở
// recordCashDividend/recordStockDividend khi gọi applyPriceAdjustment. Sống ở
// đây (không phải actions.ts) để formatDate chỉ được import ở MỘT nơi trong
// feature dividends (docs/rules/typescript-style.md).
export function buildPriceAdjustmentNote(
  kind: "CASH" | "STOCK",
  date: Date,
): string {
  const label = kind === "CASH" ? "tiền mặt" : "cổ phiếu";
  return `Tự động điều chỉnh do ghi cổ tức ${label} ngày ${formatDate(date)}`;
}

export type RecordedDividend =
  | {
      type: "CASH";
      symbol: string;
      unit: string;
      percent: string;
      date: Date;
      paymentDate: Date | null;
      grossAmount: Decimal;
      taxAmount: Decimal;
      netAmount: Decimal;
      priceAdjustment?: PriceAdjustment;
      xirrBeforePercent: string | null;
      xirrAfterPercent: string | null;
      totalDividendReceived: Decimal;
      holdingId: string;
    }
  | {
      type: "STOCK";
      symbol: string;
      unit: string;
      percent: string;
      date: Date;
      paymentDate: Date | null;
      addedQuantity: Decimal;
      afterQuantity: Decimal;
      wasRounded: boolean;
      rawStockQuantity: Decimal;
      priceAdjustment?: PriceAdjustment;
      xirrBeforePercent: string | null;
      xirrAfterPercent: string | null;
      totalDividendReceived: Decimal;
      holdingId: string;
    }
  | {
      // Trái tức (Phase 7) — KHÔNG có `percent` do user nhập (mệnh giá/lãi suất
      // là điều khoản hợp đồng) và KHÔNG bao giờ có `priceAdjustment` (nhánh
      // BOND_COUPON bỏ qua hoàn toàn bù pha loãng NAV — xem actions.ts).
      // Kiểu union này khiến "quên bỏ qua" thành lỗi compile, không phải quy
      // ước ghi trong comment.
      type: "BOND_COUPON";
      symbol: string;
      unit: string;
      date: Date;
      paymentDate: Date | null;
      grossAmount: Decimal;
      taxAmount: Decimal;
      netAmount: Decimal;
      couponRatePercentApplied: Decimal;
      couponFrequencyMonths: number;
      xirrBeforePercent: string | null;
      xirrAfterPercent: string | null;
      totalDividendReceived: Decimal;
      holdingId: string;
    };

// Dựng DividendFormState hiển thị màn "Đã ghi cổ tức" từ kết quả đã ghi thành
// công (recordDividend, actions.ts) — hàm thuần, tách ra để unit test độc lập
// với transaction/DB. Logic giữ NGUYÊN VẸN so với recordDividend trước refactor
// (issue #107).
export function buildDividendFormState(
  input: RecordedDividend,
): DividendFormState {
  const dateLabel = formatDate(input.date);
  // Chỉ set khi user có nhập paymentDate — vắng mặt = ẩn dòng "ngày thực
  // nhận" (thuần thông tin, xem prisma/schema.prisma::Dividend.paymentDate).
  const paymentDateFields = input.paymentDate
    ? { paymentDateLabel: formatDate(input.paymentDate) }
    : {};
  // Chỉ set CẢ HAI khi CẢ before lẫn after đều tính được — vắng 1 trong 2 =
  // ẩn hẳn dòng "XIRR danh mục" (DividendRecordedResult.xirrBeforePercent/
  // xirrAfterPercent, xem comment types.ts), không hiển thị số sai/NaN.
  const xirrFields =
    input.xirrBeforePercent !== null && input.xirrAfterPercent !== null
      ? {
          xirrBeforePercent: input.xirrBeforePercent,
          xirrAfterPercent: input.xirrAfterPercent,
        }
      : {};

  switch (input.type) {
    case "CASH":
      return {
        ok: true,
        result: {
          symbol: input.symbol,
          type: "CASH",
          percentLabel: input.percent,
          dateLabel,
          grossAmount: input.grossAmount.toString(),
          taxAmount: input.taxAmount.toString(),
          netAmount: input.netAmount.toString(),
          ...paymentDateFields,
          ...buildPriceAdjustmentFields(input.priceAdjustment),
          ...xirrFields,
          totalDividendReceived: input.totalDividendReceived.toString(),
          historyHref: ROUTES.dividendHistory(input.holdingId),
          holdingHref: ROUTES.holdingDetail(input.holdingId),
        },
      };
    case "STOCK":
      return {
        ok: true,
        result: {
          symbol: input.symbol,
          type: "STOCK",
          percentLabel: input.percent,
          dateLabel,
          addedQuantity: input.addedQuantity.toString(),
          afterQuantity: input.afterQuantity.toString(),
          unit: input.unit,
          // rawAddedQuantity chỉ có mặt khi wasRounded=true (docs/dividends/types.ts).
          ...(input.wasRounded
            ? {
                wasRounded: true as const,
                rawAddedQuantity: input.rawStockQuantity.toString(),
              }
            : {}),
          ...paymentDateFields,
          ...buildPriceAdjustmentFields(input.priceAdjustment),
          ...xirrFields,
          totalDividendReceived: input.totalDividendReceived.toString(),
          historyHref: ROUTES.dividendHistory(input.holdingId),
          holdingHref: ROUTES.holdingDetail(input.holdingId),
        },
      };
    case "BOND_COUPON":
      return {
        ok: true,
        result: {
          symbol: input.symbol,
          type: "BOND_COUPON",
          // Nhãn là LÃI SUẤT COUPON đã đóng băng (hiển thị "Trái tức 9%"),
          // không phải "% cổ tức" do user nhập như CASH/STOCK — trái tức không
          // có % nào để nhập (docs/domain/03-dividends.md "Hiển thị lịch sử").
          percentLabel: input.couponRatePercentApplied.toString(),
          couponFrequencyMonths: input.couponFrequencyMonths,
          dateLabel,
          grossAmount: input.grossAmount.toString(),
          taxAmount: input.taxAmount.toString(),
          netAmount: input.netAmount.toString(),
          ...paymentDateFields,
          ...xirrFields,
          totalDividendReceived: input.totalDividendReceived.toString(),
          historyHref: ROUTES.dividendHistory(input.holdingId),
          holdingHref: ROUTES.holdingDetail(input.holdingId),
        },
      };
    default:
      return assertNever(input);
  }
}
