import {
  createManualSnapshot,
  loadMoreSnapshotHistory,
} from "@/features/snapshots/actions";
import { SnapshotHistoryScreen } from "@/features/snapshots/components/SnapshotHistoryScreen";
import {
  getSnapshotFreezePreview,
  getSnapshotHistory,
} from "@/features/snapshots/queries";
import { ROUTES, resolveBackHref } from "@/lib/routes";

type SnapshotHistoryPageProps = {
  // ?from=<path> — route fan-in dùng chung cơ chế `withFrom`/`resolveBackHref`
  // (lib/routes.ts). TransactionSnapshotBanner ("Xem lịch sử NAV") gắn
  // `from=/holdings/<id>`; deep-link/bookmark thẳng vào /snapshots (không có
  // from) fallback về ROUTES.dashboard.
  searchParams: Promise<{ from?: string }>;
};

// getSnapshotHistory() phụ thuộc navValue của getSnapshotFreezePreview() (dùng
// chung 1 lần valuateHoldings() cho cả freezeSheet lẫn chart "NAV hôm nay") —
// await tuần tự cố ý, không Promise.all (cùng pattern holdings/[id]/page.tsx
// với cashflowId, issue #46).
export default async function SnapshotHistoryPage({
  searchParams,
}: SnapshotHistoryPageProps) {
  const { from } = await searchParams;
  const freezePreview = await getSnapshotFreezePreview();
  const history = await getSnapshotHistory(freezePreview.navValue);
  const backHref = resolveBackHref(from, ROUTES.dashboard);

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
