import { createManualSnapshot } from "@/features/snapshots/actions";
import { SnapshotHistoryScreen } from "@/features/snapshots/components/SnapshotHistoryScreen";
import { getSnapshotFreezePreview } from "@/features/snapshots/queries";
import { ROUTES } from "@/lib/routes";

// TODO(business-implementer): thay `chart`/`rows` bằng getSnapshotHistory() thật — đọc
// Snapshot{holdingId: null} theo user, tính heightPercent từ max(values) của 8 điểm gần
// nhất, ghép "hôm nay" tính động (không lưu) làm row đầu kind "live" (issue #46, xem
// process/UI_phase_3.md). `freezeSheet` đã wiring thật (issue #37).
export default async function SnapshotHistoryPage() {
  const freezePreview = await getSnapshotFreezePreview();

  return (
    <SnapshotHistoryScreen
      backHref={ROUTES.dashboard}
      chart={{
        navToday: "3723986000",
        changePercent: 13.7,
        points: [
          { label: "T12", heightPercent: 53 },
          { label: "T1", heightPercent: 64 },
          { label: "T2", heightPercent: 59 },
          { label: "T3", heightPercent: 75 },
          { label: "T4", heightPercent: 69 },
          { label: "T5", heightPercent: 88 },
          { label: "T6", heightPercent: 94 },
          { label: "nay", heightPercent: 100, isLive: true },
        ],
      }}
      freezeSheet={{
        navValue: freezePreview.navValue,
        cutoffDateLabel: freezePreview.cutoffDateLabel,
        breakdown: freezePreview.breakdown,
        action: createManualSnapshot,
      }}
      rows={[
        {
          kind: "live",
          label: "Hôm nay",
          dateNote: "11/07/2026 · tính động, chưa lưu",
          value: "3723986000",
        },
        {
          kind: "frozen",
          id: "snap-2026-06",
          label: "Cuối tháng 6",
          badge: { text: "ĐỊNH KỲ", variant: "default" },
          dateNote: "30/06/2026 · cron 01/07",
          value: "3681200000",
          href: ROUTES.snapshotDetail("snap-2026-06"),
        },
        {
          kind: "frozen",
          id: "snap-2026-05-15-hpg",
          label: "Mua thêm HPG",
          badge: { text: "GIAO DỊCH", variant: "warning" },
          dateNote: "15/05/2026 · tự động khi mua",
          value: "3588400000",
          href: ROUTES.snapshotDetail("snap-2026-05-15-hpg"),
        },
        {
          kind: "frozen",
          id: "snap-2026-05",
          label: "Cuối tháng 5",
          badge: { text: "ĐỊNH KỲ", variant: "default" },
          dateNote: "31/05/2026 · cron 01/06",
          value: "3542100000",
          href: ROUTES.snapshotDetail("snap-2026-05"),
        },
        {
          kind: "frozen",
          id: "snap-2025-year-end",
          label: "Cuối năm 2025",
          badge: { text: "CUỐI NĂM", variant: "accent" },
          dateNote: "31/12/2025 · cron 01/01",
          value: "3275500000",
          href: ROUTES.snapshotDetail("snap-2025-year-end"),
        },
      ]}
    />
  );
}
