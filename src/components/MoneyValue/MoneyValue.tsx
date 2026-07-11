import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MoneyValueToggleButton } from "./MoneyValueToggleButton";

type MoneyValueProps = {
  value: string;
  hidden?: boolean;
  onToggleHidden?: () => void;
  className?: string;
};

function MoneyValue({
  value,
  hidden = false,
  onToggleHidden,
  className,
}: MoneyValueProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums",
          className,
        )}
      >
        {formatMoney(value, { hidden })}
      </span>
      {onToggleHidden ? (
        <MoneyValueToggleButton
          hidden={hidden}
          onToggleHidden={onToggleHidden}
        />
      ) : null}
    </div>
  );
}

export { MoneyValue };
export type { MoneyValueProps };
