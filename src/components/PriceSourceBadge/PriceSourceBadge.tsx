import { Pencil, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Khớp docs/domain/04-pricing-and-valuation.md: nguồn giá luôn là "tự động"
// (vnstock, PriceQuote) hoặc "nhập tay" (NavOverride) — UI phải ghi rõ nguồn.
type PriceSource = "AUTO" | "MANUAL";

type PriceSourceBadgeProps = {
  source: PriceSource;
  className?: string;
};

const CONFIG: Record<
  PriceSource,
  { icon: typeof Zap; label: string; variant: "gain" | "warning" }
> = {
  AUTO: { icon: Zap, label: "Tự động", variant: "gain" },
  MANUAL: { icon: Pencil, label: "Nhập tay", variant: "warning" },
};

// Badge nguồn giá dùng chung (mockup 2b header nhóm, 2c NAV hero, 2d selector) —
// "warning" variant ánh xạ token màu, không hardcode hex dù mockup dùng cùng hex
// với asset-gold (trùng ngẫu nhiên, xem ghi chú token --warning ở globals.css).
function PriceSourceBadge({ source, className }: PriceSourceBadgeProps) {
  const { icon: Icon, label, variant } = CONFIG[source];

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon />
      {label}
    </Badge>
  );
}

export { PriceSourceBadge };
export type { PriceSource, PriceSourceBadgeProps };
