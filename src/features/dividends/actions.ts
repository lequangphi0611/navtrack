"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import { Prisma, type DividendType } from "@prisma/client";
import {
  buildDividendFormState,
  buildPriceAdjustmentNote,
  type PriceAdjustment,
} from "@/features/dividends/build-dividend-form-state";
import {
  computeBondCoupon,
  computeCashDividend,
  computeCashDividendPriceAdjustment,
  computeStockDividend,
  computeStockDividendPriceAdjustment,
  isStockQuantityOverrideValid,
} from "@/features/dividends/dividend-math";
import { getTotalCashDividendReceived } from "@/features/dividends/queries";
import { recordDividendSchema } from "@/features/dividends/schemas";
// BondTerms là đặc tả của chính vị thế nên truy vấn sống ở repository của
// feature holdings — xem comment findBondTerms ở đó.
import { findBondTerms } from "@/features/holdings/repository";
import type { BondTermsRow } from "@/features/holdings/repository";
import type { DividendFormState } from "@/features/dividends/types";
import { assertNever } from "@/lib/assert-never";
import { getCurrentPortfolioXirrPercent } from "@/lib/portfolio-valuation";
import {
  buildPositionEvents,
  buildQuantityTimeline,
  PENDING_EVENT_CREATED_AT,
  POSITION_WRITE_TX_OPTIONS,
} from "@/lib/position-trail";
import { revalidateHoldingDependentRoutes } from "@/lib/revalidate-holding-routes";
import { ROUTES } from "@/lib/routes";
import { handleWriteError, parseAuthenticated } from "@/lib/server-action";
import {
  bondInterestTaxKey,
  requireDecimalSetting,
  resolveDecimalSetting,
  resolveSettings,
  SETTING_KEYS,
} from "@/lib/settings";
import { resolvePrice } from "@/lib/valuation";

import {
  findDividendPositionSource,
  findLatestNavOverride,
  findLatestPriceQuote,
  insertDividend,
  runInTransaction,
  updateHoldingQuantity,
  upsertPriceAdjustmentOverride,
} from "./repository";

// Id giữ chỗ cho "sự kiện" ghi cổ tức đang xử lý — KHÔNG phải id thật trong DB
// (Dividend chưa được tạo lúc build timeline). delta=0 vì mục đích chỉ để đọc
// `.before` = số lượng đang giữ TẠI NGÀY GHI (docs/domain/02
// "Vị thế mở ban đầu" — SL "tại thời điểm" khác SL cache hiện tại).
const PROBE_EVENT_ID = "__probe__";

// Issue #61 — đọc giá cũ (NavOverride/PriceQuote) TRONG transaction để tính
// NavOverride bù pha loãng, dùng `tx` (KHÔNG dùng getLatestNavOverrides/
// getLatestPriceQuotes của lib/valuation.ts: 2 hàm đó đọc `db` NGOÀI
// transaction + unstable_cache, không an toàn với race của transaction này —
// vẫn TÁI DÙNG resolvePrice(), hàm thuần không phụ thuộc nguồn đọc). Trả null
// khi không có cả NavOverride lẫn PriceQuote <= date (MISSING_PRICE — không
// điều chỉnh được).
async function resolveOldPriceInTx(
  tx: Prisma.TransactionClient,
  holdingId: string,
  symbol: string,
  date: Date,
): Promise<Decimal | null> {
  const [latestOverride, latestQuote] = await Promise.all([
    findLatestNavOverride(holdingId, date, tx),
    findLatestPriceQuote(symbol, date, tx),
  ]);

  const resolved = resolvePrice(latestOverride, latestQuote);
  return resolved ? resolved.price : null;
}

