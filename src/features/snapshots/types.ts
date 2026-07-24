import type { SnapshotListRow } from "@/features/snapshots/components/SnapshotHistoryList";

// Nguồn sự thật cho state của form action "Chốt số liệu hôm nay" — dùng chung
// giữa @/features/dashboard/components/SnapshotTodayCard (quick action trên
// Dashboard) và @/features/snapshots/components/SnapshotFreezeSheet (bottom
// sheet 3b trên màn Lịch sử NAV), vì cả hai đều gọi cùng một Server Action
// createManualSnapshot(). Chuyển từ @/features/dashboard/types (issue #35) vì
// giờ có 2 feature cùng cần — repo không có tiền lệ import chéo feature.
export type SnapshotTodayState =
  | { ok: true; snapshotAt: string } // "15:42" — HH:mm giờ VN
  | { ok: false; error: string }
  | null;

// Payload load-more "Các mốc đã chốt" (/snapshots, cursor-based, issue #83) —
// trả về từ loadMoreSnapshotHistory() (actions.ts), rows đã map sang
// SnapshotListRow{kind:"frozen"} (UI row), sẵn sàng nối vào danh sách hiện có.
export type SnapshotHistoryPage = {
  rows: SnapshotListRow[];
  nextCursor: string | null;
};
