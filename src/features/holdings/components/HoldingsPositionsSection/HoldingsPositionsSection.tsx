import { Archive, Wallet } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { HoldingsList } from "@/features/holdings/components/HoldingsList";
import {
  getClosedHoldings,
  getOpenHoldings,
} from "@/features/holdings/queries";

type HoldingsPositionsSectionProps = {
  status: "open" | "closed";
};

// Container async — vùng data riêng cho danh sách vị thế, stream độc lập với StatCard tổng vốn.
// Chỉ derive + serialize đúng status của route hiện tại (không tính cả 2 như trước).
async function HoldingsPositionsSection({
  status,
}: HoldingsPositionsSectionProps) {
  const holdings =
    status === "open" ? await getOpenHoldings() : await getClosedHoldings();

  if (holdings.length === 0) {
    return status === "open" ? (
      <EmptyState
        icon={Wallet}
        title="Chưa có vị thế nào đang mở"
        description="Thêm giao dịch mua để mở lại vị thế."
      />
    ) : (
      <EmptyState
        icon={Archive}
        title="Chưa có vị thế nào đã đóng"
        description="Vị thế đóng khi bạn bán hết số lượng đang giữ."
      />
    );
  }

  return <HoldingsList holdings={holdings} />;
}

export { HoldingsPositionsSection };
export type { HoldingsPositionsSectionProps };