// Issue #61 — bù pha loãng NAV dùng chung cho nhánh CASH/STOCK: đọc giá cũ
// (resolveOldPriceInTx), tính giá mới bằng `compute` (CASH dùng
// computeCashDividendPriceAdjustment, STOCK dùng computeStockDividendPriceAdjustment
// — riêng theo từng nhánh, truyền vào thay vì hardcode ở đây), rồi ghi/ghi đè
// NavOverride tại `date`. Trả undefined khi không có giá cũ (MISSING_PRICE)
// hoặc `compute` trả null (không điều chỉnh được) — caller coi undefined =
// "không điều chỉnh". Cờ `priceAlreadyReflectsMarket` (có gọi hàm này hay
// không) vẫn quyết định ở nhánh nghiệp vụ gọi hàm này, KHÔNG nằm trong đây.
async function applyPriceAdjustment(
  tx: Prisma.TransactionClient,
  args: {
    holdingId: string;
    symbol: string;
    date: Date;
    note: string;
    compute: (oldPrice: Decimal) => Decimal | null;
  },
): Promise<PriceAdjustment | undefined> {
  const oldPrice = await resolveOldPriceInTx(
    tx,
    args.holdingId,
    args.symbol,
    args.date,
  );
  if (!oldPrice) return undefined;
  const newPrice = args.compute(oldPrice);
  if (!newPrice) return undefined;
  // Review PR #62 finding #2: ghi kèm `note` khi tự tạo/GHI ĐÈ NavOverride —
  // nếu holdingId+date đã có sẵn 1 dòng (vd user tự nhập tay đúng ngày này,
  // hoặc 1 dividend khác cùng ngày đã điều chỉnh trước đó), note giải thích
  // RÕ vì sao giá bị thay, không âm thầm mất dấu vết audit.
  await upsertPriceAdjustmentOverride(
    {
      holdingId: args.holdingId,
      date: args.date,
      price: newPrice.toString(),
      note: args.note,
    },
    tx,
  );
  return { oldPrice, newPrice };
}

type RecordCashDividendCtx = {
  holdingId: string;
  symbol: string;
  unit: string;
  date: Date;
  paymentDate: Date | null;
  percentDecimal: Decimal;
  parValue: Decimal;
  taxRatePercent: Decimal;
  quantityAtDate: Decimal;
  priceAlreadyReflectsMarket: boolean;
};

type CashDividendResult = {
  ok: true;
  type: "CASH";
  symbol: string;
  unit: string;
  grossAmount: Decimal;
  taxAmount: Decimal;
  netAmount: Decimal;
  priceAdjustment?: PriceAdjustment;
};

async function recordCashDividend(
  tx: Prisma.TransactionClient,
  ctx: RecordCashDividendCtx,
): Promise<CashDividendResult> {
  const { grossAmount, taxAmount, netAmount } = computeCashDividend({
    percent: ctx.percentDecimal,
    parValue: ctx.parValue,
    taxRatePercent: ctx.taxRatePercent,
    quantity: ctx.quantityAtDate,
  });

  // Issue #61: bù pha loãng — trừ cổ tức GỘP/CP khỏi giá cũ, ghi tại `date`
  // (ngày chia), KHÔNG phải paymentDate. Bỏ qua khi user đã xác nhận giá hiện
  // có đã phản ánh đúng thị trường (priceAlreadyReflectsMarket) hoặc không có
  // giá cũ nào để điều chỉnh (MISSING_PRICE) — applyPriceAdjustment tự xử lý
  // ca sau, chỉ ca trước cần check ở đây.
  const priceAdjustment = ctx.priceAlreadyReflectsMarket
    ? undefined
    : await applyPriceAdjustment(tx, {
        holdingId: ctx.holdingId,
        symbol: ctx.symbol,
        date: ctx.date,
        note: buildPriceAdjustmentNote("CASH", ctx.date),
        compute: (oldPrice) =>
          computeCashDividendPriceAdjustment({
            oldPrice,
            grossAmount,
            quantityAtDate: ctx.quantityAtDate,
          }),
      });

  await insertDividend(
    {
      holdingId: ctx.holdingId,
      type: "CASH",
      date: ctx.date,
      // Với CASH: mốc dòng tiền dùng để tính XIRR (fallback `date` khi bỏ
      // trống) — xem buildXirrCashflows (src/lib/xirr-cashflow.ts) và
      // docs/domain/05-returns-xirr-and-pnl.md. KHÔNG ảnh hưởng NavOverride
      // bù pha loãng phía trên — mốc đó vẫn luôn `date`.
      paymentDate: ctx.paymentDate,
      grossAmount: grossAmount.toString(),
      taxAmount: taxAmount.toString(),
      netAmount: netAmount.toString(),
    },
    tx,
  );

  return {
    ok: true,
    type: "CASH",
    symbol: ctx.symbol,
    unit: ctx.unit,
    grossAmount,
    priceAdjustment,
    taxAmount,
    netAmount,
  };
}

