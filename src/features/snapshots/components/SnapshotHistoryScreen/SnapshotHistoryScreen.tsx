import { PageHeader } from "@/components/PageHeader";
import {
  NavHistoryChart,
  type NavHistoryChartProps,
} from "@/features/snapshots/components/NavHistoryChart";
import {
  SnapshotFreezeSheet,
  type SnapshotFreezeSheetProps,
} from "@/features/snapshots/components/SnapshotFreezeSheet";
import {
  SnapshotHistoryList,
  type SnapshotListRow,
} from "@/features/snapshots/components/SnapshotHistoryList";

type SnapshotHistoryScreenProps = {
  backHref: string; // ROUTES.dashboard
  chart: NavHistoryChartProps;
  freezeSheet: SnapshotFreezeSheetProps;
  rows: SnapshotListRow[];
};

// Organism cho /snapshots (mockup 3a) — PageHeader + mini chart NAV + CTA chốt
// thủ công (mở bottom sheet 3b) + danh sách các mốc đã chốt.
function SnapshotHistoryScreen({
  backHref,
  chart,
  freezeSheet,
  rows,
}: SnapshotHistoryScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Lịch sử NAV" backHref={backHref} />

      <NavHistoryChart {...chart} />
      <SnapshotFreezeSheet {...freezeSheet} />
      <SnapshotHistoryList rows={rows} />
    </div>
  );
}

export { SnapshotHistoryScreen };
export type { SnapshotHistoryScreenProps };
