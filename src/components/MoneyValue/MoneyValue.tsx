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
  // TODO(format): chuyển sang lib/format.ts formatMoney() khi helper chung được tạo
  // (xem docs/rules/component-architecture.md#format-locale). lib/format.ts chưa tồn tại.
  const formatted = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums",
          className,
        )}
      >
        {hidden ? "••••••" : formatted}
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
