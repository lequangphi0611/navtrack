import { Archive, Wallet } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { HoldingsList } from "@/features/holdings/components/HoldingsList";
import {
  getClosedHoldings,
  getOpenHoldingsWithValuation,
} from "@/features/holdings/queries";

type HoldingsPositionsSectionProps = {
  status: "open" | "closed";
};

// Container async — vùng data riêng cho danh sách vị thế, stream độc lập với HoldingsSummaryCard.
// Chỉ derive + serialize đúng status của route hiện tại (không tính cả 2 như trước).
// status="open" cần thêm NAV/nguồn giá/XIRR (getOpenHoldingsWithValuation) —
// status="closed" giữ nguyên getClosedHoldings() Phase 1 (vị thế đã bán hết
// không có "market value" đáng hiển thị, xem comment trong queries.ts).
async function HoldingsPositionsSection({
  status,
}: HoldingsPositionsSectionProps) {
  if (status === "open") {
    const { holdings, groupValuations } = await getOpenHoldingsWithValuation();

    if (holdings.length === 0) {
      return (
        <EmptyState
          icon={Wallet}
          title="Chưa có vị thế nào đang mở"
          description="Thêm giao dịch mua để mở lại vị thế."
        />
      );
    }

    return (
      <HoldingsList holdings={holdings} groupValuations={groupValuations} />
    );
  }

  const closed = await getClosedHoldings();

  if (closed.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Chưa có vị thế nào đã đóng"
        description="Vị thế đóng khi bạn bán hết số lượng đang giữ."
      />
    );
  }

  return <HoldingsList holdings={closed} />;
}

export { HoldingsPositionsSection };
export type { HoldingsPositionsSectionProps };
