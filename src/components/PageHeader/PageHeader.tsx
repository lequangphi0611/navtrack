import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  backHref: string;
  // "back" cho luồng điều hướng thường, "close" cho luồng dạng modal (vd form giao dịch)
  variant?: "back" | "close";
  className?: string;
};

function PageHeader({
  title,
  backHref,
  variant = "back",
  className,
}: PageHeaderProps) {
  const Icon = variant === "close" ? X : ArrowLeft;

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 border-b border-border pb-3",
        className,
      )}
    >
      <Link
        href={backHref}
        aria-label={variant === "close" ? "Đóng" : "Quay lại"}
        className="flex size-8 items-center justify-center rounded-[10px] bg-white/5 transition-colors hover:bg-white/10"
      >
        <Icon className="size-4.5 text-foreground-soft" />
      </Link>
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
