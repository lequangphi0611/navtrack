"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate, todayIctDateOnly } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { planManualSnapshot } from "@/lib/manual-snapshot";
import { ROUTES } from "@/lib/routes";
import { valuateHoldings } from "@/lib/valuation";

// Cross-feature import (snapshots -> holdings) — cùng tiền lệ lib/portfolio-valuation.ts
// đã import getOpenHoldings/getClosedHoldings. Chiều ngược lại (holdings/actions.ts gọi
// freezeManualSnapshot() sau mỗi giao dịch) không tạo vòng: holdings/actions.ts ->
// snapshots/actions.ts -> holdings/queries.ts, không có cạnh nào quay lại holdings/actions.ts.
import { getOpenHoldings } from "@/features/holdings/queries";

import type { SnapshotTodayState } from "./types";

// Core — ghi/upsert Snapshot{period: MANUAL} tại "hôm nay" (ICT): 1 dòng mỗi Holding đang
// mở đã định giá được + 1 dòng tổng danh mục (holdingId: null). Dùng cho cả 2 trigger
// (docs/domain/06-snapshots.md "Khi nào lưu snapshot"): nút "Chốt số liệu hôm nay"
// (createManualSnapshot, gọi trực tiếp từ form) và tự động sau mua/bán
// (features/holdings/actions.ts gọi hàm này làm hiệu ứng phụ, không phải qua form).
//
// Re-chốt "hôm nay" nhiều lần trong ngày = upsert idempotent theo (userId|holdingId, date,
// period) — LUÔN ok:true, KHÔNG phải lỗi (docs/domain/06-snapshots.md mục "Ca biên").
export async function freezeManualSnapshot(): Promise<
  ActionResult<{ value: string; snapshotAt: string }>
> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Chưa đăng nhập" };
  const userId = session.user.id;

  const openHoldings = await getOpenHoldings();
  const cutoffDate = resolveCutoffDate({ key: "TODAY" });
  const valuations = await valuateHoldings(
    openHoldings.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );

  const plan = planManualSnapshot(
    openHoldings.map((h) => h.id),
    valuations,
  );

  if (!plan.aggregate) {
    logger.warn(
      { userId, missingHoldingIds: plan.missingHoldingIds },
      "freezeManualSnapshot: no open holding priced, skipping snapshot entirely",
    );
    return {
      ok: false,
      error: "Chưa có mã nào định giá được, không thể chốt số liệu",
    };
  }

  // Gán ra biến ngoài callback $transaction — TS không đảm bảo giữ narrowing của property
  // access (plan.aggregate) qua ranh giới một closure mới, kể cả khi `plan` là const.
  const aggregateValue = plan.aggregate.value;
  const date = todayIctDateOnly();

  try {
    await db.$transaction(
      async (tx) => {
        // Không có @@unique cho (holdingId, date, period) ở Prisma DSL (partial unique
        // index, xem prisma/schema.prisma) nên không dùng được tx.snapshot.upsert() thẳng.
        // Thay vì findFirst + create/update tuần tự cho TỪNG holding (N+1 round-trip), gom
        // "còn dòng nào chưa" thành 1 findMany, rồi createMany 1 lượt cho phần chưa có —
        // chỉ update từng dòng (không batch được, value khác nhau mỗi dòng) cho phần re-chốt
        // thật (hiếm, chỉ khi bấm "Chốt số liệu hôm nay" > 1 lần cùng ngày).
        const holdingIds = plan.holdingWrites.map((write) => write.holdingId);
        const existingRows = holdingIds.length
          ? await tx.snapshot.findMany({
              where: {
                userId,
                holdingId: { in: holdingIds },
                date,
                period: "MANUAL",
              },
              select: { id: true, holdingId: true },
            })
          : [];
        const existingIdByHoldingId = new Map(
          existingRows.map((row) => [row.holdingId, row.id]),
        );

        const toCreate = plan.holdingWrites.filter(
          (write) => !existingIdByHoldingId.has(write.holdingId),
        );
        const toUpdate = plan.holdingWrites.filter((write) =>
          existingIdByHoldingId.has(write.holdingId),
        );

        if (toCreate.length > 0) {
          await tx.snapshot.createMany({
            data: toCreate.map((write) => ({
              userId,
              holdingId: write.holdingId,
              date,
              value: write.value.toString(),
              source: write.source,
              period: "MANUAL" as const,
              frozen: true,
            })),
          });
        }

        for (const write of toUpdate) {
          const id = existingIdByHoldingId.get(write.holdingId);
          if (id === undefined) continue;
          await tx.snapshot.update({
            where: { id },
            data: { value: write.value.toString(), source: write.source },
          });
        }

        const existingAggregate = await tx.snapshot.findFirst({
          where: { userId, holdingId: null, date, period: "MANUAL" },
          select: { id: true },
        });
        if (existingAggregate) {
          await tx.snapshot.update({
            where: { id: existingAggregate.id },
            data: { value: aggregateValue.toString() },
          });
        } else {
          await tx.snapshot.create({
            data: {
              userId,
              holdingId: null,
              date,
              value: aggregateValue.toString(),
              // Snapshot tổng danh mục LUÔN "AUTO" — con số tính toán (sum), không phải
              // giá trị lấy thẳng từ 1 dòng nhập tay (docs/domain/06-snapshots.md "Cách
              // tính"). Khác write.source (per-holding, giữ nguyên AUTO/MANUAL thật).
              source: "AUTO",
              period: "MANUAL",
              frozen: true,
            },
          });
        }
      },
      // Serializable — check-before-insert (TOCTOU) khi 2 request cùng chốt gần lúc nhau,
      // cùng pattern các action trong features/holdings/actions.ts (docs/rules/data-prisma.md).
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" || err.code === "P2034") {
        // Hai request chốt đồng thời — request thua trong đua tranh gặp lỗi ràng buộc
        // unique (P2002) hoặc serialization conflict (P2034), không phải bug.
        logger.warn(
          { userId, code: err.code },
          "freezeManualSnapshot race, ask to retry",
        );
        return {
          ok: false,
          error: "Có yêu cầu chốt số liệu khác đang xử lý, vui lòng thử lại",
        };
      }
    }
    logger.error({ err, userId }, "freezeManualSnapshot failed");
    throw err;
  }

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.snapshots);

  return {
    ok: true,
    data: {
      value: aggregateValue.toString(),
      snapshotAt: formatTime(new Date()),
    },
  };
}

// Chữ ký khớp useActionState — dùng CHUNG làm prop `action` cho SnapshotTodayCard
// (Dashboard) và SnapshotFreezeSheet (/snapshots), cả hai gọi cùng 1 Server Action này.
export async function createManualSnapshot(
  _prevState: SnapshotTodayState,
  _formData: FormData,
): Promise<SnapshotTodayState> {
  const result = await freezeManualSnapshot();
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, snapshotAt: result.data.snapshotAt };
}
