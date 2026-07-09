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

// Class Tailwind ánh xạ token (giống pattern src/components/SymbolAvatar/symbol-color.ts)
// thay vì inline style + raw var() — để dùng được modifier như opacity/dark:.
const ASSET_TYPE_DOT_CLASS: Record<AssetType, string> = {
  STOCK: "bg-asset-stock",
  FUND: "bg-asset-fund",
  BOND: "bg-asset-bond",
  GOLD: "bg-asset-gold",
};

function AssetTypeBadge({ assetType, className }: AssetTypeBadgeProps) {
  return (
    <Badge variant="neutral" className={cn("gap-1.5", className)}>
      <span
        className={cn("size-1.5 rounded-sm", ASSET_TYPE_DOT_CLASS[assetType])}
      />
      <span className="text-foreground-soft">
        {ASSET_TYPE_LABEL[assetType]}
      </span>
    </Badge>
  );
}

export { AssetTypeBadge };
export type { AssetType, AssetTypeBadgeProps };
