import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { AssetType } from "@/components/AssetTypeBadge";
import { getOpenHoldings } from "@/features/holdings/queries";
import type {
  SnapshotDetailHoldingRow,
  SnapshotDetailScreenProps,
} from "@/features/snapshots/components/SnapshotDetailScreen";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate, todayIctDateOnly } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatDate, formatDayMonth, formatTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import {
  buildSnapshotHistoryView,
  type FrozenSnapshotRow,
} from "@/lib/snapshot-history";
import {
  computeRecomputedComparison,
  type RecomputeHoldingInput,
} from "@/lib/snapshot-recompute";
import type { HoldingValuation } from "@/lib/valuation";
import {
  getLatestNavOverrides,
  getLatestPriceQuotes,
  resolvePrice,
  valuateHoldings,
} from "@/lib/valuation";

// Thứ tự nhóm cố định — khớp GROUP_ORDER (features/holdings/group-holdings.ts) và
// ASSET_TYPE_ORDER (lib/portfolio-valuation.ts): STOCK, FUND, BOND, GOLD.
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

// Snapshot{userId, holdingId: null, date: hôm nay, period: MANUAL} của user hiện tại —
// dùng cho Dashboard (alreadySnapshotToday/snapshotTakenAt, SnapshotTodayCard) VÀ cho
// justRecorded.snapshotNavValue ở /holdings/[id] (getJustRecordedBanner). `takenAt` đọc
// từ `updatedAt` (không phải `createdAt`) — re-chốt trong ngày ghi đè, updatedAt phản
// ánh đúng lần chốt GẦN NHẤT (docs/domain/06-snapshots.md mục "Ca biên").
export const getManualSnapshotToday = cache(
  async (): Promise<{
    value: string;
    takenAt: string;
  } | null> => {
    const session = await getSession();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const row = await db.snapshot.findFirst({
      where: {
        userId: session.user.id,
        holdingId: null,
        date: todayIctDateOnly(),
        period: "MANUAL",
      },
      select: { value: true, updatedAt: true },
    });

    if (!row) return null;
    return { value: row.value.toString(), takenAt: formatTime(row.updatedAt) };
  },
);

function isValued(
  valuation: HoldingValuation,
): valuation is Extract<HoldingValuation, { status: "VALUED" }> {
  return valuation.status === "VALUED";
}

// Preview cho SnapshotFreezeSheet (/snapshots, mockup 3b) — NAV "sẽ đóng băng" nếu bấm
// "Đóng băng số liệu" ngay bây giờ, tính lại tại thời điểm submit bởi freezeManualSnapshot()
// (số hiển thị ở đây chỉ là preview, có thể lệch nhẹ nếu giá đổi giữa lúc xem và lúc bấm).
//
// breakdown LUÔN đúng 4 dòng (STOCK/FUND/BOND/GOLD) — khác buildAllocation()
// (lib/portfolio-valuation.ts) vốn bỏ nhóm không có holding nào VALUED (dùng cho % phân
// bổ, nhóm rỗng vô nghĩa ở biểu đồ đó). Ở đây SnapshotFreezeSheetProps.breakdown ghi rõ
// "đúng 4 nhóm" — nhóm không có holding loại đó (hoặc có nhưng toàn MISSING_PRICE) hiện
// value "0" (NAV thật của nhóm, không phải giấu do thiếu giá).
export async function getSnapshotFreezePreview(): Promise<{
  navValue: string;
  cutoffDateLabel: string;
  breakdown: { type: AssetType; value: string }[];
}> {
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

  const navByType = new Map<AssetType, Decimal>();
  for (const holding of openHoldings) {
    const valuation = valuations.get(holding.id);
    if (!valuation || !isValued(valuation)) continue;
    const prev = navByType.get(holding.type) ?? new Decimal(0);
    navByType.set(holding.type, prev.plus(valuation.nav));
  }

  const breakdown = ASSET_TYPE_ORDER.map((type) => ({
    type,
    value: (navByType.get(type) ?? new Decimal(0)).toString(),
  }));

  const navValue = breakdown
    .reduce((sum, row) => sum.plus(row.value), new Decimal(0))
    .toString();

  return {
    navValue,
    cutoffDateLabel: formatDate(new Date()),
    breakdown,
  };
}

