import Decimal from "decimal.js";

import type { AssetType } from "@/components/AssetTypeBadge";
import { getOpenHoldings } from "@/features/holdings/queries";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate, todayIctDateOnly } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/format";
import type { HoldingValuation } from "@/lib/valuation";
import { valuateHoldings } from "@/lib/valuation";

// Thứ tự nhóm cố định — khớp GROUP_ORDER (features/holdings/group-holdings.ts) và
// ASSET_TYPE_ORDER (lib/portfolio-valuation.ts): STOCK, FUND, BOND, GOLD.
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

// Snapshot{userId, holdingId: null, date: hôm nay, period: MANUAL} của user hiện tại —
// dùng cho Dashboard (alreadySnapshotToday/snapshotTakenAt, SnapshotTodayCard) VÀ cho
// justRecorded.snapshotNavValue ở /holdings/[id] (getJustRecordedBanner). `takenAt` đọc
// từ `updatedAt` (không phải `createdAt`) — re-chốt trong ngày ghi đè, updatedAt phản
// ánh đúng lần chốt GẦN NHẤT (docs/domain/06-snapshots.md mục "Ca biên").
export async function getManualSnapshotToday(): Promise<{
  value: string;
  takenAt: string;
} | null> {
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
}

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
