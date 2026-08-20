import { isOwnHolding } from "@/features/holdings/queries";
import {
  createManualSnapshot,
  loadMoreSnapshotHistory,
} from "@/features/snapshots/actions";
import { SnapshotHistoryScreen } from "@/features/snapshots/components/SnapshotHistoryScreen";
import {
  getSnapshotFreezePreview,
  getSnapshotHistory,
} from "@/features/snapshots/queries";
import { ROUTES } from "@/lib/routes";

type SnapshotHistoryPageProps = {
  // ?fromHolding=<holdingId> — TransactionSnapshotBanner ("Xem lịch sử NAV")
  // truyền holdingId ĐỘNG, không phải EntrySource cố định. KHÔNG tin thẳng
  // query string: isOwnHolding() verify holdingId thuộc đúng user trước khi
  // dùng làm backHref — xem lib/routes.ts::snapshotsFromHolding.
  searchParams: Promise<{ fromHolding?: string }>;
};

// getSnapshotHistory() phụ thuộc navValue của getSnapshotFreezePreview() (dùng
// chung 1 lần valuateHoldings() cho cả freezeSheet lẫn chart "NAV hôm nay") —
// await tuần tự cố ý, không Promise.all (cùng pattern holdings/[id]/page.tsx
// với cashflowId, issue #46).
export default async function SnapshotHistoryPage({
  searchParams,
}: SnapshotHistoryPageProps) {
  const { fromHolding } = await searchParams;
  const freezePreview = await getSnapshotFreezePreview();
  const history = await getSnapshotHistory(freezePreview.navValue);
  const backHref =
    fromHolding && (await isOwnHolding(fromHolding))
      ? ROUTES.holdingDetail(fromHolding)
      : ROUTES.dashboard;

  return (
    <SnapshotHistoryScreen
      backHref={backHref}
      chart={history.chart}
      freezeSheet={{
        navValue: freezePreview.navValue,
        cutoffDateLabel: freezePreview.cutoffDateLabel,
        breakdown: freezePreview.breakdown,
        action: createManualSnapshot,
      }}
      rows={history.rows}
      initialNextCursor={history.nextCursor}
      loadMoreAction={loadMoreSnapshotHistory}
    />
  );
}
