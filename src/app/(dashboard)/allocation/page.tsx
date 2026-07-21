import { AllocationScreen } from "@/features/dashboard/components/AllocationScreen";
import { getAllocationDetail } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

// Route riêng full-screen (mục 10 phase-6.md, process/DECISION.md 2026-07-21:
// mockup 6d vẽ full-screen với back button, không phải Sheet). % không bị ẩn
// bởi chế độ ẩn số tiền — AllocationScreen không nhận/không cần prop `hidden`.
export default async function AllocationPage() {
  const { slices, concentrationWarningCount } = await getAllocationDetail();

  return (
    <AllocationScreen
      backHref={ROUTES.holdings}
      slices={slices}
      concentrationWarningCount={concentrationWarningCount}
    />
  );
}
