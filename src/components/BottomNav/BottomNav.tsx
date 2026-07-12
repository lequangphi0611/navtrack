import { LayoutDashboard, List, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type BottomNavTab = "dashboard" | "holdings" | "settings";

type BottomNavProps = {
  active: BottomNavTab;
  className?: string;
};

// Nhận "active" tường minh từ parent thay vì tự suy từ usePathname (khác
// HoldingsSegmentedNav) — /holdings/closed vẫn active tab "Danh mục" nên
// HoldingsOverviewScreen (dùng chung cho cả 2 route con) chỉ cần truyền cố định
// active="holdings" một lần, không cần so khớp nhiều path (mockup 2a/2b).
const TABS: {
  key: BottomNavTab;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  {
    key: "dashboard",
    href: ROUTES.dashboard,
    label: "Tổng quan",
    icon: LayoutDashboard,
  },
  { key: "holdings", href: ROUTES.holdings, label: "Danh mục", icon: List },
  {
    key: "settings",
    href: ROUTES.settings,
    label: "Cài đặt",
    icon: SettingsIcon,
  },
];

// Cố định đáy màn hình, dùng chung cho 3 màn gốc/tab (Tổng quan/Danh mục/Cài đặt) —
// KHÔNG gắn ở màn con/form (chi tiết vị thế, nhập giao dịch, mời thành viên...).
// Component thuần Link, không state/interaction nên giữ Server Component.
function BottomNav({ active, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-center px-6 pt-2.5 pb-6">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.75"
            >
              <Icon
                className={cn(
                  "size-5.5",
                  isActive ? "text-primary" : "text-muted-faint",
                )}
              />
              <span
                className={cn(
                  "text-[10.5px]",
                  isActive
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-faint",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { BottomNav };
export type { BottomNavProps, BottomNavTab };
