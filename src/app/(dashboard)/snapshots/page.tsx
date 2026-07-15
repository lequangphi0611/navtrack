import { createManualSnapshot } from "@/features/snapshots/actions";
import { SnapshotHistoryScreen } from "@/features/snapshots/components/SnapshotHistoryScreen";
import {
  getSnapshotFreezePreview,
  getSnapshotHistory,
} from "@/features/snapshots/queries";
import { ROUTES } from "@/lib/routes";

// getSnapshotHistory() phụ thuộc navValue của getSnapshotFreezePreview() (dùng
// chung 1 lần valuateHoldings() cho cả freezeSheet lẫn chart "NAV hôm nay") —
// await tuần tự cố ý, không Promise.all (cùng pattern holdings/[id]/page.tsx
// với cashflowId, issue #46).
export default async function SnapshotHistoryPage() {
  const freezePreview = await getSnapshotFreezePreview();
  const history = await getSnapshotHistory(freezePreview.navValue);

  return (
    <SnapshotHistoryScreen
      backHref={ROUTES.dashboard}
      chart={history.chart}
      freezeSheet={{
        navValue: freezePreview.navValue,
        cutoffDateLabel: freezePreview.cutoffDateLabel,
        breakdown: freezePreview.breakdown,
        action: createManualSnapshot,
      }}
      rows={history.rows}
    />
  );
}
