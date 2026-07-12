import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/MoneyValue";
import { PercentChange } from "@/components/PercentChange";
import type { XirrResult } from "@/components/ReturnMetrics";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type HoldingsSummaryCardProps = {
  navValue: string;
  totalCostBasis: string;
  absolutePnl: string;
  absolutePnlPercent: number;
  xirr: XirrResult;
  hidden?: boolean;
  className?: string;
};

// Dòng tổng NAV + lãi/lỗ + XIRR ở đầu danh sách vị thế (mockup 2b) — thay thế
// TotalInvestedSection (chỉ có vốn, Phase 1) khi business-implementer cấp đủ dữ
// liệu định giá; hai component cùng tồn tại, Container chọn cái nào wiring.
function HoldingsSummaryCard({
  navValue,
  totalCostBasis,
  absolutePnl,
  absolutePnlPercent,
  xirr,
  hidden = false,
  className,
}: HoldingsSummaryCardProps) {
  const pnlNegative = Number(absolutePnl) < 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4.5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          NAV hôm nay
        </div>
        <div className="text-[11px] text-muted-faint">
          Vốn:{" "}
          <span className="font-mono tabular-nums">
            {formatMoney(totalCostBasis, { hidden })}
          </span>
        </div>
      </div>
      <MoneyValue
        value={navValue}
        hidden={hidden}
        className="mt-1 text-[23px]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge
          variant={pnlNegative ? "destructive" : "gain"}
          className="font-mono"
        >
          {formatMoney(absolutePnl, { hidden })}
        </Badge>
        <PercentChange value={absolutePnlPercent} />
        {xirr.status === "OK" ? (
          <PercentChange value={xirr.percentPerYear} variant="xirr" />
        ) : (
          <Badge variant="warning">XIRR chưa tính được</Badge>
        )}
      </div>
    </div>
  );
}

export { HoldingsSummaryCard };
export type { HoldingsSummaryCardProps };
