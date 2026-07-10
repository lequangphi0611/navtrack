import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type SettingsMenuItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  className?: string;
};

// Dòng menu điều hướng cho màn Cài đặt (icon + nhãn + chevron) — dùng chung cho
// mọi mục settings trong tương lai (Phase 1 mới có "Thành viên").
function SettingsMenuItem({
  href,
  icon: Icon,
  label,
  className,
}: SettingsMenuItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted",
        className,
      )}
    >
      <Icon className="size-5 text-muted-foreground" />
      <span className="flex-1 text-sm font-semibold text-foreground">
        {label}
      </span>
      <ChevronRight className="size-4 text-muted-faint" />
    </Link>
  );
}

export { SettingsMenuItem };
export type { SettingsMenuItemProps };