type RecordStockDividendCtx = {
  holdingId: string;
  symbol: string;
  unit: string;
  date: Date;
  paymentDate: Date | null;
  percentDecimal: Decimal;
  quantityAtDate: Decimal;
  holdingQuantity: Decimal;
  stockQuantityOverride: string | undefined;
  priceAlreadyReflectsMarket: boolean;
};

type StockDividendResult =
  | {
      ok: false;
      error: string;
      fieldErrors: Record<string, string>;
    }
  | {
      ok: true;
      type: "STOCK";
      symbol: string;
      unit: string;
      addedQuantity: Decimal;
      afterQuantity: Decimal;
      wasRounded: boolean;
      rawStockQuantity: Decimal;
      priceAdjustment?: PriceAdjustment;
    };

async function recordStockDividend(
  tx: Prisma.TransactionClient,
  ctx: RecordStockDividendCtx,
): Promise<StockDividendResult> {
  const { rawStockQuantity, stockQuantity, wasRounded } = computeStockDividend({
    percent: ctx.percentDecimal,
    quantity: ctx.quantityAtDate,
  });

  // stockQuantityOverride chỉ có ý nghĩa khi type === "STOCK". Validate
  // tolerance phải nằm TRONG transaction, SAU khi có rawStockQuantity —
  // rawStockQuantity phụ thuộc quantityAtDate, chỉ tính được sau khi đọc
  // Holding.cashflows/dividends từ `tx` (không tách ra ngoài như
  // parValue/taxRatePercent của CASH, vốn không phụ thuộc Holding).
  let finalStockQuantity = stockQuantity;
  if (ctx.stockQuantityOverride !== undefined) {
    const override = new Decimal(ctx.stockQuantityOverride);
    if (!isStockQuantityOverrideValid(override, rawStockQuantity)) {
      return {
        ok: false,
        error: "Số lượng chỉnh tay lệch quá nhiều so với số tính từ tỷ lệ",
        fieldErrors: {
          stockQuantityOverride:
            "Số lượng chỉnh tay lệch quá nhiều so với số tính từ tỷ lệ",
        },
      };
    }
    finalStockQuantity = override;
  }

  // Issue #61: bù pha loãng — SL "tại ngày ghi" (quantityAtDate) TRƯỚC
  // dividend này, SAU khi cộng thêm finalStockQuantity, giữ nguyên tổng giá
  // trị. Dùng quantityAtDate (không phải cache Holding.quantity/afterQuantity
  // bên dưới — có thể lệch nhau khi ghi lùi ngày, trong khi NavOverride phải
  // phản ánh đúng pha loãng TẠI `date`). Ghi tại `date` (ngày chia), KHÔNG
  // phải paymentDate — cùng lý do nhánh CASH.
  const priceAdjustment = ctx.priceAlreadyReflectsMarket
    ? undefined
    : await applyPriceAdjustment(tx, {
        holdingId: ctx.holdingId,
        symbol: ctx.symbol,
        date: ctx.date,
        note: buildPriceAdjustmentNote("STOCK", ctx.date),
        compute: (oldPrice) =>
          computeStockDividendPriceAdjustment({
            oldPrice,
            quantityBefore: ctx.quantityAtDate,
            quantityAfter: ctx.quantityAtDate.plus(finalStockQuantity),
          }),
      });

  await insertDividend(
    {
      holdingId: ctx.holdingId,
      type: "STOCK",
      date: ctx.date,
      // Với STOCK: thuần thông tin, KHÔNG dùng cho tính toán nào —
      // buildXirrCashflows chỉ ghép cổ tức CASH (có netAmount) vào chuỗi dòng
      // tiền XIRR, STOCK không tạo dòng tiền (chỉ cộng thêm stockQuantity)
      // nên paymentDate không góp vào XIRR ở đây.
      paymentDate: ctx.paymentDate,
      stockQuantity: finalStockQuantity.toString(),
    },
    tx,
  );

  // Cộng THẲNG vào cache hiện có (Holding.quantity), KHÔNG gọi lại
  // derivePosition()/buildQuantityTimeline để tính lại từ đầu — avgCost giữ
  // nguyên, không sửa (docs/domain/01-assets-and-holdings.md).
  const afterQuantity = ctx.holdingQuantity.plus(finalStockQuantity);
  await updateHoldingQuantity(ctx.holdingId, afterQuantity.toString(), tx);

  return {
    ok: true,
    type: "STOCK",
    symbol: ctx.symbol,
    unit: ctx.unit,
    addedQuantity: finalStockQuantity,
    afterQuantity,
    // true CHỈ khi hệ thống tự làm tròn xuống — không phải khi user tự sửa
    // qua stockQuantityOverride (override => coi như user đã chốt đúng giá
    // trị, không cần cảnh báo làm tròn).
    wasRounded: wasRounded && ctx.stockQuantityOverride === undefined,
    rawStockQuantity,
    priceAdjustment,
  };
}

