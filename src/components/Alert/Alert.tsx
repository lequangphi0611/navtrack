import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type AlertVariant = "info" | "error";

type AlertProps = {
  variant: AlertVariant;
  title: string;
  description?: string;
  className?: string;
};

function Alert({ variant, title, description, className }: AlertProps) {
  const Icon = variant === "error" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3.5",
        variant === "error"
          ? "border-destructive/20 bg-destructive/9"
          : "border-primary/20 bg-primary/8",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-px size-4.5 shrink-0",
          variant === "error" ? "text-destructive" : "text-primary",
        )}
      />
      <div>
        <div
          className={cn(
            "text-sm font-semibold",
            variant === "error" ? "text-destructive" : "text-primary",
          )}
        >
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert };
export type { AlertProps, AlertVariant };
