import { HoldingDetailScreen } from "@/features/holdings/components/HoldingDetailScreen";
import { getHoldingDetail } from "@/features/holdings/queries";

type HoldingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function HoldingDetailPage({
  params,
}: HoldingDetailPageProps) {
  const { id } = await params;
  const holding = await getHoldingDetail(id);

  // valuation (NAV/nguồn giá/XIRR/timeline) chưa wiring — getHoldingDetail() (Phase 1)
  // chưa trả các field này (cần PriceQuote/NavOverride/lib/xirr.ts, xem
  // process/UI_phase_2.md). HoldingDetailScreen tự rơi về hiển thị Phase 1 khi thiếu.
  return (
    <HoldingDetailScreen holding={holding} cashflows={holding.cashflows} />
  );
}