type RecordBondCouponCtx = {
  holdingId: string;
  symbol: string;
  unit: string;
  date: Date;
  paymentDate: Date | null;
  terms: BondTermsRow;
  couponRatePercent: Decimal;
  couponFrequencyMonths: number;
  taxRatePercent: Decimal;
  taxAmountOverride: string | undefined;
  quantityAtDate: Decimal;
};

type BondCouponResult = {
  ok: true;
  type: "BOND_COUPON";
  symbol: string;
  unit: string;
  grossAmount: Decimal;
  taxAmount: Decimal;
  netAmount: Decimal;
  couponRatePercentApplied: Decimal;
  couponFrequencyMonths: number;
};

// Ghi trái tức (Phase 7, issue #58). KHÁC recordCashDividend/recordStockDividend
// ở đúng một điểm dễ sai nhất: **KHÔNG gọi applyPriceAdjustment()**.
//
// Vì sao phải nói tường minh (docs/domain/03-dividends.md khối cảnh báo đầu mục
// "Bù pha loãng NAV"): với cổ phiếu, tiền cổ tức RỜI KHỎI vốn công ty nên thị
// giá điều chỉnh giảm. Với trái phiếu, coupon là NGHĨA VỤ TRẢ LÃI theo hợp
// đồng, không rút vốn khỏi tổ chức phát hành — clean price (giá yết, thứ
// NavOverride/PriceQuote đang lưu) KHÔNG giảm theo coupon. Cho nhánh này đi qua
// bước bù pha loãng dùng chung sẽ tạo một NavOverride kéo giá trái phiếu tụt
// SAI, và tụt TÍCH LUỸ qua từng kỳ — NAV danh mục sai dần âm thầm, không có
// tín hiệu lỗi nào. recordDividend là hàm dùng chung nên đây là bẫy MẶC ĐỊNH.
//
// Cũng KHÔNG ghi ngược gì vào BondTerms: "kỳ trả lãi tới" luôn suy runtime
// (lib/bond-schedule.ts::computeNextCouponDate), xem docs/domain/10-cashflow-calendar.md.
async function recordBondCouponDividend(
  tx: Prisma.TransactionClient,
  ctx: RecordBondCouponCtx,
): Promise<BondCouponResult | { ok: false; error: string }> {
  const computed = computeBondCoupon({
    parValue: ctx.terms.parValue,
    couponRatePercent: ctx.couponRatePercent,
    couponFrequencyMonths: ctx.couponFrequencyMonths,
    taxRatePercent: ctx.taxRatePercent,
    quantity: ctx.quantityAtDate,
  });

  // Thuế chỉ PREFILL, user sửa tay được để khớp số tổ chức phát hành thực khấu
  // trừ (docs/domain/07-tax.md). netAmount phải tính lại theo thuế HIỆU LỰC,
  // không dùng netAmount tính từ thuế tự động.
  //
  // `taxAmountOverride` CHỈ có mặt khi user thật sự gõ tay: card thuế ở
  // BondCouponFields đặt `submitWhenAuto={false}` nên số tự tính của client
  // (theo SL hiện tại) không bao giờ lấn át `computed.taxAmount` (theo
  // `quantityAtDate`) — xem review PR #102.
  const taxAmount =
    ctx.taxAmountOverride !== undefined
      ? new Decimal(ctx.taxAmountOverride)
      : computed.taxAmount;

  // Chặn thuế > gộp: `netAmount` là dòng tiền DƯƠNG đưa vào XIRR (cùng nhóm
  // với CASH, xem CASH_FLOW_DIVIDEND_TYPES), một giá trị âm ở đây sẽ trôi vào
  // XIRR/tổng đã nhận như thể trái tức làm MẤT tiền. Đây là lỗi lường trước
  // (ActionResult) — gõ nhầm số trên form là chuyện thường, không phải sự cố.
  if (taxAmount.gt(computed.grossAmount)) {
    return {
      ok: false,
      error: "Thuế không thể lớn hơn tiền lãi gộp của kỳ này",
    };
  }

  const netAmount = computed.grossAmount.minus(taxAmount);

  await insertDividend(
    {
      holdingId: ctx.holdingId,
      type: "BOND_COUPON",
      date: ctx.date,
      // Như CASH: mốc dòng tiền XIRR là paymentDate khi có (tiền lãi thực về
      // tay), fallback `date` — xem buildXirrCashflows (lib/xirr-cashflow.ts).
      paymentDate: ctx.paymentDate,
      grossAmount: computed.grossAmount.toString(),
      taxAmount: taxAmount.toString(),
      netAmount: netAmount.toString(),
      // Đóng băng TOÀN BỘ 3 thông số đã dùng để tính — xem comment insertDividend
      // (repository.ts). Kỳ trả lãi phải nằm trong nhóm này chứ không suy ngược
      // từ grossAmount: phép đảo cần SL-tại-ngày-ghi, mà SL đó tính lại từ lịch
      // sử giao dịch mỗi lần đọc (xem DECISION.md 2026-07-28 (3)).
      parValueApplied: ctx.terms.parValue.toString(),
      couponRatePercentApplied: ctx.couponRatePercent.toString(),
      couponFrequencyMonthsApplied: ctx.couponFrequencyMonths,
    },
    tx,
  );

  return {
    ok: true,
    type: "BOND_COUPON",
    symbol: ctx.symbol,
    unit: ctx.unit,
    grossAmount: computed.grossAmount,
    taxAmount,
    netAmount,
    couponRatePercentApplied: ctx.couponRatePercent,
    couponFrequencyMonths: ctx.couponFrequencyMonths,
  };
}

