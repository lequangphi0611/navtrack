import { saveNavOverride } from "@/features/holdings/actions";
import { NavOverrideForm } from "@/features/holdings/components/NavOverrideForm";
import { getHoldingForPricing } from "@/features/holdings/queries";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { getLatestNavOverrides } from "@/lib/valuation";

type NavOverridePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NavOverridePage({
  params,
}: NavOverridePageProps) {
  const { id } = await params;
  const holding = await getHoldingForPricing(id);

  const today = new Date();
  const latest = (await getLatestNavOverrides([id], today)).get(id);

  return (
    <NavOverrideForm
      holdingId={holding.id}
      symbol={holding.symbol}
      name={holding.name}
      assetType={holding.type}
      unit={holding.unit}
      quantity={holding.quantity}
      totalCostBasis={holding.totalCostBasis}
      lastManualPrice={
        latest
          ? {
              price: latest.price.toString(),
              appliedDate: formatDate(latest.date),
            }
          : undefined
      }
      defaultDateInputValue={today.toISOString().slice(0, 10)}
      closeHref={ROUTES.holdingDetail(id)}
      action={saveNavOverride}
    />
  );
}
