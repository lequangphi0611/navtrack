import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { getPortfolioValuation } from "@/features/dashboard/queries";
import { getSession } from "@/lib/auth";

// "/" — Dashboard tổng quan (mockup 2a/2f). Đúng 1 query quyết định toàn bộ
// layout (component-architecture.md checklist #3) nên page giữ async đơn
// giản, không tách Suspense nội bộ (giống pattern holdings/[id]/page.tsx).
export default async function DashboardHomePage() {
  const [session, valuation] = await Promise.all([
    getSession(),
    getPortfolioValuation(),
  ]);

  return (
    <DashboardScreen displayName={session?.user?.name ?? ""} {...valuation} />
  );
}
