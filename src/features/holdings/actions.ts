"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";

// Trigger tự động chốt Snapshot{period: MANUAL} sau mỗi giao dịch (docs/domain/06-snapshots.md
// "Khi nào lưu snapshot") — snapshots feature không phụ thuộc ngược vào holdings/actions.ts
// (chỉ holdings/queries.ts, xem features/snapshots/actions.ts) nên import chiều này không tạo vòng.
import { freezeManualSnapshot } from "@/features/snapshots/actions";
import type { ActionResult } from "@/lib/action-result";
import { derivePosition } from "@/lib/cost-basis";
import { computeCashflowAmount } from "@/lib/cost-basis";
import type { CashflowInputWithEvent } from "@/lib/cost-basis";
import { logger } from "@/lib/logger";
import { computeMaturitySettlement } from "@/lib/maturity-settlement";
import {
  PENDING_EVENT_CREATED_AT,
  POSITION_WRITE_TX_OPTIONS,
} from "@/lib/position-trail";
import { revalidateHoldingDependentRoutes } from "@/lib/revalidate-holding-routes";
import { ROUTES } from "@/lib/routes";
import { handleWriteError, parseAuthenticated } from "@/lib/server-action";
import { bondInterestTaxKey, resolveDecimalSetting } from "@/lib/settings";

import {
  deleteCashflowRow,
  findBondSettlementSource,
  findPositionSourceByCashflow,
  findPositionSourceById,
  findPositionSourceBySymbol,
  insertCashflow,
  insertHolding,
  isHoldingOwnedByUser,
  persistPosition,
  runInTransaction,
  updateCashflowRow,
  upsertBondTerms,
  upsertNavOverride,
} from "./repository";
import type { BondSettlementSource } from "./repository";
import {
  addTransactionSchema,
  bondTermsSchema,
  deleteTransactionSchema,
  navOverrideSchema,
  newHoldingSchema,
  settleMaturitySchema,
  updateTransactionSchema,
} from "./schemas";
import type { NavOverrideFormState } from "./types";

// Gọi sau MỖI action ghi cashflow (mua/bán/sửa/xoá) — hiệu ứng phụ, KHÔNG làm fail action
// chính nếu freeze lỗi: giao dịch vẫn phải báo thành công cho user, tách lỗi freeze khỏi
// lỗi giao dịch (docs/rules/error-handling.md "cô lập lỗi", cùng triết lý với job Python).
async function triggerManualSnapshot(
  actionName: string,
  holdingId: string,
): Promise<void> {
  const freezeResult = await freezeManualSnapshot();
  if (!freezeResult.ok) {
    logger.warn(
      { error: freezeResult.error, holdingId, action: actionName },
      "freezeManualSnapshot after transaction failed",
    );
  }
}

// Epilogue dùng chung cho 4 action ghi cashflow (mua/bán/sửa/xoá): kích hoạt
// snapshot tự động, revalidate route phụ thuộc holding rồi trả kết quả thành
// công — gộp 3 bước trước đây lặp lại y hệt ở cả 4 nơi (chỉ khác `data` trả
// về).
async function finalizeHoldingWrite<T>(
  actionName: string,
  holdingId: string,
  data: T,
): Promise<ActionResult<T>> {
  await triggerManualSnapshot(actionName, holdingId);
  revalidateHoldingDependentRoutes(holdingId);
  return { ok: true, data };
}

