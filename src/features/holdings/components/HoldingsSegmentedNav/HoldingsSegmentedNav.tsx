"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type HoldingsSegmentedNavProps = {
  // Đếm số lượng mỗi tab (mockup 6g/6h: "Đang mở · 5" / "Đã đóng · 3") — cần
  // CẢ HAI số cùng lúc bất kể tab nào đang active, xem layout.tsx (query CHUNG,
  // dùng cache() nên không round-trip DB thêm — getOpenHoldings/getClosedHoldings
  // đã cache theo request).
  openCount: number;
  closedCount: number;
};

// Thay HoldingsTabs (client state) — tab giờ là navigation thật giữa 2 route
// (/holdings, /holdings/closed), không giữ state riêng nên back/refresh/URL đều đúng.
// <Link> mặc định prefetch khi vào viewport — cả 2 nav luôn hiển thị ngay nên không
// cần xử lý hover riêng.
function HoldingsSegmentedNav({
  openCount,
  closedCount,
}: HoldingsSegmentedNavProps) {
  const pathname = usePathname();

  const options = [
    { href: ROUTES.holdings, label: `Đang mở · ${openCount}` },
    { href: ROUTES.holdingsClosed, label: `Đã đóng · ${closedCount}` },
  ] as const;

  return (
    <div className="relative inline-flex self-start rounded-xl bg-background p-0.75">
      {options.map((option) => {
        const active = pathname === option.href;
        return (
          <Link
            key={option.href}
            href={option.href}
            className={cn(
              "relative rounded-lg px-4.5 py-1.5 text-[13px] font-semibold whitespace-nowrap tabular-nums transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export { HoldingsSegmentedNav };
export type { HoldingsSegmentedNavProps };
