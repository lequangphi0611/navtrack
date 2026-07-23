import { HoldingsSummaryCard } from "@/features/holdings/components/HoldingsSummaryCard";
import { getHideAmountsByDefault } from "@/features/settings/queries";
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
//
// hidden (mục 8/11 phase-6.md): route này KHÔNG có nút mắt riêng (chỉ Dashboard
// header + Cài đặt có toggle tương tác) — đọc thẳng User.hideAmountsByDefault mỗi
// lần render, revalidatePath("/holdings") đã được setHideAmountsByDefault() gọi nên
// giá trị luôn tươi khi user điều hướng qua lại.
async function HoldingsSummarySection() {
  const [valuation, hidden] = await Promise.all([
    getPortfolioValuation(await getCutoffSelection()),
    getHideAmountsByDefault(),
  ]);

  return (
    <HoldingsSummaryCard
      navValue={valuation.navValue}
      totalCostBasis={valuation.totalCostBasis}
      absolutePnl={valuation.absolutePnl}
      absolutePnlPercent={valuation.navDeltaPercent}
      xirr={valuation.xirr}
      hidden={hidden}
    />
  );
}

export { HoldingsSummarySection };
