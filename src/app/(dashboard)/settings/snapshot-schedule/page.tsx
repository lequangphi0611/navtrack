import { SnapshotScheduleScreen } from "@/features/settings/components/SnapshotScheduleScreen";
import { ROUTES } from "@/lib/routes";

// Nội dung tĩnh, không query (lịch cron cố định trong workflow, xem
// SnapshotScheduleScreen).
export default function SnapshotSchedulePage() {
  return <SnapshotScheduleScreen backHref={ROUTES.settings} />;
}
