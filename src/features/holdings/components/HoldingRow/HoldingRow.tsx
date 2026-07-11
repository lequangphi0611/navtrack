import Link from "next/link";

import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { HoldingSummary } from "../../types";

type HoldingRowProps = {
  holding: HoldingSummary;
  className?: string;
};

function HoldingRow({ holding, className }: HoldingRowProps) {
  return (
    <Link
      href={ROUTES.holdingDetail(holding.id)}
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted",
        className,
      )}
    >
      <SymbolAvatar symbol={holding.symbol} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {holding.name ?? holding.symbol}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <AssetTypeBadge
            assetType={holding.type}
            className="px-2 py-px text-[11px]"
          />
          <span className="font-mono text-xs text-muted-faint tabular-nums">
            {formatQuantity(holding.quantity, holding.unit)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
          {formatMoney(holding.totalCostBasis)}
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-muted-faint">
          giá vốn TB{" "}
          <span className="font-mono tabular-nums">
            {formatMoney(holding.avgCost)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export { HoldingRow };
export type { HoldingRowProps };
