import { ArrowDownLeft, ArrowUpRight, Coins, Flag } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Một dòng trong timeline dòng tiền của chi tiết vị thế (mockup 2c). "CUTOFF_NAV"
// là dòng tiền GIẢ ĐỊNH = NAV tại mốc chốt (docs/domain/05-returns-xirr-and-pnl.md
// "ghép runtime lúc tính, không lưu DB") — Container tự đánh dấu, component chỉ
// tô khác màu, không tính toán gì thêm.
type CashflowTimelineRow = {
  id: string;
  kind: "BUY" | "SELL" | "DIVIDEND" | "CUTOFF_NAV";
  // "Mua 3.000 CP" / "NAV tại mốc chốt".
  label: string;
  // "09/07/2024 · giá 158.000" / "11/07/2026 · dòng tiền giả định".
  dateNote: string;
  // Decimal đã serialize, mang dấu (BUY âm, SELL/CUTOFF_NAV dương).
  amount: string;
};

type CashflowTimelineProps = {
  rows: CashflowTimelineRow[];
  // "Dòng tiền giả định = NAV mốc chốt, tính lúc chạy — không lưu vào sổ."
  footnote?: string;
  hidden?: boolean;
  className?: string;
};

const ICON_CLASS: Record<CashflowTimelineRow["kind"], string> = {
  BUY: "bg-destructive/12 text-destructive",
  SELL: "bg-gain/12 text-gain",
  DIVIDEND: "bg-accent/14 text-accent",
  CUTOFF_NAV: "bg-primary/18 text-primary",
};

function CashflowTimeline({
  rows,
  footnote,
  hidden = false,
  className,
}: CashflowTimelineProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có dòng tiền nào.</p>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row, index) => {
          const isNegative = Number(row.amount) < 0;
          const Icon =
            row.kind === "CUTOFF_NAV"
              ? Flag
              : row.kind === "DIVIDEND"
                ? Coins
                : row.kind === "SELL"
                  ? ArrowUpRight
                  : ArrowDownLeft;

          return (
            <div
              key={row.id}
              className={cn(
                "flex items-center gap-2.75 p-3.25",
                index > 0 && "border-t border-white/5",
                row.kind === "CUTOFF_NAV" && "border-t-primary/25 bg-primary/6",
              )}
            >
              <div
                className={cn(
                  "flex size-7.5 shrink-0 items-center justify-center rounded-[9px]",
                  ICON_CLASS[row.kind],
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground">
                  {row.label}
                </div>
                <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
                  {row.dateNote}
                </div>
              </div>
              <div
                className={cn(
                  "font-mono text-[12.5px] font-semibold tabular-nums",
                  row.kind === "CUTOFF_NAV"
                    ? "text-primary"
                    : isNegative
                      ? "text-destructive"
                      : "text-gain",
                )}
              >
                {isNegative ? "−" : "+"}
                {formatMoney(row.amount.replace("-", ""), {
                  hidden,
                  compact: true,
                })}
              </div>
            </div>
          );
        })}
      </div>
      {footnote ? (
        <div className="mt-2 text-[10.5px] leading-relaxed text-muted-faint">
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

export { CashflowTimeline };
export type { CashflowTimelineProps, CashflowTimelineRow };