// Resolve Setting NGOÀI transaction (cùng pattern inviteMember,
// features/members/actions.ts) — Setting đọc thuần từ bảng riêng, không phụ
// thuộc Holding/Cashflow đang ghi, không cần nằm trong phạm vi Serializable.
// Chỉ CASH cần mệnh giá/thuế suất — STOCK/BOND_COUPON trả undefined cả hai
// (BOND_COUPON resolve thuế riêng theo issuerType, xem resolveBondCouponContext).
async function resolveCashDividendSettings(
  type: DividendType,
  date: Date,
): Promise<{
  parValue: Decimal | undefined;
  taxRatePercent: Decimal | undefined;
}> {
  if (type !== "CASH")
    return { parValue: undefined, taxRatePercent: undefined };
  const settings = await resolveSettings(
    [SETTING_KEYS.DIVIDEND_PAR_VALUE, SETTING_KEYS.DIVIDEND_TAX_RATE],
    date,
  );
  return {
    parValue: requireDecimalSetting(settings, SETTING_KEYS.DIVIDEND_PAR_VALUE),
    taxRatePercent: requireDecimalSetting(
      settings,
      SETTING_KEYS.DIVIDEND_TAX_RATE,
    ),
  };
}

type BondCouponContext = {
  terms: BondTermsRow;
  couponRatePercent: Decimal;
  couponFrequencyMonths: number;
  taxRatePercent: Decimal;
};

// Điều khoản + thuế suất cần để ghi trái tức, đọc NGOÀI transaction (cùng lý do
// resolveCashDividendSettings: BondTerms là dữ liệu hợp đồng tĩnh, không phải
// trạng thái suy ra từ Cashflow/Dividend đang ghi).
//
// Trả lỗi LƯỜNG TRƯỚC (ActionResult) chứ không throw khi thiếu điều khoản:
// "ghi trái tức cho Holding chưa có BondTerms -> chặn với thông báo rõ, không
// tự đoán mệnh giá" (docs/domain/03-dividends.md "Ca biên"). Khác nguyên tắc
// "thiếu field optional là bình thường" của lịch dòng tiền — ở đó thiếu field
// chỉ làm holding không xuất hiện, còn ở đây thiếu field thì KHÔNG TÍNH ĐƯỢC
// số tiền.
async function resolveBondCouponContext(
  holdingId: string,
  userId: string,
  date: Date,
): Promise<
  { ok: true; data: BondCouponContext } | { ok: false; error: string }