// Đủ cho chart 7 điểm + danh sách hiển thị hợp lý — không cần thêm index mới,
// @@index([userId, date]) đã có trên Snapshot đủ dùng (leftmost prefix userId,
// sort theo date). App cá nhân quy mô nhỏ (Trọng tâm quyết định #5, issue #46).
const SNAPSHOT_HISTORY_LIMIT = 20;

// Dữ liệu cho /snapshots (mockup 3a) — chart NAV + danh sách "Các mốc đã chốt".
// Nhận `navToday` từ caller (page.tsx) thay vì tự tính lại — tránh gọi trùng
// getOpenHoldings()/valuateHoldings() 2 lần trong cùng request (page.tsx đã
// gọi getSnapshotFreezePreview() cho freezeSheet, dùng luôn NAV đó).
export async function getSnapshotHistory(
  navToday: string,
  now: Date = new Date(),
): Promise<ReturnType<typeof buildSnapshotHistoryView>> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const frozen = await db.snapshot.findMany({
    where: { userId: session.user.id, holdingId: null, frozen: true },
    orderBy: { date: "desc" },
    take: SNAPSHOT_HISTORY_LIMIT,
    select: { id: true, date: true, value: true, period: true },
  });

  const frozenRows: FrozenSnapshotRow[] = frozen.map((s) => ({
    id: s.id,
    date: s.date,
    value: s.value.toString(),
    period: s.period,
  }));

  return buildSnapshotHistoryView(frozenRows, navToday, now);
}

// Subtitle 3c (không có recomputedComparison) — mở rộng đúng câu mockup gốc
// ("Cuối tháng · toàn danh mục", page.tsx demo cũ) cho cả 3 period còn lại.
// TODAY không nằm trong map này vì snapshot tổng danh mục không bao giờ ở
// period đó khi đã đóng băng (frozen luôn true ở query trên, còn TODAY luôn
// frozen=false — docs/domain/06-snapshots.md).
const SNAPSHOT_SUBTITLE_BY_PERIOD: Record<
  "PERIODIC" | "YEAR_END" | "MANUAL",
  string
> = {
  PERIODIC: "Cuối tháng · toàn danh mục",
  YEAR_END: "Cuối năm · toàn danh mục",
  MANUAL: "Chốt thủ công · toàn danh mục",
};

