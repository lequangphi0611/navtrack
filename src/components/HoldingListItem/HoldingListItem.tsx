import { type AssetType, AssetTypeBadge } from "@/components/AssetTypeBadge";
import { ConcentrationBadge } from "@/components/ConcentrationBadge";
import { MoneyValue } from "@/components/MoneyValue";
import { PercentChange } from "@/components/PercentChange";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import type { ConcentrationBadgeState } from "@/lib/concentration";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type HoldingListItemProps = {
  symbol: string;
  name: string;
  assetType: AssetType;
  // Decimal đã serialize thành string ở biên server (xem docs/rules/data-prisma.md).
  quantity: string;
  // Đơn vị số lượng — lấy trực tiếp từ Holding.unit (Prisma), không suy ra từ assetType
  // để tránh hai nguồn dữ liệu lệch nhau (xem prisma/schema.prisma Holding.unit).
  unit: string;
  marketValue: string;
  annualReturnPercent?: number;
  // Vắng mặt = Holding dưới ngưỡng cảnh báo tập trung (mục 13 phase-6.md) —
  // Container merge từ getConcentrationBadges(), component không tự tính.
  concentrationBadge?: ConcentrationBadgeState;
  hidden?: boolean;
  className?: string;
};

function HoldingListItem({
  symbol,
  name,
  assetType,
  quantity,
  unit,
  marketValue,
  annualReturnPercent,
  concentrationBadge,
  hidden = false,
  className,
}: HoldingListItemProps) {
  const quantityLabel = formatQuantity(quantity, unit);

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5",
        className,
      )}
    >
      <SymbolAvatar symbol={symbol} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <AssetTypeBadge
            assetType={assetType}
            className="px-0 py-0 bg-transparent"
          />
          <span>·</span>
          <span>{quantityLabel}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <MoneyValue value={marketValue} hidden={hidden} className="text-sm" />
        {annualReturnPercent !== undefined ? (
          <PercentChange
            value={annualReturnPercent}
            variant="xirr"
            className="bg-transparent px-0 py-0 text-xs"
          />
        ) : null}
        {concentrationBadge ? (
          <ConcentrationBadge state={concentrationBadge} showNote={false} />
        ) : null}
      </div>
    </div>
  );
}

export { HoldingListItem };
export type { HoldingListItemProps };
