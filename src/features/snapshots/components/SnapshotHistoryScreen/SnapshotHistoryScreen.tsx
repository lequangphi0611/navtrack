import { PageHeader } from "@/components/PageHeader";
import type { SnapshotHistoryPage } from "@/features/snapshots/types";
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
import type { ActionResult } from "@/lib/action-result";

type SnapshotHistoryScreenProps = {
  backHref: string; // ROUTES.dashboard
  chart: NavHistoryChartProps;
  freezeSheet: SnapshotFreezeSheetProps;
  rows: SnapshotListRow[];
  // Load-more "Các mốc đã chốt" (cursor-based, issue #83) — SnapshotHistoryList
  // tự quản lý state phân trang, nhận sẵn trang đầu (initialHasMore/initialNextCursor,
  // đã fetch ở page.tsx) + action server để tự gọi tiếp khi cần xem thêm.
  initialHasMore: boolean;
  initialNextCursor: string | null;
  loadMoreAction: (
    cursor: string,
  ) => Promise<ActionResult<SnapshotHistoryPage>>;
};

// Organism cho /snapshots (mockup 3a) — PageHeader + mini chart NAV + CTA chốt
// thủ công (mở bottom sheet 3b) + danh sách các mốc đã chốt.
function SnapshotHistoryScreen({
  backHref,
  chart,
  freezeSheet,
  rows,
  initialHasMore,
  initialNextCursor,
  loadMoreAction,
}: SnapshotHistoryScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Lịch sử NAV" backHref={backHref} />

      <NavHistoryChart {...chart} />
      <SnapshotFreezeSheet {...freezeSheet} />
      <SnapshotHistoryList
        rows={rows}
        initialHasMore={initialHasMore}
        initialNextCursor={initialNextCursor}
        loadMoreAction={loadMoreAction}
      />
    </div>
  );
}

export { SnapshotHistoryScreen };
export type { SnapshotHistoryScreenProps };
