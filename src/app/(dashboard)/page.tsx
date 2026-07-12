import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { getSession } from "@/lib/auth";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";

// "/" — Dashboard tổng quan (mockup 2a/2f). Đúng 1 query quyết định toàn bộ
// layout (component-architecture.md checklist #3) nên page giữ async đơn
// giản, không tách Suspense nội bộ (giống pattern holdings/[id]/page.tsx).
export default async function DashboardHomePage() {
  const selection = await getCutoffSelection();
  const [session, valuation] = await Promise.all([
    getSession(),
    getPortfolioValuation(selection),
  ]);

  return (
    <DashboardScreen displayName={session?.user?.name ?? ""} {...valuation} />
  );
}
