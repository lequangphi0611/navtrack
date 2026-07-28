import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type BreakdownRow = {
  label: string;
  sublabel?: string;
  value: string;
  valueClassName?: string;
};

type PreviewBreakdownCardProps = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  rows: BreakdownRow[];
  footer: {
    label: string;
    value: string;
    bgClassName: string; // nền highlight của dòng footer
    textClassName: string; // màu chữ dùng chung cho cả label lẫn value
  };
};

// Card breakdown (header icon+title, N hàng label/value, 1 hàng footer
// highlight) — CASH ("Tự tính số tiền nhận về": gộp/thuế/net) và STOCK ("Số
// lượng nắm giữ thay đổi": đang giữ/CP thưởng/sau khi ghi) CÙNG SHAPE, chỉ
// khác data — nhận props thuần, không biết DividendType (docs/rules/
// component-architecture.md mục "Biến thiên theo enum nghiệp vụ lặp lại").
function PreviewBreakdownCard({
  icon: Icon,
  iconClassName,
  title,
  rows,
  footer,
}: PreviewBreakdownCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-1.75 border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
        <Icon className={cn("size-3.75", iconClassName)} />
        {title}
      </div>
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={cn(
            "flex items-center justify-between px-3.75 py-2.75",
            index > 0 && "border-t border-white/4.5",
          )}
        >
          <span className="text-[13px] text-muted-foreground">
            {row.label}{" "}
            {row.sublabel ? (
              <span className="text-[11px] text-muted-faint">
                {row.sublabel}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "font-mono text-sm font-semibold text-foreground",
              row.valueClassName,
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
      <div
        className={cn(
          "flex items-center justify-between border-t border-white/7 px-3.75 py-3.25",
          footer.bgClassName,
        )}
      >
        <span
          className={cn("text-[13.5px] font-semibold", footer.textClassName)}
        >
          {footer.label}
        </span>
        <span
          className={cn("font-mono text-lg font-bold", footer.textClassName)}
        >
          {footer.value}
        </span>
      </div>
    </div>
  );
}

export { PreviewBreakdownCard };
export type { PreviewBreakdownCardProps };
