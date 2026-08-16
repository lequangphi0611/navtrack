import { StockAllocationDetailClient } from "@/features/dashboard/components/StockAllocationDetail";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { getStockAllocationDetail } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

// "/allocation/stock" — drill-down "% theo mã trong nhóm cổ phiếu" (issue
// #132, phụ thuộc #131 cho component Presentational). Route con riêng của
// /allocation, KHÔNG accordion (process/DECISION.md 2026-08-16). `backHref`
// trỏ về /allocation (điểm vào qua dòng legend "Cổ phiếu"), khác AllocationPage
// (backHref /holdings) vì đây là một tầng con sâu hơn.
//
// getStockAllocationDetail() quyết định TOÀN BỘ layout (rows rỗng/1 mã/có mã
// thiếu giá — nhánh trong chính StockAllocationDetail) nên đặt await thẳng ở
// page (checklist component-architecture.md mục 3) — cùng pattern AllocationPage
// hiện có. getHideAmountsByDefault() không quyết định nhánh, chạy song song.
export default async function StockAllocationPage() {
  const [data, hideAmountsByDefault] = await Promise.all([
    getStockAllocationDetail(),
    getHideAmountsByDefault(),
  ]);

  return (
    <StockAllocationDetailClient
      backHref={ROUTES.allocation}
      initialHidden={hideAmountsByDefault}
      groupNav={data.groupNav}
      entries={data.entries}
      missingPriced={data.missingPriced}
    />
  );
}
