import { Pencil } from "lucide-react";
import Link from "next/link";

import { ASSET_TYPE_TINT_CLASS } from "@/components/AssetTypeBadge";
import { buttonVariants } from "@/components/ui/button";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import type { ManualPriceHolding } from "@/lib/portfolio-valuation";
import { cn } from "@/lib/utils";

type ManualPriceListProps = {
  holdings: ManualPriceHolding[];
  className?: string;
};

// Danh sách các vị thế đang mở, ĐANG dùng giá nhập tay (NavOverride) tại mốc
// chốt hiện tại — khác MissingPriceList (vốn CHƯA có giá nào). Đây chỉ là
// thông tin trung thực về nguồn giá, không phải cảnh báo, nên tông màu trung
// tính (mirror khối `priceFreshnessNote` trong DashboardScreen), KHÔNG dùng
// warning/amber như MissingPriceList.
function ManualPriceList({ holdings, className }: ManualPriceListProps) {
  if (holdings.length === 0) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 p-3.75">
        <Pencil className="size-4.75 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-foreground">
            Đang dùng giá nhập tay
          </div>
          <div className="mt-0.5 text-[11px] text-muted-faint">
            {holdings.length} mã đang định giá bằng giá nhập tay
          </div>
        </div>
      </div>

      {holdings.map((holding) => (
        <div
          key={holding.id}
          className="flex items-center gap-2.75 border-t border-border p-2.75 pl-3.75"
        >
          <SymbolAvatar
            symbol={holding.symbol}
            size="sm"
            colorClassName={ASSET_TYPE_TINT_CLASS[holding.type]}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {holding.name}
            </div>
            <div className="truncate text-[11px] text-muted-faint">
              Nhập lần cuối {holding.priceDateLabel}
            </div>
          </div>
          <Link
            href={holding.href}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "shrink-0 rounded-full font-semibold",
            )}
          >
            Cập nhật giá
          </Link>
        </div>
      ))}
    </div>
  );
}

export { ManualPriceList };
export type { ManualPriceListProps };
