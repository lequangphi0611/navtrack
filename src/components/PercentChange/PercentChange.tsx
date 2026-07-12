import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { formatSignedPercent } from "@/lib/format";
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
  // value === 0 khớp cả +0 lẫn -0 — coi cả hai là trung tính, không phải "gain".
  const isZero = value === 0;
  const isNegative = value < 0;
  const Icon = isZero ? Minus : isNegative ? TrendingDown : TrendingUp;

  const label = formatSignedPercent(value, {
    suffix: variant === "xirr" ? "/năm" : "",
  });

  const colorClass =
    variant === "xirr"
      ? "bg-primary/13 text-primary"
      : isZero
        ? "bg-muted text-muted-foreground"
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
