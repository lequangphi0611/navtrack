import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { createManualSnapshot } from "@/features/snapshots/actions";
import { getManualSnapshotToday } from "@/features/snapshots/queries";
import { getSession } from "@/lib/auth";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";

// Container (Server Component): vùng data chính của Dashboard (mockup 2a/2f) — mọi thứ
// DashboardScreen render (header/avatar, NAV hero, PnL, allocation, SnapshotTodayCard...).
// Tách khỏi DashboardQuickMenuSection (FAB, fixed-position) để 2 vùng stream độc lập
// (component-architecture.md checklist #2).
async function PortfolioOverviewSection() {
  const selection = await getCutoffSelection();
  const [session, valuation, snapshotToday] = await Promise.all([
    getSession(),
    getPortfolioValuation(selection),
    getManualSnapshotToday(),
  ]);

  return (
    <DashboardScreen
      displayName={session?.user?.name ?? ""}
      {...valuation}
      snapshotToday={{
        alreadySnapshotToday: snapshotToday !== null,
        snapshotTakenAt: snapshotToday?.takenAt,
        action: createManualSnapshot,
      }}
    />
  );
}

export { PortfolioOverviewSection };
