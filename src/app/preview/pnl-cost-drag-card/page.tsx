import { PnlCostDragCard } from "@/features/dashboard/components/PnlCostDragCard";
import type { CostDragBreakdownEntry } from "@/lib/portfolio-valuation";

const BREAKDOWN: CostDragBreakdownEntry[] = [
  { source: "FEE", amount: "6180000", contributionPercent: 52 },
  { source: "SALE_TAX", amount: "3240000", contributionPercent: 28 },
  { source: "DIVIDEND_TAX", amount: "2360000", contributionPercent: 20 },
];

// Bấm dòng "Chi phí ăn mòn" để soi CostDragSheet mở từ đây (state open quản
// lý ngay trong PnlCostDragCard — process/phase-5-plan-DRAFT.md mục B3/B4).
export default function PnlCostDragCardPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      {/* Cả 2 phần đều lãi — realized + unrealized cùng dấu dương. */}
      <PnlCostDragCard
        pnlValue="412500000"
        pnlNote="Đã trừ cả thuế lẫn phí — số thực nhận, không phải trên giấy."
        realizedPnl="180000000"
        unrealizedPnl="232500000"
        costDragAmount="11780000"
        costDragPercent={0.41}
        grossInvested="2850000000"
        costDragBreakdown={BREAKDOWN}
      />

      {/* Đã thực hiện lãi nhưng vị thế đang mở đang lỗ — test màu khác dấu.
          Kèm splitNote — mốc chốt đang chọn khác hôm nay (pnlSplitIsApproximate). */}
      <PnlCostDragCard
        pnlValue="-14630000"
        pnlNote="Chỉ trên phần có giá — đã trừ thuế & phí."
        realizedPnl="20000000"
        unrealizedPnl="-34630000"
        splitNote="*Ước tính — có thể lệch khi xem theo mốc chốt khác hôm nay."
        costDragAmount="0"
        costDragPercent={0}
        grossInvested="0"
        costDragBreakdown={[
          { source: "FEE", amount: "0", contributionPercent: 0 },
          { source: "SALE_TAX", amount: "0", contributionPercent: 0 },
          { source: "DIVIDEND_TAX", amount: "0", contributionPercent: 0 },
        ]}
      />

      <PnlCostDragCard
        pnlValue="412500000"
        realizedPnl="180000000"
        unrealizedPnl="232500000"
        costDragAmount="11780000"
        costDragPercent={0.41}
        grossInvested="2850000000"
        costDragBreakdown={BREAKDOWN}
        hidden
      />
    </div>
  );
}
