import type { XirrResult } from "@/components/ReturnMetrics";
import {
  formatMoney,
  formatSignedPercent,
  formatXirrLabel,
  signColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// Strip 2 card ngang đầu tab "Đã đóng" (mockup 6g) — tổng lãi/lỗ ĐÃ CHỐT của
// MỌI vị thế đã đóng + XIRR bình quân (weighted theo vốn mua vào, xem
// lib/weighted-average-xirr.ts — công thức thuộc business, component chỉ hiển thị).
type ClosedHoldingsSummaryStripProps = {
  totalRealizedPnl: string;
  averageXirrRealized: XirrResult | null;
  hidden?: boolean;
  className?: string;
};

function ClosedHoldingsSummaryStrip({
  totalRealizedPnl,
  averageXirrRealized,
  hidden = false,
  className,
}: ClosedHoldingsSummaryStripProps) {
  const pnlNumber = Number(totalRealizedPnl);

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div className="min-w-0 rounded-2xl border border-border bg-card p-3.75">
        <div className="mb-2 text-[11.5px] font-semibold text-muted-foreground">
          Lãi/lỗ đã chốt
        </div>
        <div
          className={cn(
            "font-mono text-[20px] leading-none font-semibold tabular-nums",
            signColorClass(pnlNumber),
          )}
        >
          {formatMoney(totalRealizedPnl, { hidden })}
        </div>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-card p-3.75">
        <div className="mb-2 text-[11.5px] font-semibold text-muted-foreground">
          XIRR bình quân
        </div>
        {averageXirrRealized && averageXirrRealized.status === "OK" ? (
          <div
            className={cn(
              "font-mono text-[20px] leading-none font-semibold tabular-nums",
              signColorClass(averageXirrRealized.percentPerYear),
            )}
          >
            {formatSignedPercent(averageXirrRealized.percentPerYear, {
              suffix: "/năm",
            })}
          </div>
        ) : (
          <div className="text-[15px] font-bold text-warning">
            {/* formatXirrLabel nhận XirrResult (không nhận null) — averageXirrRealized
                null nghĩa là KHÔNG vị thế nào tính được XIRR (khác NO_CONVERGE/
                NO_POSITIVE_FLOW của 1 vị thế cụ thể), nên fallback literal riêng cho
                ca đó, tái dùng formatXirrLabel cho ca còn lại (code review #10). */}
            {averageXirrRealized
              ? formatXirrLabel(averageXirrRealized)
              : "Chưa tính được"}
          </div>
        )}
      </div>
    </div>
  );
}

export { ClosedHoldingsSummaryStrip };
export type { ClosedHoldingsSummaryStripProps };
