import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { getOpenHoldings } from "@/features/holdings/queries";
import { createManualSnapshot } from "@/features/snapshots/actions";
import { getManualSnapshotToday } from "@/features/snapshots/queries";
import { getSession } from "@/lib/auth";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";

// "/" — Dashboard tổng quan (mockup 2a/2f). Các query độc lập với query quyết định
// layout (getPortfolioValuation) — Promise.all, không await tuần tự
// (component-architecture.md checklist #2).
export default async function DashboardHomePage() {
  const selection = await getCutoffSelection();
  const [session, valuation, snapshotToday, tradeHoldings] = await Promise.all([
    getSession(),
    getPortfolioValuation(selection),
    getManualSnapshotToday(),
    getOpenHoldings(),
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
      tradeHoldings={tradeHoldings}
    />
  );
}
