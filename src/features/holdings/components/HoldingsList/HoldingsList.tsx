import { groupHoldingsByType } from "@/features/holdings/group-holdings";

import {
  HoldingsGroupCard,
  type GroupValuation,
  type HoldingWithValuation,
} from "../HoldingsGroupCard";
import type { HoldingSummary } from "../../types";

type HoldingsListProps = {
  holdings: HoldingWithValuation[];
  // Phase 2: NAV/nguồn giá/% theo nhóm, keyed theo AssetType — vắng mặt = từng
  // HoldingsGroupCard tự rơi về hiển thị Phase 1 (chỉ vốn đã bỏ vào).
  groupValuations?: Partial<Record<HoldingSummary["type"], GroupValuation>>;
};

// Gom nhóm theo loại tài sản (mockup 2d cập nhật): mỗi nhóm một card, có thể mở rộng.
function HoldingsList({ holdings, groupValuations }: HoldingsListProps) {
  const groups = groupHoldingsByType(holdings);

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => (
        <HoldingsGroupCard
          key={group.type}
          type={group.type}
          holdings={group.holdings}
          totalCostBasis={group.totalCostBasis}
          groupValuation={groupValuations?.[group.type]}
        />
      ))}
    </div>
  );
}

export { HoldingsList };
export type { HoldingsListProps };