export async function createHolding(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const ctx = await parseAuthenticated(newHoldingSchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const {
    symbol,
    type,
    unit,
    name,
    intent,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = ctx.data;

  try {
    // Nhánh "Vừa mua hôm nay" (NEW_PURCHASE) KHÔNG được gộp im lặng vào vị thế
    // trùng mã như nhánh "Đã có từ trước" (HISTORICAL, xem `existing` bên dưới
    // trong transaction) — một giao dịch mua thật hôm nay ghi nhầm vào vị thế
    // cũ sẽ trộn lẫn giá vốn hai lô mà user không hề chọn thế (issue #142).
    // Check này chạy TRƯỚC khi mở transaction: chỉ là một truy vấn đọc đơn
    // giản để báo lỗi sớm, không phải bất biến derive cần bảo vệ TOCTOU (đọc
    // lại đúng logic gộp ngay trong transaction bên dưới cho nhánh HISTORICAL).
    if (intent === "NEW_PURCHASE") {
      const duplicate = await findPositionSourceBySymbol({
        userId,
        symbol,
        type,
      });
      if (duplicate) {
        return {
          ok: false,
          error: `Bạn đã có vị thế ${symbol} — vui lòng ghi nhận giao dịch mua thêm ở đó thay vì tạo mới`,
          holdingId: duplicate.id,
          existingQuantity: duplicate.quantity.toString(),
          existingUnit: duplicate.unit,
          existingAvgCost: duplicate.avgCost.toString(),
        };
      }
    }

    const result = await runInTransaction(async (tx) => {
      const existing = await findPositionSourceBySymbol(
        { userId, symbol, type },
        tx,
      );

      const candidate: CashflowInputWithEvent = {
        id: "__candidate__",
        type: cashflowType,
        date,
        createdAt: PENDING_EVENT_CREATED_AT,
        quantity: new Decimal(quantity),
        pricePerUnit: new Decimal(pricePerUnit),
        feeAmount: new Decimal(feeAmount),
      };

      const position = derivePosition(
        [...(existing?.cashflows ?? []), candidate],
        existing?.dividends ?? [],
      );
      if (position.wentNegative) {
        return {
          ok: false as const,
          error: "Bán vượt quá số lượng đang giữ",
        };
      }

      const amount = computeCashflowAmount({
        type: cashflowType,
        quantity: candidate.quantity,
        pricePerUnit: candidate.pricePerUnit,
        feeAmount: new Decimal(feeAmount),
        taxAmount: new Decimal(taxAmount),
      });

      // Mua trùng mã đang giữ tự gộp vào Holding đã có, không tạo bản ghi thứ hai
      // (docs/domain/02-transactions-and-cost-basis.md).
      const holdingId =
        existing?.id ??
        (await insertHolding({ userId, symbol, type, unit, name }, tx)).id;

      const cashflow = await insertCashflow(
        {
          holdingId,
          type: cashflowType,
          date,
          quantity,
          pricePerUnit,
          amount: amount.toString(),
          feeAmount,
          taxAmount,
          note,
        },
        tx,
      );

      await persistPosition(holdingId, position, tx);

      return {
        ok: true as const,
        holdingId,
        cashflowId: cashflow.id,
      };
    }, POSITION_WRITE_TX_OPTIONS);

    if (!result.ok) return result;

    return finalizeHoldingWrite("createHolding", result.holdingId, {
      holdingId: result.holdingId,
      cashflowId: result.cashflowId,
    });
  } catch (err) {
    return handleWriteError(err, { action: "createHolding", symbol, type });
  }
}

export async function addTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const ctx = await parseAuthenticated(addTransactionSchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const {
    holdingId,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = ctx.data;

  try {
    const result = await runInTransaction(async (tx) => {
      const source = await findPositionSourceById(holdingId, userId, tx);
      if (!source) {
        return { ok: false as const, error: "Không tìm thấy danh mục" };
      }

      const candidate: CashflowInputWithEvent = {
        id: "__candidate__",
        type: cashflowType,
        date,
        createdAt: PENDING_EVENT_CREATED_AT,
        quantity: new Decimal(quantity),
        pricePerUnit: new Decimal(pricePerUnit),
        feeAmount: new Decimal(feeAmount),
      };

      const position = derivePosition(
        [...source.cashflows, candidate],
        source.dividends,
      );
      if (position.wentNegative) {
        return {
          ok: false as const,
          error: "Bán vượt quá số lượng đang giữ tại thời điểm bán",
        };
      }

      const amount = computeCashflowAmount({
        type: cashflowType,
        quantity: candidate.quantity,
        pricePerUnit: candidate.pricePerUnit,
        feeAmount: new Decimal(feeAmount),
        taxAmount: new Decimal(taxAmount),
      });

      const cashflow = await insertCashflow(
        {
          holdingId,
          type: cashflowType,
          date,
          quantity,
          pricePerUnit,
          amount: amount.toString(),
          feeAmount,
          taxAmount,
          note,
        },
        tx,
      );

      await persistPosition(holdingId, position, tx);

      return { ok: true as const, cashflowId: cashflow.id };
    }, POSITION_WRITE_TX_OPTIONS);

    if (!result.ok) return result;

    return finalizeHoldingWrite("addTransaction", holdingId, {
      holdingId,
      cashflowId: result.cashflowId,
    });
  } catch (err) {
    return handleWriteError(err, { action: "addTransaction", holdingId });
  }
}

export async function updateTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const ctx = await parseAuthenticated(updateTransactionSchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const {
    cashflowId,
    cashflowType,
    date,
    quantity,
    pricePerUnit,
    feeAmount,
    taxAmount,
    note,
  } = ctx.data;

  try {
    const result = await runInTransaction(async (tx) => {
      const source = await findPositionSourceByCashflow(cashflowId, userId, tx);
      if (!source) {
        return { ok: false as const, error: "Không tìm thấy giao dịch" };
      }

      // Không cho ĐỔI loại khi một trong hai đầu là `MATURITY` — cả hai chiều
      // đều nguy hiểm và cả hai đều đi vòng qua luồng tất toán đáo hạn
      // (`settleMaturity`, nơi có kiểm tra `holding.type === "BOND"` +
      // `BondTerms` tồn tại):
      //  - MATURITY -> SELL: nhảy sang thuế 0,1% trên TOÀN BỘ mệnh giá hoàn trả
      //    thay vì thuế lãi trên phần lợi tức (docs/domain/07-tax.md).
      //  - BUY/SELL -> MATURITY: dựng một dòng đáo hạn trên vị thế bất kỳ (kể
      //    cả vàng), rồi được `cashflowEventRank()` xếp cuối ngày và
      //    `computeRealizedGainForHolding()` tính như SELL.
      // `TransactionForm` đã khoá bộ chọn loại ở UI, nhưng
      // `<input type="hidden">` sửa được — đây mới là chỗ chặn thật ("không tin
      // client", CLAUDE.md, cùng lý do `buyHasNoTax` ở schemas.ts).
      //
      // Đổi BUY <-> SELL vẫn cho phép như trước, và ngày/số lượng/giá/phí/thuế
      // của dòng MATURITY cũng sửa bình thường — chỉ riêng LOẠI bị khoá.
      const currentType = source.cashflows.find(
        (cf) => cf.id === cashflowId,
      )?.type;
      if (
        currentType !== cashflowType &&
        (currentType === "MATURITY" || cashflowType === "MATURITY")
      ) {
        return {
          ok: false as const,
          error: "Không thể đổi loại của một giao dịch tất toán đáo hạn",
        };
      }

      const candidate: CashflowInputWithEvent = {
        id: "__candidate__",
        type: cashflowType,
        date,
        createdAt: PENDING_EVENT_CREATED_AT,
        quantity: new Decimal(quantity),
        pricePerUnit: new Decimal(pricePerUnit),
        feeAmount: new Decimal(feeAmount),
      };

      const position = derivePosition(
        [...source.cashflows.filter((cf) => cf.id !== cashflowId), candidate],
        source.dividends,
      );
      if (position.wentNegative) {
        return {
          ok: false as const,
          error:
            "Không thể sửa — số lượng sẽ âm tại một thời điểm trong lịch sử",
        };
      }

      const amount = computeCashflowAmount({
        type: cashflowType,
        quantity: candidate.quantity,
        pricePerUnit: candidate.pricePerUnit,
        feeAmount: new Decimal(feeAmount),
        taxAmount: new Decimal(taxAmount),
      });

      await updateCashflowRow(
        cashflowId,
        {
          type: cashflowType,
          date,
          quantity,
          pricePerUnit,
          amount: amount.toString(),
          feeAmount,
          taxAmount,
          note,
        },
        tx,
      );

      await persistPosition(source.holdingId, position, tx);

      return { ok: true as const, holdingId: source.holdingId };
    }, POSITION_WRITE_TX_OPTIONS);

    if (!result.ok) return result;

    // cashflowId đã có sẵn từ input (ctx.data) — không cần query lại.
    return finalizeHoldingWrite("updateTransaction", result.holdingId, {
      holdingId: result.holdingId,
      cashflowId,
    });
  } catch (err) {
    return handleWriteError(err, { action: "updateTransaction", cashflowId });
  }
}

export async function deleteTransaction(
  input: unknown,
): Promise<ActionResult<{ holdingId: string }>> {
  const ctx = await parseAuthenticated(deleteTransactionSchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const { cashflowId } = ctx.data;

  try {
    const result = await runInTransaction(async (tx) => {
      const source = await findPositionSourceByCashflow(cashflowId, userId, tx);
      if (!source) {
        return { ok: false as const, error: "Không tìm thấy giao dịch" };
      }

      const remaining = source.cashflows.filter((cf) => cf.id !== cashflowId);

      const position = derivePosition(remaining, source.dividends);
      if (position.wentNegative) {
        return {
          ok: false as const,
          error:
            "Không thể xóa — có giao dịch bán sau đó phụ thuộc vào số lượng này",
        };
      }

      await deleteCashflowRow(cashflowId, tx);

      await persistPosition(source.holdingId, position, tx);

      return { ok: true as const, holdingId: source.holdingId };
    }, POSITION_WRITE_TX_OPTIONS);

    if (!result.ok) return result;

    // Xoá vẫn kích hoạt trigger tự động (docs/domain/06-snapshots.md áp dụng cho cả 4
    // action) — chỉ riêng banner UI (TransactionSnapshotBanner) không hiện cho ca xoá
    // (không điều hướng đi đâu, không có cashflowId để gắn vào query string).
    return finalizeHoldingWrite("deleteTransaction", result.holdingId, {
      holdingId: result.holdingId,
    });
  } catch (err) {
    return handleWriteError(err, { action: "deleteTransaction", cashflowId });
  }
}

// Lưu điều khoản trái phiếu (Phase 7, mockup 7a) — nhập một lần trên vị thế,
// `recordDividend` nhánh BOND_COUPON đọc lại từ đây.
//
// KHÔNG ghi trong `$transaction` Serializable như 4 action cashflow: ở đó
// transaction bảo vệ bất biến "đọc-để-derive và ghi phải atomic"
// (docs/rules/data-prisma.md "TOCTOU"); còn ở đây không derive gì cả, chỉ upsert
// một hàng theo khoá duy nhất `holdingId` — atomic sẵn ở tầng DB (cùng lý do
// saveNavOverride bên dưới).
export async function saveBondTerms(
  input: unknown,
): Promise<ActionResult<{ holdingId: string }>> {
  const ctx = await parseAuthenticated(bondTermsSchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const { holdingId, ...terms } = ctx.data;

  const holding = await findBondSettlementSource(holdingId, userId);
  if (!holding) return { ok: false, error: "Không tìm thấy vị thế" };
  // Quan hệ 1-1 của Prisma KHÔNG ràng buộc được `holding.type = BOND` — chặn ở
  // tầng app là cách duy nhất (src/lib/bond-terms.ts, issue #56). Chuyển
  // AppError thành ActionResult ở đây thay vì để throw: user chọn nhầm vị thế
  // là lỗi lường trước, không phải sự cố (docs/rules/error-handling.md).
  if (holding.type !== "BOND") {
    return {
      ok: false,
      error: "Điều khoản trái phiếu chỉ áp dụng cho vị thế loại trái phiếu",
    };
  }

  try {
    await upsertBondTerms(holdingId, {
      issuerType: terms.issuerType,
      parValue: terms.parValue,
      couponRatePercent: terms.couponRatePercent,
      couponFrequencyMonths: terms.couponFrequencyMonths,
      firstCouponDate: terms.firstCouponDate,
      maturityDate: terms.maturityDate,
    });
  } catch (err) {
    return handleWriteError(err, { action: "saveBondTerms", holdingId });
  }

  revalidateHoldingDependentRoutes(holdingId);
  return { ok: true, data: { holdingId } };
}

// Điều khoản + thuế suất cần để ghi tất toán đáo hạn, resolve NGOÀI transaction
// (cùng lý do resolveCashDividendSettings ở dividends/actions.ts).
// Thiếu `BondTerms` -> chặn với thông báo rõ thay vì đoán `issuerType`: không
// biết tổ chức phát hành thì không biết áp 5% hay 0% (docs/domain/07-tax.md).
async function resolveMaturitySettlementContext(
  holdingId: string,
  userId: string,
  date: Date,
): Promise<
  | {
      ok: true;
      source: BondSettlementSource;
      interestTaxRatePercent: Decimal;
    }
  | { ok: false; error: string }
> {
  const source = await findBondSettlementSource(holdingId, userId);
  if (!source) return { ok: false, error: "Không tìm thấy vị thế" };
  if (source.type !== "BOND") {
    return {
      ok: false,
      error: "Chỉ vị thế trái phiếu mới có thể tất toán đáo hạn",
    };
  }
  if (!source.bondTerms) {
    return {
      ok: false,
      error:
        "Chưa có điều khoản trái phiếu cho vị thế này — nhập loại phát hành và mệnh giá trước khi tất toán.",
    };
  }

  // CỐ Ý không resolve `TRANSACTION_FEE_SELL_BOND`: đáo hạn là nhận lại gốc
  // TỪ tổ chức phát hành, không qua lệnh khớp CTCK nên không phát sinh phí
  // giao dịch (docs/domain/07-tax.md). Bản trước prefill từ Setting đó "cho
  // nhất quán", nhưng màn 7e/7f không hiện và không cho sửa ô phí nào — nên
  // một Setting khác 0 sẽ trừ vào `Cashflow.amount` một khoản user không hề
  // thấy, lệch hẳn với dòng "Thực nhận" vừa xác nhận trên form (review PR
  // #102). Muốn ghi phí thật thì `settleMaturitySchema.feeAmount` vẫn nhận —
  // chỉ là không còn số tự điền vô hình.
  const interestTaxRatePercent = await resolveDecimalSetting(
    bondInterestTaxKey(source.bondTerms.issuerType),
    date,
  );

  return { ok: true, source, interestTaxRatePercent };
}

// Tất toán đáo hạn trái phiếu (Phase 7, issue #101) — ghi `Cashflow{type:
// MATURITY}`, KHÔNG phải một dòng SELL. Khác biệt không nằm ở nhãn hiển thị mà
// ở THUẾ: SELL áp `SALE_TAX_BOND` 0,1% trên toàn bộ giá trị chuyển nhượng,
// MATURITY chỉ đánh thuế lãi trên phần lợi tức (xem lib/maturity-settlement.ts).
//
// Mọi con số client gửi lên là giá trị user đã xác nhận trên form "tự điền, sửa
// được"; server vẫn tự tính lại thuế gợi ý và chỉ dùng số client gửi khi user
// thực sự sửa (nguyên tắc "prefill, không khoá" — docs/domain/07-tax.md). Phí
// mặc định 0 và không có số tự điền — đáo hạn không qua lệnh khớp.
export async function settleMaturity(
  input: unknown,
): Promise<ActionResult<{ holdingId: string; cashflowId: string }>> {
  const ctx = await parseAuthenticated(settleMaturitySchema, input);
  if (!ctx.ok) return ctx;
  const { userId } = ctx;

  const { holdingId, date, quantity, pricePerUnit, note } = ctx.data;

  const settlementCtx = await resolveMaturitySettlementContext(
    holdingId,
    userId,
    date,
  );
  if (!settlementCtx.ok) return settlementCtx;

  const quantityDecimal = new Decimal(quantity);
  const pricePerUnitDecimal = new Decimal(pricePerUnit);

  // Thuế gợi ý tính trên avgCost HIỆN TẠI của vị thế — cùng con số form đã hiển
  // thị. User sửa tay thì số của user thắng.
  const computed = computeMaturitySettlement({
    quantity: quantityDecimal,
    pricePerUnit: pricePerUnitDecimal,
    avgCost: settlementCtx.source.avgCost,
    interestTaxRatePercent: settlementCtx.interestTaxRatePercent,
  });
  const taxAmount =
    ctx.data.taxAmount !== undefined
      ? new Decimal(ctx.data.taxAmount)
      : computed.taxAmount;
  // Mặc định 0, KHÔNG suy từ `TRANSACTION_FEE_SELL_BOND` — xem
  // resolveMaturitySettlementContext.
  const feeAmount =
    ctx.data.feeAmount !== undefined
      ? new Decimal(ctx.data.feeAmount)
      : new Decimal(0);

  try {
    const result = await runInTransaction(async (tx) => {
      const source = await findPositionSourceById(holdingId, userId, tx);
      if (!source) {
        return { ok: false as const, error: "Không tìm thấy vị thế" };
      }

      const candidate: CashflowInputWithEvent = {
        id: "__candidate__",
        type: "MATURITY",
        date,
        createdAt: PENDING_EVENT_CREATED_AT,
        quantity: quantityDecimal,
        pricePerUnit: pricePerUnitDecimal,
        feeAmount,
      };

      // derivePosition() tự xếp MATURITY sau mọi sự kiện cùng ngày
      // (cashflowEventRank, lib/position-trail.ts) -> tất toán trùng ngày với
      // trái tức kỳ cuối không bị báo "vượt quá số lượng" oan.
      const position = derivePosition(
        [...source.cashflows, candidate],
        source.dividends,
      );
      if (position.wentNegative) {
        return {
          ok: false as const,
          error: "Tất toán vượt quá số lượng đang giữ tại ngày đáo hạn",
        };
      }

      const amount = computeCashflowAmount({
        type: "MATURITY",
        quantity: candidate.quantity,
        pricePerUnit: candidate.pricePerUnit,
        feeAmount,
        taxAmount,
      });

      const cashflow = await insertCashflow(
        {
          holdingId,
          type: "MATURITY",
          date,
          quantity,
          pricePerUnit,
          amount: amount.toString(),
          feeAmount: feeAmount.toString(),
          taxAmount: taxAmount.toString(),
          note,
        },
        tx,
      );

      await persistPosition(holdingId, position, tx);

      return { ok: true as const, cashflowId: cashflow.id };
    }, POSITION_WRITE_TX_OPTIONS);

    if (!result.ok) return result;

    return finalizeHoldingWrite("settleMaturity", holdingId, {
      holdingId,
      cashflowId: result.cashflowId,
    });
  } catch (err) {
    return handleWriteError(err, { action: "settleMaturity", holdingId });
  }
}

// Chữ ký khớp useActionState ((prevState, formData) => Promise<State>) — truyền
// thẳng làm prop `action` cho NavOverrideForm (Presentational, không tự bridge
// FormData như TransactionForm), giống cách settings/page.tsx truyền onSignOut
// là hàm "use server" trực tiếp. Cho phép nhập tay mọi AssetType (docs/domain/04
// -pricing-and-valuation.md: STOCK/FUND vẫn cho sửa tay khi cần, GOLD/BOND chỉ
// là loại mặc định dùng nhập tay) — không giới hạn cứng theo type ở đây.
export async function saveNavOverride(
  _prevState: NavOverrideFormState,
  formData: FormData,
): Promise<NavOverrideFormState> {
  const ctx = await parseAuthenticated(navOverrideSchema, {
    holdingId: formData.get("holdingId"),
    price: formData.get("price"),
    date: formData.get("date"),
  });
  if (!ctx.ok) return ctx;

  const { holdingId, price, date } = ctx.data;

  if (!(await isHoldingOwnedByUser(holdingId, ctx.userId))) {
    return { ok: false, error: "Không tìm thấy vị thế" };
  }

  try {
    // upsert theo unique (holdingId, date) — atomic ở tầng DB, không cần
    // $transaction/Serializable như các action cashflow: không có bất biến
    // derive (kiểu derivePosition) cần bảo vệ TOCTOU ở đây.
    await upsertNavOverride(holdingId, date, price);
  } catch (err) {
    logger.error({ err, holdingId }, "saveNavOverride failed");
    return { ok: false, error: "Không lưu được giá. Thử lại sau ít phút." };
  }

  revalidateHoldingDependentRoutes(holdingId);
  redirect(ROUTES.holdingDetail(holdingId));
}
