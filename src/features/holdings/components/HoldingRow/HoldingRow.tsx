import Link from "next/link";

import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { MoneyValue } from "@/components/MoneyValue";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { OpenHolding } from "../../types";

type HoldingRowProps = {
  holding: OpenHolding;
  className?: string;
};

function HoldingRow({ holding, className }: HoldingRowProps) {
  return (
    <Link
      href={`/holdings/${holding.id}`}
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted",
        className,
      )}
    >
      <SymbolAvatar symbol={holding.symbol} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {holding.symbol}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <AssetTypeBadge
            assetType={holding.type}
            className="px-0 py-0 bg-transparent"
          />
          <span>·</span>
          <span>{formatQuantity(holding.quantity, holding.unit)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <MoneyValue value={holding.totalCostBasis} className="text-sm" />
        <span className="text-xs text-muted-foreground">
          Giá vốn {formatMoney(holding.avgCost)}
        </span>
      </div>
    </Link>
  );
}

export { HoldingRow };
export type { HoldingRowProps };
