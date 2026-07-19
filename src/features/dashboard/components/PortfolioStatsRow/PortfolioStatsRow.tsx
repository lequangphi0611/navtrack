import { Ban } from "lucide-react";

import type { XirrResult } from "@/components/ReturnMetrics";
import { formatMoney, formatSignedPercent, signColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";

type PortfolioStatsRowProps = {
  xirr: XirrResult;
  // Vốn GỘP đã triển khai (Σ|BUY.amount|) — KHÁC totalCostBasis (vốn ròng) đã
  // dùng ở nơi khác, hiển thị trực tiếp thành một chỉ số riêng (mockup 5d).
  grossInvested: string;
  hidden?: boolean;
  className?: string;
};

// Hàng 2 cột Dashboard-only (mockup 5d): "XIRR (sau thuế)" + "Vốn đã bỏ ra
// mua" — process/phase-5-plan-DRAFT.md mục B3. Tham khảo style thẻ XIRR của
// ReturnMetrics (@/components/ReturnMetrics) làm gốc nhưng KHÔNG import
// component đó — ReturnMetrics vẫn giữ nguyên 2 cột XIRR+PnL cho
// HoldingDetailScreen, không đổi ở Phase 5.
function PortfolioStatsRow({
  xirr,
  grossInvested,
  hidden = false,
  className,
}: PortfolioStatsRowProps) {
  const xirrUnavailable = xirr.status !== "OK";

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div
        className={cn(
          "min-w-0 rounded-2xl border p-3.75",
          xirrUnavailable
            ? "border-warning/24 bg-warning/7"
            : "border-border bg-card",
        )}
      >
        <div className="mb-1.25 text-[11.5px] font-medium text-muted-foreground">
          XIRR (sau thuế)
        </div>
        {xirr.status === "OK" ? (
          <div
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              signColorClass(xirr.percentPerYear),
            )}
          >
            {formatSignedPercent(xirr.percentPerYear, { suffix: "/năm" })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-warning">
            <Ban className="size-4" />
            <span className="text-[13px] font-bold">Chưa tính được</span>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-border bg-card p-3.75">
        <div className="mb-1.25 text-[11.5px] font-medium text-muted-foreground">
          Vốn đã bỏ ra mua
        </div>
        <div className="font-mono text-lg font-semibold text-foreground tabular-nums">
          {formatMoney(grossInvested, { hidden, compact: true })}
        </div>
      </div>
    </div>
  );
}

export { PortfolioStatsRow };
export type { PortfolioStatsRowProps };
