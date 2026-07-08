import { MoneyValue } from "@/components/MoneyValue";
import { PercentChange } from "@/components/PercentChange";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  percentChange?: number;
  percentVariant?: "gain-loss" | "xirr";
  hidden?: boolean;
  className?: string;
};

function StatCard({
  label,
  value,
  percentChange,
  percentVariant = "gain-loss",
  hidden = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <MoneyValue value={value} hidden={hidden} className="text-[19px]" />
      {percentChange !== undefined ? (
        <PercentChange
          value={percentChange}
          variant={percentVariant}
          className="mt-0.5 bg-transparent px-0 py-0"
        />
      ) : null}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
