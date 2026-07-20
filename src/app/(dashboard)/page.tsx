import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DashboardScreenSkeleton } from "@/features/dashboard/components/DashboardScreen";
import { DashboardQuickMenuSkeleton } from "@/features/dashboard/components/DashboardQuickMenu";
import { DashboardQuickMenuSection } from "@/features/dashboard/components/DashboardQuickMenuSection";
import { PortfolioOverviewSection } from "@/features/dashboard/components/PortfolioOverviewSection";

// "/" — Dashboard tổng quan (mockup 2a/2f). Không có nhánh trạng thái quyết định layout
// (khác settings/members hay holdings/(overview)) — 2 vùng Suspense độc lập theo đúng
// ranh giới 2 nguồn dữ liệu: PortfolioOverviewSection (nội dung chính) và
// DashboardQuickMenuSection (FAB fixed-position, tách khỏi luồng DOM chính) —
// component-architecture.md checklist #2.
export default function DashboardHomePage() {
  return (
    <>
      <Suspense fallback={<DashboardScreenSkeleton />}>
        <PortfolioOverviewSection />
      </Suspense>
      <Suspense fallback={<DashboardQuickMenuSkeleton />}>
        <DashboardQuickMenuSection />
      </Suspense>
      <BottomNav active="dashboard" />
    </>
  );
}
