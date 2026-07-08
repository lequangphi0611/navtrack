import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type PercentChangeProps = {
  value: number;
  variant?: "gain-loss" | "xirr";
  className?: string;
};

function PercentChange({
  value,
  variant = "gain-loss",
  className,
}: PercentChangeProps) {
  const isNegative = value < 0;
  const Icon = isNegative ? TrendingDown : TrendingUp;

  // TODO(format): chuyển sang lib/format.ts formatPercent() khi helper chung được tạo
  // (xem docs/rules/component-architecture.md#format-locale).
  const magnitude = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : isNegative ? "−" : "";
  const label = `${sign}${magnitude}%${variant === "xirr" ? "/năm" : ""}`;

  const colorClass =
    variant === "xirr"
      ? "bg-primary/13 text-primary"
      : isNegative
        ? "bg-destructive/12 text-destructive"
        : "bg-gain/12 text-gain";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[13px] font-semibold",
        colorClass,
        className,
      )}
    >
      <Icon className="size-3.75" />
      {label}
    </span>
  );
}

export { PercentChange };
export type { PercentChangeProps };
