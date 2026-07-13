import { HoldingsSummaryCard } from "@/features/holdings/components/HoldingsSummaryCard";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";

// Container async — vùng data riêng cho HoldingsSummaryCard (NAV + lãi/lỗ + XIRR
// toàn danh mục, mockup 2b), stream độc lập với danh sách vị thế. Thay thế
// TotalInvestedSection (chỉ có vốn, Phase 1) — dùng CHUNG getPortfolioValuation()
// với Dashboard ("/") để NAV/XIRR/PnL luôn nhất quán giữa 2 màn cùng một mốc chốt.
//
// Field name khác nhau giữa PortfolioValuation và HoldingsSummaryCardProps nên map
// tường minh (không spread thẳng): navDeltaPercent -> absolutePnlPercent, totalCostBasis
// giữ nguyên tên nhưng là field riêng thêm vào PortfolioValuation cho đúng nhu cầu màn này.
async function HoldingsSummarySection() {
  const valuation = await getPortfolioValuation(await getCutoffSelection());

  return (
    <HoldingsSummaryCard
      navValue={valuation.navValue}
      totalCostBasis={valuation.totalCostBasis}
      absolutePnl={valuation.absolutePnl}
      absolutePnlPercent={valuation.navDeltaPercent}
      xirr={valuation.xirr}
    />
  );
}

export { HoldingsSummarySection };
