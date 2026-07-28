import { notFound } from "next/navigation";

import type { BondIssuerType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import {
  computeCouponPeriodIndex,
  computeNextCouponDate,
  startOfUtcDay,
} from "@/lib/bond-schedule";
import { formatDate } from "@/lib/format";
import { bondInterestTaxKey, resolveDecimalSetting } from "@/lib/settings";

import { findLastBondCouponDate } from "../../dividends/repository";
import { findBondSettlementSource, findBondTerms } from "../repository";

// Truy vấn phục vụ 3 màn Phase 7 cần đọc `BondTerms`: nhập/sửa điều khoản (7a),
// ghi trái tức (7b/7c/7g — cần thẻ tóm tắt + thuế suất + ngày kỳ tới tự điền),
// tất toán đáo hạn (7e/7f). Gom một file vì cả ba dùng chung đúng một nguồn dữ
// liệu và cùng một quy tắc "thiếu điều khoản thì app không đoán".
//
// Mọi hàm ở đây tự verify session + userId qua repository (docs/rules/data-prisma.md).

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type BondTermsFormData = {
  holding: { id: string; symbol: string; name: string | null };
  defaults: {
    issuerType: BondIssuerType;
    parValue: string;
    couponRatePercent: string;
    couponFrequencyMonths: string;
    firstCouponDate: string;
    maturityDate: string;
  };
};

// Prefill màn 7a. Vị thế chưa từng nhập điều khoản -> mọi ô rỗng, `issuerType`
// mặc định CORPORATE (loại phổ biến hơn và là loại CÓ thuế — mặc định sang
// GOVERNMENT sẽ khiến một lần bỏ sót biến thành thuế 0 âm thầm).
export async function getBondTermsFormData(
  holdingId: string,
): Promise<BondTermsFormData> {
  const userId = await requireUserId();

  const holding = await findBondSettlementSource(holdingId, userId);
  if (!holding || holding.type !== "BOND") notFound();

  const terms = await findBondTerms(holdingId, userId);

  return {
    holding: { id: holding.id, symbol: holding.symbol, name: holding.name },
    defaults: {
      issuerType: terms?.issuerType ?? "CORPORATE",
      parValue: terms?.parValue.toString() ?? "",
      couponRatePercent: terms?.couponRatePercent?.toString() ?? "",
      couponFrequencyMonths: terms?.couponFrequencyMonths?.toString() ?? "",
      firstCouponDate: terms?.firstCouponDate
        ? toDateInputValue(terms.firstCouponDate)
        : "",
      maturityDate: terms?.maturityDate
        ? toDateInputValue(terms.maturityDate)
        : "",
    },
  };
}

export type MaturitySettlementData = {
  holding: {
    id: string;
    symbol: string;
    quantity: string;
    unit: string;
    avgCost: string;
  };
  parValue: string;
  maturityDateLabel: string;
  defaultDateInputValue: string;
  interestTaxRatePercent: string;
};

// Prefill màn 7e/7f. Thiếu `BondTerms` -> notFound thay vì render form rỗng:
// không có mệnh giá thì không prefill được giá nhận về, và không có
// `issuerType` thì không biết áp thuế lãi 5% hay 0% — app từ chối đoán
// (docs/domain/07-tax.md). Route gọi hàm này chỉ tới được từ nút trên vị thế đã
// có điều khoản.
export async function getMaturitySettlementData(
  holdingId: string,
): Promise<MaturitySettlementData> {
  const userId = await requireUserId();

  const holding = await findBondSettlementSource(holdingId, userId);
  if (!holding || holding.type !== "BOND" || !holding.bondTerms) notFound();

  const { parValue, maturityDate } = holding.bondTerms;
  // Ngày tất toán prefill = ngày đáo hạn theo hợp đồng; chưa nhập ngày đáo hạn
  // thì lấy hôm nay (vẫn sửa được — "prefill, không khoá").
  const settlementDate = maturityDate ?? new Date();
  const interestTaxRatePercent = await resolveDecimalSetting(
    bondInterestTaxKey(holding.bondTerms.issuerType),
    settlementDate,
  );

  return {
    holding: {
      id: holding.id,
      symbol: holding.symbol,
      quantity: holding.quantity.toString(),
      unit: holding.unit,
      avgCost: holding.avgCost.toString(),
    },
    parValue: parValue.toString(),
    maturityDateLabel: maturityDate ? formatDate(maturityDate) : "chưa nhập",
    defaultDateInputValue: toDateInputValue(settlementDate),
    interestTaxRatePercent: interestTaxRatePercent.toString(),
  };
}

export type BondHoldingActions = {
  hasTerms: boolean;
  overdue?: { maturityDateLabel: string; lateDays: number };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Trạng thái trái phiếu cho màn chi tiết vị thế: đã nhập điều khoản chưa, và
// có đang QUÁ ĐÁO HẠN không (mockup 7h — `maturityDate` đã qua mà số lượng vẫn
// > 0, tức user quên ghi tất toán).
//
// "Quá hạn" cố ý KHÔNG ẩn vị thế đi mà chỉ gắn cảnh báo: vị thế vẫn đang tính
// vào NAV theo mệnh giá, và app không tự ghi tất toán thay người dùng vì ngày
// tiền thực về có thể lệch hợp đồng (docs/domain/10-cashflow-calendar.md
// "Ca biên").
export async function getBondHoldingActions(
  holdingId: string,
): Promise<BondHoldingActions | null> {
  const userId = await requireUserId();

  const holding = await findBondSettlementSource(holdingId, userId);
  if (!holding || holding.type !== "BOND") return null;
  if (!holding.bondTerms) return { hasTerms: false };

  const { maturityDate } = holding.bondTerms;
  if (!maturityDate || holding.quantity.lte(0)) return { hasTerms: true };

  const today = startOfUtcDay(new Date());
  const maturity = startOfUtcDay(maturityDate);
  const lateDays = Math.floor(
    (today.getTime() - maturity.getTime()) / MS_PER_DAY,
  );
  if (lateDays <= 0) return { hasTerms: true };

  return {
    hasTerms: true,
    overdue: { maturityDateLabel: formatDate(maturityDate), lateDays },
  };
}

export type BondCouponFormData = {
  terms: {
    issuerType: BondIssuerType;
    parValue: string;
    couponRatePercent: string | null;
    couponFrequencyMonths: number | null;
  } | null;
  taxRatePercent: string;
  couponPeriodLabel?: string;
  nextCouponDateInputValue?: string;
};

// Ngữ cảnh trái tức cho `DividendForm` (7b/7c/7g). `terms: null` KHÔNG phải lỗi
// ở đây — form sẽ render màn chặn 7g dẫn user sang 7a; chỉ Server Action mới
// chặn cứng khi thực sự ghi.
//
// `taxRatePercent` resolve theo NGÀY KỲ TỚI (mốc sẽ được ghi), không phải hôm
// nay: thuế effective-dated theo ngày trả lãi (docs/domain/07-tax.md), nên một
// kỳ rơi sau ngày đổi chính sách phải hiện đúng mức mới ngay trên form.
export async function getBondCouponFormData(
  holdingId: string,
): Promise<BondCouponFormData | null> {
  const userId = await requireUserId();

  const holding = await findBondSettlementSource(holdingId, userId);
  if (!holding || holding.type !== "BOND") return null;

  const terms = await findBondTerms(holdingId, userId);
  if (!terms) {
    // Chưa có điều khoản: vẫn phải trả về ngữ cảnh (để tab "Trái tức" xuất hiện
    // và dẫn sang màn nhập), nhưng chưa biết issuerType nên không resolve được
    // thuế — "0" ở đây chỉ là chỗ giữ chỗ cho UI bị chặn, không dùng để tính gì.
    return { terms: null, taxRatePercent: "0" };
  }

  const lastPaidCouponDate = await findLastBondCouponDate(holdingId, userId);
  const nextCouponDate = computeNextCouponDate({
    couponFrequencyMonths: terms.couponFrequencyMonths,
    firstCouponDate: terms.firstCouponDate,
    maturityDate: terms.maturityDate,
    nextCouponDateOverride: terms.nextCouponDateOverride,
    lastPaidCouponDate,
    today: new Date(),
  });

  const taxRatePercent = await resolveDecimalSetting(
    bondInterestTaxKey(terms.issuerType),
    nextCouponDate ?? new Date(),
  );

  const periodIndex = nextCouponDate
    ? computeCouponPeriodIndex(terms, nextCouponDate)
    : null;

  return {
    terms: {
      issuerType: terms.issuerType,
      parValue: terms.parValue.toString(),
      couponRatePercent: terms.couponRatePercent?.toString() ?? null,
      couponFrequencyMonths: terms.couponFrequencyMonths,
    },
    taxRatePercent: taxRatePercent.toString(),
    ...(periodIndex !== null
      ? { couponPeriodLabel: `KỲ ${periodIndex} · TỰ ĐIỀN` }
      : {}),
    ...(nextCouponDate
      ? { nextCouponDateInputValue: toDateInputValue(nextCouponDate) }
      : {}),
  };
}
