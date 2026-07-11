import {
  Calendar,
  CalendarCheck,
  CalendarRange,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// docs/domain/05-returns-xirr-and-pnl.md: mốc chốt chọn được hôm nay/cuối tháng/
// cuối năm/tùy chỉnh — KHÔNG phải Setting (app read-only với bảng đó, xem
// docs/domain/09-settings.md); nơi lưu lựa chọn của user để TBD, business-implementer
// xác nhận (cookie/URL param/field User mới), xem process/UI_phase_2.md.
type CutoffKey = "TODAY" | "END_OF_MONTH" | "END_OF_YEAR";

type CutoffOption = {
  key: CutoffKey;
  label: string;
  date: string;
  // "+18,4%/năm" — Container tính trước XIRR cho từng mốc cố định để preview.
  xirrLabel: string;
  // Link điều hướng thật (vd `${ROUTES.settings}?cutoff=TODAY`) — chọn mốc chốt
  // là server round-trip (giống HoldingsSegmentedNav), không giữ state client.
  href: string;
};

type CutoffPickerProps = {
  selected: CutoffKey | "CUSTOM";
  options: CutoffOption[];
  // Đích luồng chọn ngày tuỳ chỉnh — Container quyết định (chưa có route thật).
  customHref: string;
  // Hiện khi selected === "CUSTOM".
  customDateLabel?: string;
  className?: string;
};

const OPTION_ICON: Record<CutoffKey, typeof Calendar> = {
  TODAY: Calendar,
  END_OF_MONTH: CalendarRange,
  END_OF_YEAR: CalendarCheck,
};

// Danh sách chọn mốc chốt định giá (mockup 2e) — Link thật, active theo prop
// "selected" (không usePathname vì cùng 1 route /settings, khác nhau ở query).
function CutoffPicker({
  selected,
  options,
  customHref,
  customDateLabel,
  className,
}: CutoffPickerProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {options.map((option) => {
        const isActive = option.key === selected;
        const Icon = OPTION_ICON[option.key];
        return (
          <Link
            key={option.key}
            href={option.href}
            className={cn(
              "flex items-center gap-2.75 rounded-xl border px-3.25 py-3",
              isActive
                ? "border-primary/40 bg-primary/12"
                : "border-border bg-background",
            )}
          >
            <Icon
              className={cn(
                "size-4.75",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-foreground">
                {option.label}
              </div>
              <div className="mt-px font-mono text-[11px] text-muted-faint">
                {option.date} · XIRR {option.xirrLabel}
              </div>
            </div>
            <CircleDot
              className={cn(
                "size-4.75",
                isActive ? "text-primary" : "text-muted-faint",
              )}
              strokeWidth={isActive ? 2.5 : 1.5}
              fill={isActive ? "currentColor" : "none"}
            />
          </Link>
        );
      })}

      <Link
        href={customHref}
        className={cn(
          "flex items-center gap-2.75 rounded-xl border px-3.25 py-3",
          selected === "CUSTOM"
            ? "border-primary/40 bg-primary/12"
            : "border-border bg-background",
        )}
      >
        <Calendar
          className={cn(
            "size-4.75",
            selected === "CUSTOM" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-foreground">
            Tùy chỉnh…
          </div>
          <div className="mt-px text-[11px] text-muted-faint">
            {selected === "CUSTOM" && customDateLabel
              ? customDateLabel
              : "Chọn ngày bất kỳ"}
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-faint" />
      </Link>
    </div>
  );
}

export { CutoffPicker };
export type { CutoffKey, CutoffOption, CutoffPickerProps };