// Chi tiết một snapshot tổng danh mục đã đóng băng (mockup 3c/3f, /snapshots/[id]).
// So giá tại mốc chốt với giá hiện tại cho từng holding trong breakdown để quyết
// định có hiện `recomputedComparison` hay không (server quyết định, không phải 2
// loại snapshot khác nhau — process/UI_phase_3.md mục 4).
export async function getSnapshotDetail(
  id: string,
): Promise<SnapshotDetailScreenProps> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const snapshot = await db.snapshot.findUnique({ where: { id } });
  // Không tồn tại / không thuộc user hiện tại / là dòng per-holding (chỉ xem
  // được qua dòng tổng danh mục lồng bên trong) / chưa đóng băng (period =
  // TODAY, tính động không lưu thật — không có trang chi tiết) -> xử lý
  // giống nhau, 404, không lộ thông tin tồn tại (cùng pattern getHoldingDetail,
  // features/holdings/queries.ts).
  if (
    !snapshot ||
    snapshot.userId !== session.user.id ||
    snapshot.holdingId !== null ||
    !snapshot.frozen
  ) {
    notFound();
  }

  // Liên kết breakdown per-holding với dòng tổng: CÙNG (userId, date, period),
  // KHÁC holdingId (không có FK trực tiếp) — Trọng tâm quyết định #2, đúng khóa
  // dedup (userId, holdingId, date, period) đã có từ issue #34.
  const holdingRows = await db.snapshot.findMany({
    where: {
      userId: session.user.id,
      date: snapshot.date,
      period: snapshot.period,
      holdingId: { not: null },
    },
    select: {
      holdingId: true,
      value: true,
      holding: { select: { symbol: true, name: true, type: true } },
    },
  });

  const now = new Date();
  const cutoffToday = resolveCutoffDate({ key: "TODAY" }, now);
  // holdingId lọc { not: null } ở where + Holding có onDelete: Cascade trên
  // Snapshot (schema.prisma) -> holding luôn tồn tại khi holdingId không null;
  // non-null assertion an toàn ở đây (cùng pattern netAmount! ở lib/portfolio-valuation.ts).
  const holdingIds = holdingRows.map((r) => r.holdingId as string);
  const symbols = holdingRows.map((r) => r.holding!.symbol);

  const [histNavOverrides, histPriceQuotes, curNavOverrides, curPriceQuotes] =
    await Promise.all([
      getLatestNavOverrides(holdingIds, snapshot.date),
      getLatestPriceQuotes(symbols, snapshot.date),
      getLatestNavOverrides(holdingIds, cutoffToday),
      getLatestPriceQuotes(symbols, cutoffToday),
    ]);

  const recomputeInputs: RecomputeHoldingInput[] = holdingRows.map((row) => ({
    frozenValue: new Decimal(row.value.toString()),
    historicalPrice:
      resolvePrice(
        histNavOverrides.get(row.holdingId!) ?? null,
        histPriceQuotes.get(row.holding!.symbol) ?? null,
      )?.price ?? null,
    currentPrice:
      resolvePrice(
        curNavOverrides.get(row.holdingId!) ?? null,
        curPriceQuotes.get(row.holding!.symbol) ?? null,
      )?.price ?? null,
  }));

  const recomputedComparison = computeRecomputedComparison(
    recomputeInputs,
    new Decimal(snapshot.value.toString()),
    formatDayMonth(now),
  );

  const holdings: SnapshotDetailHoldingRow[] = ASSET_TYPE_ORDER.flatMap(
    (type) => holdingRows.filter((row) => row.holding!.type === type),
  ).map((row) => ({
    id: row.holdingId as string,
    symbol: row.holding!.symbol,
    name: row.holding!.name ?? row.holding!.symbol,
    assetType: row.holding!.type,
    value: row.value.toString(),
  }));

  return {
    title: `Snapshot ${formatDate(snapshot.date)}`,
    subtitle: recomputedComparison
      ? "Giá đã đổi từ khi chốt"
      : // Guard `!snapshot.frozen` phía trên loại trừ period TODAY khỏi mọi
        // dòng đi tới đây trong thực tế (domain invariant, docs/domain/06) —
        // cast thu hẹp union còn 3 giá trị khớp SNAPSHOT_SUBTITLE_BY_PERIOD.
        SNAPSHOT_SUBTITLE_BY_PERIOD[
          snapshot.period as "PERIODIC" | "YEAR_END" | "MANUAL"
        ],
    backHref: ROUTES.snapshots,
    navValue: snapshot.value.toString(),
    meta: {
      sourceLabel: snapshot.source,
      periodLabel: snapshot.period as "PERIODIC" | "YEAR_END" | "MANUAL",
      cutoffDateLabel: formatDate(snapshot.date),
      // updatedAt (không phải createdAt) — re-chốt cùng mốc ghi đè, cùng lý do
      // đã áp cho getManualSnapshotToday() ở trên.
      recordedAtLabel: `${formatDayMonth(snapshot.updatedAt)} ${formatTime(snapshot.updatedAt)}`,
    },
    holdings,
    recomputedComparison: recomputedComparison ?? undefined,
  };
}
