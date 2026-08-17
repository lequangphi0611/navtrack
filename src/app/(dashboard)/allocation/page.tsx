import { AllocationScreenClient } from "@/features/dashboard/components/AllocationScreen";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { getAllocationDetail } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

// Route riêng full-screen (mục 10 phase-6.md, process/DECISION.md 2026-07-21:
// mockup 6d vẽ full-screen với back button, không phải Sheet). Từ issue #130
// màn này CÓ hiện VND (NAV ròng/lãi-lỗ theo nhóm) nên cần `hidden` — mirror
// pattern StockAllocationPage (Promise.all query dữ liệu + cờ ẩn mặc định,
// AllocationScreenClient tự giữ state + gọi setHideAmountsByDefault()). % vẫn
// KHÔNG bị ảnh hưởng bởi cờ này (AllocationScreen tự đảm bảo).
export default async function AllocationPage() {
  const [data, hideAmountsByDefault] = await Promise.all([
    getAllocationDetail(),
    getHideAmountsByDefault(),
  ]);

  return (
    <AllocationScreenClient
      backHref={ROUTES.holdings}
      initialHidden={hideAmountsByDefault}
      slices={data.slices}
      concentrationWarningCount={data.concentrationWarningCount}
      totalNavAmount={data.totalNavAmount}
      totalNavIsPartial={data.totalNavIsPartial}
      totalPnlAmount={data.totalPnlAmount}
      totalPnlPercent={data.totalPnlPercent}
    />
  );
}
