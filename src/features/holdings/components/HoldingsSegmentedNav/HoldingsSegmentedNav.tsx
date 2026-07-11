"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { href: ROUTES.holdings, label: "Đang mở" },
  { href: ROUTES.holdingsClosed, label: "Đã đóng" },
] as const;

// Thay HoldingsTabs (client state) — tab giờ là navigation thật giữa 2 route
// (/holdings, /holdings/closed), không giữ state riêng nên back/refresh/URL đều đúng.
// <Link> mặc định prefetch khi vào viewport — cả 2 nav luôn hiển thị ngay nên không
// cần xử lý hover riêng.
function HoldingsSegmentedNav() {
  const pathname = usePathname();

  return (
    <div className="relative inline-flex self-start rounded-xl bg-background p-0.75">
      {OPTIONS.map((option) => {
        const active = pathname === option.href;
        return (
          <Link
            key={option.href}
            href={option.href}
            className={cn(
              "relative rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-colors",
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
