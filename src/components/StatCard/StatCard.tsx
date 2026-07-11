import { MoneyValue } from "@/components/MoneyValue";
import { PercentChange } from "@/components/PercentChange";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  percentChange?: number;
  percentVariant?: "gain-loss" | "xirr";
  // Ghi chú phụ mờ dưới giá trị (vd "Chưa có giá thị trường — lãi/lỗ & XIRR sẽ có ở bản sau.")
  note?: string;
  hidden?: boolean;
  className?: string;
};

function StatCard({
  label,
  value,
  percentChange,
  percentVariant = "gain-loss",
  note,
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
      {note ? (
        <div className="mt-1.5 text-[11.5px] leading-normal text-muted-faint">
          {note}
        </div>
      ) : null}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
