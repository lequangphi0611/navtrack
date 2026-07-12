import { DashboardScreenSkeleton } from "@/features/dashboard/components/DashboardScreen";

// Fallback route "/" khi điều hướng lần đầu — getPortfolioValuation() +
// getSession() await chặn render trong page.tsx (component-architecture.md
// checklist #1).
export default function DashboardLoading() {
  return <DashboardScreenSkeleton />;
}
