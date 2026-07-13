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

  return (
    <HoldingDetailScreen
      holding={holding}
      cashflows={holding.cashflows}
      valuation={holding.valuation}
    />
  );
}
