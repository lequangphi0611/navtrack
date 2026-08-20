import { saveNavOverride } from "@/features/holdings/actions";
import { NavOverrideForm } from "@/features/holdings/components/NavOverrideForm";
import { getHoldingForPricing } from "@/features/holdings/queries";
import { formatDate } from "@/lib/format";
import { ROUTES, resolveBackHref } from "@/lib/routes";
import { getLatestNavOverrides } from "@/lib/valuation";

type NavOverridePageProps = {
  params: Promise<{ id: string }>;
  // ?from=<path> — route có 3 lối vào: entry đúng (nút "Nhập giá tay" ở
  // HoldingDetailScreen) không truyền from, fallback về ROUTES.holdingDetail
  // như cũ; Dashboard (MissingPriceList/ManualPriceList) và /allocation/stock
  // (StockAllocationDetail) gắn `from=<path nguồn>` để quay lại đúng màn —
  // xem lib/routes.ts.
  searchParams: Promise<{ from?: string }>;
};

export default async function NavOverridePage({
  params,
  searchParams,
}: NavOverridePageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const closeHref = resolveBackHref(from, ROUTES.holdingDetail(id));
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
      closeHref={closeHref}
      action={saveNavOverride}
    />
  );
}