> {
  const terms = await findBondTerms(holdingId, userId);
  if (!terms) {
    return {
      ok: false,
      error:
        "Chưa có điều khoản trái phiếu cho vị thế này — nhập mệnh giá và lãi suất trước khi ghi trái tức.",
    };
  }
  if (!terms.couponRatePercent || !terms.couponFrequencyMonths) {
    return {
      ok: false,
      error:
        "Điều khoản trái phiếu thiếu lãi suất coupon hoặc kỳ trả lãi — không tính được số tiền trái tức.",
    };
  }

  const taxRatePercent = await resolveDecimalSetting(
    bondInterestTaxKey(terms.issuerType),
    date,
  );

  return {
    ok: true,
    data: {
      terms,
      couponRatePercent: terms.couponRatePercent,
      couponFrequencyMonths: terms.couponFrequencyMonths,
      taxRatePercent,
    },
  };
}

type RecordDividendTxCtxBase = {
  holdingId: string;
  userId: string;
  date: Date;
  paymentDate: Date | null;
  percentDecimal: Decimal;
  parValue: Decimal | undefined;
  taxRatePercent: Decimal | undefined;
  stockQuantityOverride: string | undefined;
  priceAlreadyReflectsMarket: boolean;
};

// Union theo `type` chứ KHÔNG phải object phẳng với `bond?: BondCouponContext`:
// bất biến "BOND_COUPON thì luôn có `bond`" (resolve NGOÀI transaction ở
// recordDividend) khi đó do compiler giữ, không phải do một comment + 4 dấu `!`
// ở call site. Cùng lý do union `RecordedDividend` cố ý không có
// `priceAdjustment` ở nhánh BOND_COUPON: quên set là lỗi COMPILE, không phải
// TypeError lúc chạy (review PR #102, docs/rules/typescript-style.md).
type RecordDividendTxCtx = RecordDividendTxCtxBase &
  (
    | { type: "CASH" | "STOCK"; bond?: never; taxAmountOverride?: never }
    | {
        type: "BOND_COUPON";
        bond: BondCouponContext;
        taxAmountOverride: string | undefined;
      }
  );

// Dựng `RecordDividendTxCtx` đúng nhánh union theo `type`, và resolve luôn
// điều khoản trái phiếu cho nhánh BOND_COUPON.
//
// Tách ra khỏi recordDividend chỉ vì MỘT lý do kiểu: `switch` ở đây thu hẹp
// `type` về đúng literal trong từng case, nên mỗi nhánh union được dựng mà
// không cần `as`/`!` nào. Viết inline bằng if/ternary trong recordDividend thì
// TypeScript không giữ được liên hệ "type === BOND_COUPON <=> bond khác
// undefined" qua một biến `let` — và đó chính là chỗ 4 dấu `!` cũ đã nấp.
async function buildRecordDividendTxCtx(input: {
  type: DividendType;
  userId: string;
  taxAmountOverride: string | undefined;
  base: RecordDividendTxCtxBase;
}): Promise<
  { ok: true; data: RecordDividendTxCtx } | { ok: false; error: string }
> {
  const { type, base } = input;
  switch (type) {
    case "CASH":
    case "STOCK":
      return { ok: true, data: { ...base, type } };
    case "BOND_COUPON": {
      const bondCtx = await resolveBondCouponContext(
        base.holdingId,
        input.userId,
        base.date,
      );
      if (!bondCtx.ok) return bondCtx;
      return {
        ok: true,
        data: {
          ...base,
          type,
          bond: bondCtx.data,
          taxAmountOverride: input.taxAmountOverride,
        },
      };
    }
    default:
      return assertNever(type);
  }
}

