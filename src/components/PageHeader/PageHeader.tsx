import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  backHref: string;
  // "back" cho luồng điều hướng thường, "close" cho luồng dạng modal (vd form giao dịch)
  variant?: "back" | "close";
  // Dòng phụ dưới tiêu đề (vd "Nhập % → tự tính tiền nhận về" — DividendForm,
  // mockup Phase 4 Screens 4a/4c). Vắng mặt = giữ nguyên layout cũ (backward-
  // compatible, không đổi call site hiện có).
  subtitle?: React.ReactNode;
  // Composition slot bên phải tiêu đề (vd Badge "Chỉ xem" — mockup 3e). Vắng mặt
  // = giữ nguyên layout cũ (backward-compatible, không đổi call site hiện có).
  trailing?: React.ReactNode;
  className?: string;
};

function PageHeader({
  title,
  backHref,
  variant = "back",
  subtitle,
  trailing,
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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-0.25 truncate text-[11.5px] text-muted-faint">
            {subtitle}
          </div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
