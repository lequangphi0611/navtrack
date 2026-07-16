"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";
import {
  computeCashDividend,
  computeStockDividend,
} from "@/features/dividends/dividend-math";
import { buildQuantityTimeline } from "@/features/dividends/position-trail";
import type { PositionTrailEvent } from "@/features/dividends/position-trail";
import { recordDividendSchema } from "@/features/dividends/schemas";
import type { DividendFormState } from "@/features/dividends/types";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { ROUTES } from "@/lib/routes";
import { resolveDecimalSetting, SETTING_KEYS } from "@/lib/settings";

// Id giữ chỗ cho "sự kiện" ghi cổ tức đang xử lý — KHÔNG phải id thật trong DB
// (Dividend chưa được tạo lúc build timeline). delta=0 vì mục đích chỉ để đọc
// `.before` = số lượng đang giữ TẠI NGÀY GHI (docs/domain/02
// "Vị thế mở ban đầu" — SL "tại thời điểm" khác SL cache hiện tại).
const PROBE_EVENT_ID = "__probe__";

// createdAt xa nhất có thể cho probe — hành động đang xử lý LÀ sự kiện MỚI
// NHẤT trong toàn bộ lịch sử, kể cả khi trùng NGÀY với cashflow/dividend khác
// đã ghi trước đó (tie-break theo createdAt trong buildQuantityTimeline phải
// luôn xếp probe sau cùng trong ngày đó).
const PROBE_CREATED_AT = new Date(8640000000000000);