// Thân transaction của recordDividend (dòng tiền + ghi Dividend, atomic với
// đọc lịch sử vị thế — xem comment isolationLevel ở nơi gọi runInTransaction)
// — tách riêng khỏi recordDividend để hàm đó không lồng quá sâu (try -> callback
// -> switch).
async function runRecordDividendTransaction(
  tx: Prisma.TransactionClient,
  ctx: RecordDividendTxCtx,
) {
  const holding = await findDividendPositionSource(
    ctx.holdingId,
    ctx.userId,
    tx,
  );
  // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau, không lộ
  // thông tin tồn tại (cùng pattern addTransaction).
  if (!holding) {
    return { ok: false as const, error: "Không tìm thấy vị thế" };
  }

  const events = buildPositionEvents({
    cashflows: holding.cashflows,
    dividends: holding.dividends,
    markers: [
      {
        id: PROBE_EVENT_ID,
        date: ctx.date,
        createdAt: PENDING_EVENT_CREATED_AT,
      },
    ],
  });
  const timeline = buildQuantityTimeline(events);
  // PROBE_EVENT_ID luôn có mặt trong events -> luôn có entry trong timeline.
  const quantityAtDate = timeline.get(PROBE_EVENT_ID)!.before;

  switch (ctx.type) {
    case "CASH":
      // parValue/taxRatePercent đã resolve ở ngoài, luôn có giá trị khi type === "CASH".
      return recordCashDividend(tx, {
        holdingId: ctx.holdingId,
        symbol: holding.symbol,
        unit: holding.unit,
        date: ctx.date,
        paymentDate: ctx.paymentDate,
        percentDecimal: ctx.percentDecimal,
        parValue: ctx.parValue!,
        taxRatePercent: ctx.taxRatePercent!,
        quantityAtDate,
        priceAlreadyReflectsMarket: ctx.priceAlreadyReflectsMarket,
      });
    case "STOCK":
      return recordStockDividend(tx, {
        holdingId: ctx.holdingId,
        symbol: holding.symbol,
        unit: holding.unit,
        date: ctx.date,
        paymentDate: ctx.paymentDate,
        percentDecimal: ctx.percentDecimal,
        quantityAtDate,
        holdingQuantity: holding.quantity,
        stockQuantityOverride: ctx.stockQuantityOverride,
        priceAlreadyReflectsMarket: ctx.priceAlreadyReflectsMarket,
      });
    case "BOND_COUPON":
      // `ctx.bond` non-nullable ở nhánh này nhờ union RecordDividendTxCtx —
      // compiler tự thu hẹp, không cần `!` cũng không cần comment trấn an.
      return recordBondCouponDividend(tx, {
        holdingId: ctx.holdingId,
        symbol: holding.symbol,
        unit: holding.unit,
        date: ctx.date,
        paymentDate: ctx.paymentDate,
        terms: ctx.bond.terms,
        couponRatePercent: ctx.bond.couponRatePercent,
        couponFrequencyMonths: ctx.bond.couponFrequencyMonths,
        taxRatePercent: ctx.bond.taxRatePercent,
        taxAmountOverride: ctx.taxAmountOverride,
        // SL đang giữ TẠI NGÀY TRẢ LÃI — quy ước thứ tự (lib/position-trail.ts)
        // đảm bảo con số này đọc TRƯỚC Cashflow{MATURITY} cùng ngày, nên trái
        // tức kỳ cuối không ra 0 đồng khi user đã ghi tất toán trước.
        quantityAtDate,
      });
    default:
      // `ctx` (không phải `ctx.type`) — switch trên union RecordDividendTxCtx
      // vắt cạn CẢ object, nên chính `ctx` mới là `never` ở đây.
      return assertNever(ctx);
  }
}

