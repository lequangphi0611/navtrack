import { CircleDollarSign } from "lucide-react";
import Link from "next/link";

import {
  type AssetType,
  ASSET_TYPE_TINT_CLASS,
} from "@/components/AssetTypeBadge";
import { buttonVariants } from "@/components/ui/button";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { cn } from "@/lib/utils";

// Một vị thế chưa định giá được (docs/domain/04-pricing-and-valuation.md "Thiếu giá":
// không có cả PriceQuote lẫn NavOverride) — lý do khiến XIRR/NAV toàn danh mục
// không tính đủ (mockup 2f).
type MissingPriceHolding = {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  // "Trái phiếu · chưa có giá nhập tay" — Container ghép sẵn theo loại tài sản.
  reasonLabel: string;
  // Đích nút "Nhập giá" — Container quyết định (hiện tạm trỏ về chi tiết vị thế,
  // vì NavOverrideForm (mockup 2d) chưa có route thật, xem process/UI_phase_2.md).
  href: string;
};

type MissingPriceListProps = {
  holdings: MissingPriceHolding[];
  className?: string;
};

// Danh sách các mã thiếu giá thị trường + CTA nhập giá (mockup 2f) — chỉ Dashboard
// dùng nên đặt trong feature/dashboard.
function MissingPriceList({ holdings, className }: MissingPriceListProps) {
  if (holdings.length === 0) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-warning/22 bg-warning/6",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 p-3.75">
        <CircleDollarSign className="size-4.75 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-warning">
            Thiếu giá thị trường
          </div>
          <div className="mt-0.5 text-[11px] text-muted-faint">
            {holdings.length} mã cần giá để đưa vào NAV
          </div>
        </div>
      </div>

      {holdings.map((holding) => (
        <div
          key={holding.id}
          className="flex items-center gap-2.75 border-t border-warning/15 p-2.75 pl-3.75"
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
              {holding.reasonLabel}
            </div>
          </div>
          <Link
            href={holding.href}
            className={cn(
              buttonVariants({ size: "sm" }),
              "shrink-0 rounded-full bg-warning font-semibold text-warning-foreground hover:bg-warning/85",
            )}
          >
            Nhập giá
          </Link>
        </div>
      ))}
    </div>
  );
}

export { MissingPriceList };
export type { MissingPriceHolding, MissingPriceListProps };
