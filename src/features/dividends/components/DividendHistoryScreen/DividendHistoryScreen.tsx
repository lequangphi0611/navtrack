import { PageHeader } from "@/components/PageHeader";
import {
  DividendHistoryList,
  type DividendHistoryRow,
  type DividendHistorySummary,
} from "@/features/dividends/components/DividendHistoryList";

type DividendHistoryScreenHolding = {
  symbol: string;
  name: string | null;
};

type DividendHistoryScreenProps = {
  backHref: string;
  holding: DividendHistoryScreenHolding;
  summary: DividendHistorySummary;
  rows: DividendHistoryRow[];
  newDividendHref: string;
  hidden?: boolean;
};

// Organism cho /holdings/[id]/dividends (mockup Phase 4 Screens, 4e) — scope
// THEO TỪNG Holding (không portfolio-wide, khác /snapshots — xem
// process/UI_phase_4.md mục "Điểm lệch so với plan").
function DividendHistoryScreen({
  backHref,
  holding,
  summary,
  rows,
  newDividendHref,
  hidden = false,
}: DividendHistoryScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Lịch sử cổ tức"
        subtitle={`${holding.name ?? holding.symbol} · tiền mặt & cổ phiếu`}
        backHref={backHref}
      />

      <DividendHistoryList
        summary={summary}
        rows={rows}
        hidden={hidden}
        newDividendHref={newDividendHref}
      />
    </div>
  );
}

export { DividendHistoryScreen };
export type { DividendHistoryScreenHolding, DividendHistoryScreenProps };