// Chữ ký khớp useActionState ((prevState, formData) => Promise<State>) — cùng
// pattern saveNavOverride (features/holdings/actions.ts), KHÔNG theo
// ActionResult<T> (DividendForm.action yêu cầu đúng shape DividendFormState).
export async function recordDividend(
  _prevState: DividendFormState,
  formData: FormData,
): Promise<DividendFormState> {
  const ctx = await parseAuthenticated(recordDividendSchema, {
    holdingId: formData.get("holdingId"),
    type: formData.get("type"),
    date: formData.get("date"),
    // formData.get() trả null khi field không có mặt trong form (BOND_COUPON
    // không render input percent) -> coerce về undefined để khớp .optional()
    // của zod (optional chỉ chấp nhận undefined, không chấp nhận null).
    percent: formData.get("percent") || undefined,
    // Cùng lý do percent — field không có mặt trong form (CASH, hoặc STOCK
    // không override) -> coerce null về undefined để khớp .optional() của zod.
    stockQuantityOverride: formData.get("stockQuantityOverride") || undefined,
    // Cùng lý do stockQuantityOverride — coerce null (field không có mặt
    // trong form, vd UI chưa nhập) về undefined để khớp .optional() của zod.
    paymentDate: formData.get("paymentDate") || undefined,
    priceAlreadyReflectsMarket:
      formData.get("priceAlreadyReflectsMarket") || undefined,
    // Chỉ BOND_COUPON gửi field này (AutoFilledAmountCard "Thuế lãi trái
    // phiếu") — schema từ chối nếu loại khác gửi lên.
    taxAmount: formData.get("taxAmount") || undefined,
  });
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const { holdingId, type, date, percent } = ctx.data;

  // `percent` là `string | undefined` ở tầng field (BOND_COUPON không có ô %)
  // và chỉ bắt buộc lại qua `.refine()` theo `type` — mà refine của zod KHÔNG
  // thu hẹp kiểu suy ra được. Guard thật ở đây để `percent!` phía dưới dựa vào
  // một kiểm tra runtime đã chạy, thay vì chỉ dựa vào một refine ở file khác.
  // Đưa hẳn về union theo `type` như RecordDividendTxCtx là cách duy nhất bỏ
  // được `!` — nhưng phải đổi recordDividendSchema sang discriminatedUnion,
  // ngoài phạm vi lần sửa này (ghi lại ở process/DECISION.md).
  if (type !== "BOND_COUPON" && percent === undefined) {
    return { ok: false, error: "Nhập tỷ lệ cổ tức" };
  }

  // BOND_COUPON không có % — Decimal(0) chỉ để giữ kiểu, nhánh đó không đọc tới
  // giá trị này (mệnh giá/lãi suất đọc từ BondTerms).
  const percentDecimal = new Decimal(percent ?? 0);
  const { parValue, taxRatePercent } = await resolveCashDividendSettings(
    type,
    date,
  );

  // Điều khoản trái phiếu resolve NGOÀI transaction, TRƯỚC khi đọc XIRR —
  // thiếu điều khoản là lỗi lường trước, chặn ngay chứ không làm thêm việc.
  const txCtxResult = await buildRecordDividendTxCtx({
    type,
    userId,
    taxAmountOverride: ctx.data.taxAmount,
    base: {
      holdingId,
      userId,
      date,
      paymentDate: ctx.data.paymentDate ?? null,
      percentDecimal,
      parValue,
      taxRatePercent,
      stockQuantityOverride: ctx.data.stockQuantityOverride,
      priceAlreadyReflectsMarket: ctx.data.priceAlreadyReflectsMarket,
    },
  });
  if (!txCtxResult.ok) return txCtxResult;
  const txCtx = txCtxResult.data;

  // XIRR danh mục TRƯỚC khi ghi — đọc NGOÀI transaction (cùng lý do parValue/
  // taxRatePercent ở trên: chỉ cần chính xác tại thời điểm ngay trước/sau ghi,
  // không cần atomic tuyệt đối với race hiếm gặp). getCurrentPortfolioXirrPercent
  // đọc Holding trực tiếp từ DB (không cache() theo request) nên gọi lại lần
  // nữa SAU transaction (dưới) vẫn phản ánh đúng thay đổi vừa ghi.
  const xirrBeforePercent = await getCurrentPortfolioXirrPercent(userId);

  try {
    const result = await runInTransaction(
      (tx) => runRecordDividendTransaction(tx, txCtx),
      POSITION_WRITE_TX_OPTIONS,
    );

    if (!result.ok) return result;

    revalidateHoldingDependentRoutes(holdingId);
    revalidatePath(ROUTES.dividendHistory(holdingId));

    // XIRR danh mục SAU khi ghi + tổng cổ tức tiền mặt đã nhận của riêng
    // holding này — cả hai đọc TƯƠI từ DB (không qua cache() theo request) nên
    // phản ánh đúng Dividend/Holding.quantity vừa commit ở transaction trên.
    const [xirrAfterPercent, totalDividendReceived] = await Promise.all([
      getCurrentPortfolioXirrPercent(userId),
      getTotalCashDividendReceived(holdingId, userId),
    ]);

    // Phần chung của mọi loại; phần riêng (`percent` cho CASH/STOCK) ghép ở
    // từng nhánh — RecordedDividend là union, spread một `percent` không tồn
    // tại vào nhánh BOND_COUPON là lỗi kiểu, không phải chi tiết vô hại.
    const shared = {
      date,
      paymentDate: ctx.data.paymentDate ?? null,
      xirrBeforePercent,
      xirrAfterPercent,
      totalDividendReceived,
      holdingId,
    };

    return buildDividendFormState(
      result.type === "BOND_COUPON"
        ? { ...result, ...shared }
        : // Guard ở đầu hàm đã loại ca `undefined` cho CASH/STOCK bằng một
          // kiểm tra runtime thật — `!` ở đây chỉ nói lại điều đó cho compiler.
          { ...result, ...shared, percent: percent! },
    );
  } catch (err) {
    return handleWriteError(err, { action: "recordDividend", holdingId });
  }
}
