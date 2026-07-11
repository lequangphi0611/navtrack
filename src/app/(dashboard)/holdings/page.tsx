import { HoldingsEmptyState } from "@/features/holdings/components/HoldingsEmptyState";
import { HoldingsOverviewScreen } from "@/features/holdings/components/HoldingsOverviewScreen";
import { getHoldingsOverview } from "@/features/holdings/queries";
import { getSession } from "@/lib/auth";

export default async function HoldingsPage() {
  const session = await getSession();
  const displayName = session?.user?.name ?? session?.user?.email ?? "bạn";
  const { open, closed, totalInvested } = await getHoldingsOverview();

  if (open.length === 0 && closed.length === 0) {
    return <HoldingsEmptyState displayName={displayName} />;
  }

  return (
    <HoldingsOverviewScreen
      displayName={displayName}
      open={open}
      closed={closed}
      totalInvested={totalInvested}
    />
  );
}
