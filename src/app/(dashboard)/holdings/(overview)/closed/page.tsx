import { Suspense } from "react";

import { ClosedHoldingsSectionSkeleton } from "@/features/holdings/components/ClosedHoldingsSection";
import { HoldingsPositionsSection } from "@/features/holdings/components/HoldingsPositionsSection";

export default function HoldingsClosedPage() {
  return (
    <Suspense fallback={<ClosedHoldingsSectionSkeleton />}>
      <HoldingsPositionsSection status="closed" />
    </Suspense>
  );
}
