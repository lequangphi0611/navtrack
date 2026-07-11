import type { LucideIcon } from "lucide-react";
import { ReceiptText } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

function EmptyState({
  icon: Icon = ReceiptText,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/12 bg-card p-6 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/12">
        <Icon className="size-6 text-primary" />
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description ? (
        <div className="mt-1.5 text-[12.5px] text-muted-foreground">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
