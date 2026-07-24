"use client";

import { ChevronRight, Droplet } from "lucide-react";
import { useState } from "react";

import { formatMoney, formatPercent, signColorClass } from "@/lib/format";
import type { CostDragBreakdownEntry } from "@/lib/portfolio-valuation";
import { cn } from "@/lib/utils";

import { CostDragSheet } from "../CostDragSheet";

type PnlCostDragCardProps = {
  // Decimal đã serialize — lãi/lỗ thực nhận (đã trừ thuế + phí), có thể âm.
  pnlValue: string;
  pnlNote?: string;
  // Bất biến (issue #67): realizedPnl + unrealizedPnl ≈ pnlValue (absolutePnl).
  // realizedPnl: lãi/lỗ đã chốt thật (đã bán + cổ tức tiền mặt).
  // unrealizedPnl: lãi/lỗ trên giấy (vị thế đang mở, chưa bán).
  realizedPnl: string;
  unrealizedPnl: string;
  costDragAmount: string;
  costDragPercent: number;
  // grossInvested + costDragBreakdown: cần để render CostDragSheet (mở từ
  // dòng "Chi phí ăn mòn" bên dưới) — sheet được quản lý NGAY TRONG component
  // này (process/phase-5-plan-DRAFT.md mục B4), không phải sibling riêng ở
  // DashboardScreen.
  grossInvested: string;
  costDragBreakdown: CostDragBreakdownEntry[];
  hidden?: boolean;
};

// Card full-width "Lãi/lỗ (thực nhận)" (mockup 5d) — thay thế nửa PnL của
// ReturnMetrics cũ trên Dashboard (process/phase-5-plan-DRAFT.md mục B3).
// KHÔNG dùng cho HoldingDetailScreen (màn đó vẫn giữ ReturnMetrics nguyên bản).
function PnlCostDragCard({
  pnlValue,
  pnlNote,
  realizedPnl,
  unrealizedPnl,
  costDragAmount,
  costDragPercent,
  grossInvested,
  costDragBreakdown,
  hidden = false,
}: PnlCostDragCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pnlNumber = Number(pnlValue);
  const realizedPnlNumber = Number(realizedPnl);
  const unrealizedPnlNumber = Number(unrealizedPnl);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-4.5">
        <div className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">
          Lãi/lỗ (thực nhận)
        </div>
        <span
          className={cn(
            "font-mono text-2xl leading-none font-bold tabular-nums",
            signColorClass(pnlNumber),
          )}
        >
          {formatMoney(pnlValue, { hidden })}
        </span>
        {pnlNote ? (
          <div className="mt-1.5 text-[10.5px] text-muted-faint">{pnlNote}</div>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px]">
          <div>
            <span className="text-muted-faint">Đã thực hiện: </span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                signColorClass(realizedPnlNumber),
              )}
            >
              {formatMoney(realizedPnl, { hidden })}
            </span>
          </div>
          <div>
            <span className="text-muted-faint">Chưa thực hiện: </span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                signColorClass(unrealizedPnlNumber),
              )}
            >
              {formatMoney(unrealizedPnl, { hidden })}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex w-full items-center gap-2.5 border-t border-border bg-white/2 px-4.5 py-3 text-left"
      >
        <Droplet className="size-4.25 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Chi phí ăn mòn
          </div>
          <div className="mt-0.5 font-mono text-[10.5px] text-muted-faint">
            Thuế + phí đã ăn{" "}
            <span className="font-semibold text-warning">
              {formatPercent(costDragPercent)}
            </span>{" "}
            vốn đã bỏ ra mua
          </div>
        </div>
        <span className="shrink-0 font-mono text-[13px] font-semibold text-foreground tabular-nums">
          {formatMoney(costDragAmount, { hidden, compact: true })}
        </span>
        <ChevronRight className="size-4.5 shrink-0 text-muted-faint" />
      </button>

      <CostDragSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        costDragAmount={costDragAmount}
        costDragPercent={costDragPercent}
        grossInvested={grossInvested}
        breakdown={costDragBreakdown}
        hidden={hidden}
      />
    </div>
  );
}

export { PnlCostDragCard };
export type { PnlCostDragCardProps };
