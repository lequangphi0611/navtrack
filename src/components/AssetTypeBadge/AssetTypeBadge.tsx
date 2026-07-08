import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Nguồn tạm thời: khi Prisma schema có enum AssetType thật (Phase 1), thay thế/map lại union này.
type AssetType = "STOCK" | "FUND" | "BOND" | "GOLD";

type AssetTypeBadgeProps = {
  assetType: AssetType;
  className?: string;
};

const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  STOCK: "Cổ phiếu",
  FUND: "Quỹ mở",
  BOND: "Trái phiếu",
  GOLD: "Vàng",
};

const ASSET_TYPE_COLOR_VAR: Record<AssetType, string> = {
  STOCK: "var(--color-asset-stock)",
  FUND: "var(--color-asset-fund)",
  BOND: "var(--color-asset-bond)",
  GOLD: "var(--color-asset-gold)",
};

function AssetTypeBadge({ assetType, className }: AssetTypeBadgeProps) {
  return (
    <Badge variant="neutral" className={cn("gap-1.5", className)}>
      <span
        className="size-1.5 rounded-sm"
        style={{ backgroundColor: ASSET_TYPE_COLOR_VAR[assetType] }}
      />
      <span className="text-foreground-soft">
        {ASSET_TYPE_LABEL[assetType]}
      </span>
    </Badge>
  );
}

export { AssetTypeBadge };
export type { AssetType, AssetTypeBadgeProps };
