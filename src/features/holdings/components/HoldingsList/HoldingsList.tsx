import { HoldingRow } from "@/features/holdings/components/HoldingRow";

import type { HoldingSummary } from "../../types";

type HoldingsListProps = {
  holdings: HoldingSummary[];
};

function HoldingsList({ holdings }: HoldingsListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {holdings.map((holding) => (
        <HoldingRow key={holding.id} holding={holding} />
      ))}
    </div>
  );
}

export { HoldingsList };
export type { HoldingsListProps };