// Chữ ký khớp useActionState ((prevState, formData) => Promise<State>) — cùng
// pattern saveNavOverride (features/holdings/actions.ts), KHÔNG theo
// ActionResult<T> (DividendForm.action yêu cầu đúng shape DividendFormState).
export async function recordDividend(
  _prevState: DividendFormState,
  formData: FormData,
): Promise<DividendFormState> {
  const parsed = recordDividendSchema.safeParse({
    holdingId: formData.get("holdingId"),
    type: formData.get("type"),
    date: formData.get("date"),
    percent: formData.get("percent"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dữ liệu không hợp lệ",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const { holdingId, type, date, percent } = parsed.data;
  const percentDecimal = new Decimal(percent);

  // Resolve Setting NGOÀI transaction (cùng pattern inviteMember,
  // features/members/actions.ts) — Setting đọc thuần từ bảng riêng, không phụ
  // thuộc Holding/Cashflow đang ghi, không cần nằm trong phạm vi Serializable.
  let parValue: Decimal | undefined;
  let taxRatePercent: Decimal | undefined;
  if (type === "CASH") {
    [parValue, taxRatePercent] = await Promise.all([
      resolveDecimalSetting(SETTING_KEYS.DIVIDEND_PAR_VALUE, date),
      resolveDecimalSetting(SETTING_KEYS.DIVIDEND_TAX_RATE, date),
    ]);
  }

  try {
    const result = await db.$transaction(
      async (tx) => {
        const holding = await tx.holding.findUnique({
          where: { id: holdingId },
          select: {
            userId: true,
            symbol: true,
            unit: true,
            quantity: true,
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
                stockQuantity: true,
                createdAt: true,
              },
            },
          },
        });
        // Không tồn tại hoặc không thuộc user hiện tại: xử lý giống nhau,
        // không lộ thông tin tồn tại (cùng pattern addTransaction).
        if (!holding || holding.userId !== userId) {
          return { ok: false as const, error: "Không tìm thấy vị thế" };
        }

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
          ...holding.dividends
            .filter((dividend) => dividend.type === "STOCK")
            .map((dividend) => ({
              id: dividend.id,
              date: dividend.date,
              createdAt: dividend.createdAt,
              // Đã lọc type === "STOCK" ở trên -> stockQuantity luôn có giá trị.
              delta: new Decimal(dividend.stockQuantity!.toString()),
            })),
          {
            id: PROBE_EVENT_ID,
            date,
            createdAt: PROBE_CREATED_AT,
            delta: new Decimal(0),
          },
        ];

        const timeline = buildQuantityTimeline(events);
        // PROBE_EVENT_ID luôn có mặt trong events -> luôn có entry trong timeline.
        const quantityAtDate = timeline.get(PROBE_EVENT_ID)!.before;

        if (type === "CASH") {
          // parValue/taxRatePercent đã resolve ở ngoài, luôn có giá trị khi type === "CASH".
          const { grossAmount, taxAmount, netAmount } = computeCashDividend({
            percent: percentDecimal,
            parValue: parValue!,
            taxRatePercent: taxRatePercent!,
            quantity: quantityAtDate,
          });

          await tx.dividend.create({
            data: {
              holdingId,
              type: "CASH",
              date,
              grossAmount: grossAmount.toString(),
              taxAmount: taxAmount.toString(),
              netAmount: netAmount.toString(),
            },
          });

          return {
            ok: true as const,
            type: "CASH" as const,
            symbol: holding.symbol,
            unit: holding.unit,
            grossAmount,
            taxAmount,
            netAmount,
          };
        }

        const { stockQuantity } = computeStockDividend({
          percent: percentDecimal,
          quantity: quantityAtDate,
        });

        await tx.dividend.create({
          data: {
            holdingId,
            type: "STOCK",
            date,
            stockQuantity: stockQuantity.toString(),
          },
        });

        // Cộng THẲNG vào cache hiện có (Holding.quantity), KHÔNG gọi lại
        // derivePosition()/buildQuantityTimeline để tính lại từ đầu — avgCost
        // giữ nguyên, không sửa (docs/domain/01-assets-and-holdings.md).
        const currentQuantity = new Decimal(holding.quantity.toString());
        const afterQuantity = currentQuantity.plus(stockQuantity);
        await tx.holding.update({
          where: { id: holdingId },
          data: { quantity: afterQuantity.toString() },
        });

        return {
          ok: true as const,
          type: "STOCK" as const,
          symbol: holding.symbol,
          unit: holding.unit,
          addedQuantity: stockQuantity,
          afterQuantity,
        };
      },
      // Serializable — cùng lý do với addTransaction: đọc lịch sử cashflow/dividend
      // để derive vị thế-tại-ngày-ghi rồi ghi Dividend (+ cập nhật cache khi STOCK)
      // phải atomic với đọc, tránh hai request đồng thời cùng thấy vị thế cũ.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) return result;

    revalidatePath(ROUTES.holdingDetail(holdingId));
    revalidatePath(ROUTES.dividendHistory(holdingId));

    const dateLabel = formatDate(date);

    if (result.type === "CASH") {
      return {
        ok: true,
        result: {
          symbol: result.symbol,
          type: "CASH",
          percentLabel: percent,
          dateLabel,
          grossAmount: result.grossAmount.toString(),
          taxAmount: result.taxAmount.toString(),
          netAmount: result.netAmount.toString(),
          historyHref: ROUTES.dividendHistory(holdingId),
          holdingHref: ROUTES.holdingDetail(holdingId),
        },
      };
    }

    return {
      ok: true,
      result: {
        symbol: result.symbol,
        type: "STOCK",
        percentLabel: percent,
        dateLabel,
        addedQuantity: result.addedQuantity.toString(),
        afterQuantity: result.afterQuantity.toString(),
        unit: result.unit,
        historyHref: ROUTES.dividendHistory(holdingId),
        holdingHref: ROUTES.holdingDetail(holdingId),
      },
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      // Serializable — request thua trong đua tranh gặp serialization conflict,
      // cùng lý do với addTransaction/updateTransaction/deleteTransaction.
      logger.warn({ holdingId }, "recordDividend race, ask to retry");
      return {
        ok: false,
        error: "Có giao dịch khác đang xử lý cùng lúc, vui lòng thử lại",
      };
    }
    logger.error({ err, holdingId }, "recordDividend failed");
    throw err;
  }
}
