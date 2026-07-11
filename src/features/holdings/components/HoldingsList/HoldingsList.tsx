import { groupHoldingsByType } from "@/features/holdings/group-holdings";

import { HoldingsGroupCard } from "../HoldingsGroupCard";
import type { HoldingSummary } from "../../types";

type HoldingsListProps = {
  holdings: HoldingSummary[];
};

// Gom nhóm theo loại tài sản (mockup 2d cập nhật): mỗi nhóm một card, có thể mở rộng.
function HoldingsList({ holdings }: HoldingsListProps) {
  const groups = groupHoldingsByType(holdings);

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => (
        <HoldingsGroupCard
          key={group.type}
          type={group.type}
          holdings={group.holdings}
          totalCostBasis={group.totalCostBasis}
        />
      ))}
    </div>
  );
}

export { HoldingsList };
export type { HoldingsListProps };
