"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";
import {
  computeCashDividend,
  computeCashDividendPriceAdjustment,
  computeStockDividend,
  computeStockDividendPriceAdjustment,
  isStockQuantityOverrideValid,
} from "@/features/dividends/dividend-math";
import { getTotalCashDividendReceived } from "@/features/dividends/queries";
import { recordDividendSchema } from "@/features/dividends/schemas";
import type { DividendFormState } from "@/features/dividends/types";
import { toFieldErrors } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { getCurrentPortfolioXirrPercent } from "@/lib/portfolio-valuation";
import { buildQuantityTimeline } from "@/lib/position-trail";
import type { PositionTrailEvent } from "@/lib/position-trail";
import { ROUTES } from "@/lib/routes";
import { resolveDecimalSetting, SETTING_KEYS } from "@/lib/settings";
import { resolvePrice } from "@/lib/valuation";

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

type PriceAdjustment = { oldPrice: Decimal; newPrice: Decimal };

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
    tx.navOverride.findFirst({
      where: { holdingId, date: { lte: date } },
      orderBy: { date: "desc" },
      select: { date: true, price: true },
    }),
    tx.priceQuote.findFirst({
      where: { symbol, date: { lte: date } },
      orderBy: { date: "desc" },
      select: { date: true, price: true },
    }),
  ]);

  const resolved = resolvePrice(
    latestOverride
      ? {
          date: latestOverride.date,
          price: new Decimal(latestOverride.price.toString()),
        }
      : null,
    latestQuote
      ? {
          date: latestQuote.date,
          price: new Decimal(latestQuote.price.toString()),
        }
      : null,
  );
  return resolved ? resolved.price : null;
}

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
    // formData.get() trả null khi field không có mặt trong form (CASH, hoặc
    // STOCK không override) -> coerce về undefined để khớp .optional() của
    // zod (optional chỉ chấp nhận undefined, không chấp nhận null).
    stockQuantityOverride: formData.get("stockQuantityOverride") || undefined,
    // Cùng lý do stockQuantityOverride — coerce null (field không có mặt
    // trong form, vd UI chưa nhập) về undefined để khớp .optional() của zod.
    paymentDate: formData.get("paymentDate") || undefined,
    priceAlreadyReflectsMarket:
      formData.get("priceAlreadyReflectsMarket") || undefined,
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

  // XIRR danh mục TRƯỚC khi ghi — đọc NGOÀI transaction (cùng lý do parValue/
  // taxRatePercent ở trên: chỉ cần chính xác tại thời điểm ngay trước/sau ghi,
  // không cần atomic tuyệt đối với race hiếm gặp). getCurrentPortfolioXirrPercent
  // đọc Holding trực tiếp từ DB (không cache() theo request) nên gọi lại lần
  // nữa SAU transaction (dưới) vẫn phản ánh đúng thay đổi vừa ghi.
  const xirrBeforePercent = await getCurrentPortfolioXirrPercent(userId);

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

          // Issue #61: bù pha loãng — trừ cổ tức GỘP/CP khỏi giá cũ, ghi tại
          // `date` (ngày chia), KHÔNG phải paymentDate. Bỏ qua khi user đã
          // xác nhận giá hiện có đã phản ánh đúng thị trường
          // (priceAlreadyReflectsMarket) hoặc không có giá cũ nào để điều
          // chỉnh (MISSING_PRICE).
          let priceAdjustment: PriceAdjustment | undefined;
          if (!parsed.data.priceAlreadyReflectsMarket) {
            const oldPrice = await resolveOldPriceInTx(
              tx,
              holdingId,
              holding.symbol,
              date,
            );
            if (oldPrice) {
              const newPrice = computeCashDividendPriceAdjustment({
                oldPrice,
                grossAmount,
                quantityAtDate,
              });
              if (newPrice) {
                // Review PR #62 finding #2: ghi kèm `note` khi tự tạo/GHI ĐÈ
                // NavOverride — nếu holdingId+date đã có sẵn 1 dòng (vd user
                // tự nhập tay đúng ngày này, hoặc 1 dividend khác cùng ngày
                // đã điều chỉnh trước đó), note giải thích RÕ vì sao giá bị
                // thay, không âm thầm mất dấu vết audit.
                const noteLabel = `Tự động điều chỉnh do ghi cổ tức tiền mặt ngày ${formatDate(date)}`;
                await tx.navOverride.upsert({
                  where: { holdingId_date: { holdingId, date } },
                  create: {
                    holdingId,
                    date,
                    price: newPrice.toString(),
                    note: noteLabel,
                  },
                  update: { price: newPrice.toString(), note: noteLabel },
                });
                priceAdjustment = { oldPrice, newPrice };
              }
            }
          }

          await tx.dividend.create({
            data: {
              holdingId,
              type: "CASH",
              date,
              // Với CASH: mốc dòng tiền dùng để tính XIRR (fallback `date`
              // khi bỏ trống) — xem buildXirrCashflows (src/lib/xirr-cashflow.ts)
              // và docs/domain/05-returns-xirr-and-pnl.md. KHÔNG ảnh hưởng
              // NavOverride bù pha loãng phía trên — mốc đó vẫn luôn `date`.
              paymentDate: parsed.data.paymentDate ?? null,
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
            priceAdjustment,
            taxAmount,
            netAmount,
          };
        }

        const { rawStockQuantity, stockQuantity, wasRounded } =
          computeStockDividend({
            percent: percentDecimal,
            quantity: quantityAtDate,
          });

        // stockQuantityOverride chỉ có ý nghĩa khi type === "STOCK". Validate
        // tolerance phải nằm TRONG transaction, SAU khi có rawStockQuantity —
        // rawStockQuantity phụ thuộc quantityAtDate, chỉ tính được sau khi đọc
        // Holding.cashflows/dividends từ `tx` (không tách ra ngoài như
        // parValue/taxRatePercent của CASH, vốn không phụ thuộc Holding).
        let finalStockQuantity = stockQuantity;
        if (parsed.data.stockQuantityOverride !== undefined) {
          const override = new Decimal(parsed.data.stockQuantityOverride);
          if (!isStockQuantityOverrideValid(override, rawStockQuantity)) {
            return {
              ok: false as const,
              error:
                "Số lượng chỉnh tay lệch quá nhiều so với số tính từ tỷ lệ",
              fieldErrors: {
                stockQuantityOverride:
                  "Số lượng chỉnh tay lệch quá nhiều so với số tính từ tỷ lệ",
              },
            };
          }
          finalStockQuantity = override;
        }

        // Issue #61: bù pha loãng — SL "tại ngày ghi" (quantityAtDate) TRƯỚC
        // dividend này, SAU khi cộng thêm finalStockQuantity, giữ nguyên tổng
        // giá trị. Dùng quantityAtDate (không phải cache Holding.quantity/
        // afterQuantity bên dưới — có thể lệch nhau khi ghi lùi ngày, trong
        // khi NavOverride phải phản ánh đúng pha loãng TẠI `date`). Ghi tại
        // `date` (ngày chia), KHÔNG phải paymentDate — cùng lý do nhánh CASH.
        let priceAdjustment: PriceAdjustment | undefined;
        if (!parsed.data.priceAlreadyReflectsMarket) {
          const oldPrice = await resolveOldPriceInTx(
            tx,
            holdingId,
            holding.symbol,
            date,
          );
          if (oldPrice) {
            const newPrice = computeStockDividendPriceAdjustment({
              oldPrice,
              quantityBefore: quantityAtDate,
              quantityAfter: quantityAtDate.plus(finalStockQuantity),
            });
            if (newPrice) {
              // Cùng lý do note ở nhánh CASH phía trên (review PR #62 finding #2).
              const noteLabel = `Tự động điều chỉnh do ghi cổ tức cổ phiếu ngày ${formatDate(date)}`;
              await tx.navOverride.upsert({
                where: { holdingId_date: { holdingId, date } },
                create: {
                  holdingId,
                  date,
                  price: newPrice.toString(),
                  note: noteLabel,
                },
                update: { price: newPrice.toString(), note: noteLabel },
              });
              priceAdjustment = { oldPrice, newPrice };
            }
          }
        }

        await tx.dividend.create({
          data: {
            holdingId,
            type: "STOCK",
            date,
            // Với STOCK: thuần thông tin, KHÔNG dùng cho tính toán nào —
            // buildXirrCashflows chỉ ghép cổ tức CASH (có netAmount) vào chuỗi
            // dòng tiền XIRR, STOCK không tạo dòng tiền (chỉ cộng thêm
            // stockQuantity) nên paymentDate không góp vào XIRR ở đây.
            paymentDate: parsed.data.paymentDate ?? null,
            stockQuantity: finalStockQuantity.toString(),
          },
        });

        // Cộng THẲNG vào cache hiện có (Holding.quantity), KHÔNG gọi lại
        // derivePosition()/buildQuantityTimeline để tính lại từ đầu — avgCost
        // giữ nguyên, không sửa (docs/domain/01-assets-and-holdings.md).
        const currentQuantity = new Decimal(holding.quantity.toString());
        const afterQuantity = currentQuantity.plus(finalStockQuantity);
        await tx.holding.update({
          where: { id: holdingId },
          data: { quantity: afterQuantity.toString() },
        });

        return {
          ok: true as const,
          type: "STOCK" as const,
          symbol: holding.symbol,
          unit: holding.unit,
          addedQuantity: finalStockQuantity,
          afterQuantity,
          // true CHỈ khi hệ thống tự làm tròn xuống — không phải khi user tự
          // sửa qua stockQuantityOverride (override => coi như user đã chốt
          // đúng giá trị, không cần cảnh báo làm tròn).
          wasRounded:
            wasRounded && parsed.data.stockQuantityOverride === undefined,
          rawStockQuantity,
          priceAdjustment,
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
    // Chỉ set khi user có nhập paymentDate — vắng mặt = ẩn dòng "ngày thực
    // nhận" (thuần thông tin, xem prisma/schema.prisma::Dividend.paymentDate).
    const paymentDateFields = parsed.data.paymentDate
      ? { paymentDateLabel: formatDate(parsed.data.paymentDate) }
      : {};
    // Chỉ set khi CÓ điều chỉnh thật sự xảy ra (resolveOldPriceInTx không
    // null VÀ compute*PriceAdjustment không null) — vắng mặt = ẩn khối "Đã
    // điều chỉnh giá" (issue #61, xem comment DividendRecordedResult.types.ts).
    const priceAdjustmentFields = result.priceAdjustment
      ? {
          navOverrideAdjusted: true as const,
          oldPrice: result.priceAdjustment.oldPrice.toString(),
          newPrice: result.priceAdjustment.newPrice.toString(),
        }
      : {};

    // XIRR danh mục SAU khi ghi + tổng cổ tức tiền mặt đã nhận của riêng
    // holding này — cả hai đọc TƯƠI từ DB (không qua cache() theo request) nên
    // phản ánh đúng Dividend/Holding.quantity vừa commit ở transaction trên.
    const [xirrAfterPercent, totalDividendReceived] = await Promise.all([
      getCurrentPortfolioXirrPercent(userId),
      getTotalCashDividendReceived(holdingId),
    ]);
    // Chỉ set CẢ HAI khi CẢ before lẫn after đều tính được — vắng 1 trong 2 =
    // ẩn hẳn dòng "XIRR danh mục" (DividendRecordedResult.xirrBeforePercent/
    // xirrAfterPercent, xem comment types.ts), không hiển thị số sai/NaN.
    const xirrFields =
      xirrBeforePercent !== null && xirrAfterPercent !== null
        ? { xirrBeforePercent, xirrAfterPercent }
        : {};

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
          ...paymentDateFields,
          ...priceAdjustmentFields,
          ...xirrFields,
          totalDividendReceived: totalDividendReceived.toString(),
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
        // rawAddedQuantity chỉ có mặt khi wasRounded=true (docs/dividends/types.ts).
        ...(result.wasRounded
          ? {
              wasRounded: true as const,
              rawAddedQuantity: result.rawStockQuantity.toString(),
            }
          : {}),
        ...paymentDateFields,
        ...priceAdjustmentFields,
        ...xirrFields,
        totalDividendReceived: totalDividendReceived.toString(),
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
