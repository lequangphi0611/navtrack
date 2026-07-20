import { DashboardQuickMenu } from "@/features/dashboard/components/DashboardQuickMenu";
import { getOpenHoldings } from "@/features/holdings/queries";
import { getManualSnapshotToday } from "@/features/snapshots/queries";

// Container (Server Component): chỉ FAB DashboardQuickMenu (mockup 4f) — fixed-position,
// tách khỏi luồng DOM chính nên có thể stream độc lập với PortfolioOverviewSection
// (component-architecture.md checklist #2). getManualSnapshotToday() cũng được gọi ở
// PortfolioOverviewSection trong cùng request — bọc cache() ở queries.ts để không nhân
// đôi round-trip DB.
async function DashboardQuickMenuSection() {
  const [snapshotToday, tradeHoldings] = await Promise.all([
    getManualSnapshotToday(),
    getOpenHoldings(),
  ]);

  return (
    <DashboardQuickMenu
      showSnapshotAction={snapshotToday !== null}
      tradeHoldings={tradeHoldings}
    />
  );
}

export { DashboardQuickMenuSection };
