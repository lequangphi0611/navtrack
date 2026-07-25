import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { ClosedHoldingsSection } from "@/features/holdings/components/ClosedHoldingsSection";
import { HoldingsList } from "@/features/holdings/components/HoldingsList";
import { getOpenHoldingsWithValuation } from "@/features/holdings/queries";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { getConcentrationBadges } from "@/lib/portfolio-valuation";

type HoldingsPositionsSectionProps = {
  status: "open" | "closed";
};

// Container async — vùng data riêng cho danh sách vị thế, stream độc lập với HoldingsSummaryCard.
// Chỉ derive + serialize đúng status của route hiện tại (không tính cả 2 như trước).
// status="open": NAV/nguồn giá/XIRR (getOpenHoldingsWithValuation) + badge cảnh báo
// tập trung (getConcentrationBadges — mục 13 phase-6.md, merge theo holding.id, KHÔNG
// tính lại công thức riêng). status="closed": xem ClosedHoldingsSection (mục 12
// phase-6.md, dùng getClosedHoldingsDetail() — realized PnL/XIRR chốt/thời gian giữ,
// KHÔNG bao giờ có badge cảnh báo — vị thế đóng nằm ngoài phạm vi getConcentrationBadges).
async function HoldingsPositionsSection({
  status,
}: HoldingsPositionsSectionProps) {
  if (status === "open") {
    const [{ holdings, groupValuations }, concentration, hidden] =
      await Promise.all([
        getOpenHoldingsWithValuation(),
        getConcentrationBadges(),
        getHideAmountsByDefault(),
      ]);

    if (holdings.length === 0) {
      return (
        <EmptyState
          icon={Wallet}
          title="Chưa có vị thế nào đang mở"
          description="Thêm giao dịch mua để mở lại vị thế."
        />
      );
    }

    const withBadges = holdings.map((holding) => ({
      ...holding,
      concentrationBadge: concentration.badges.get(holding.id),
    }));

    return (
      <HoldingsList
        holdings={withBadges}
        groupValuations={groupValuations}
        hidden={hidden}
      />
    );
  }

  return <ClosedHoldingsSection />;
}

export { HoldingsPositionsSection };
export type { HoldingsPositionsSectionProps };
