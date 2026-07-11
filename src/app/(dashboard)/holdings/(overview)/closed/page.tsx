import { Suspense } from "react";

import { HoldingsListSkeleton } from "@/features/holdings/components/HoldingsList";
import { HoldingsPositionsSection } from "@/features/holdings/components/HoldingsPositionsSection";

export default function HoldingsClosedPage() {
  return (
    <Suspense fallback={<HoldingsListSkeleton />}>
      <HoldingsPositionsSection status="closed" />
    </Suspense>
  );
}
