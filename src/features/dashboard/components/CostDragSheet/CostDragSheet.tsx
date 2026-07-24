"use client";

import { Droplet, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetPopup } from "@/components/ui/sheet";
import {
  formatCostDragPercent,
  formatMoney,
  formatPercent,
} from "@/lib/format";
import type { CostDragBreakdownEntry } from "@/lib/portfolio-valuation";
import { cn } from "@/lib/utils";

type CostDragSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costDragAmount: string;
  costDragPercent: number;
  grossInvested: string;
  breakdown: CostDragBreakdownEntry[];
  hidden?: boolean;
};

// source là enum thuần từ business layer (lib/portfolio-valuation.ts) — nhãn
// tiếng Việt gắn ở đây (tầng UI), cùng cách tách UI copy khỏi lib đã làm ở
// missingPriceReasonLabel (process/phase-5-plan-DRAFT.md mục A7).
const SOURCE_LABEL: Record<CostDragBreakdownEntry["source"], string> = {
  FEE: "Phí giao dịch",
  SALE_TAX: "Thuế bán",
  DIVIDEND_TAX: "Thuế cổ tức",
};

const SOURCE_NOTE: Record<CostDragBreakdownEntry["source"], string> = {
  FEE: "Phase 1 · mua + bán",
  SALE_TAX: "Phase 5 · % giá trị bán",
  DIVIDEND_TAX: "Phase 4 · % cổ tức tiền mặt",
};

const SOURCE_DOT_CLASS: Record<CostDragBreakdownEntry["source"], string> = {
  FEE: "bg-muted-foreground",
  SALE_TAX: "bg-primary",
  DIVIDEND_TAX: "bg-accent",
};

// Sheet chi tiết "chi phí ăn mòn" (mockup 5e) — process/phase-5-plan-DRAFT.md
// mục B4. Trigger từ dòng "Chi phí ăn mòn" trong PnlCostDragCard, open/
// onOpenChange controlled từ đó (đơn giản hơn TransactionHoldingPicker vì
// không cần điều khiển từ ngoài PnlCostDragCard).
function CostDragSheet({
  open,
  onOpenChange,
  costDragAmount,
  costDragPercent,
  grossInvested,
  breakdown,
  hidden = false,
}: CostDragSheetProps) {
  // costDragAmount = 0 (chưa phát sinh phí/thuế) -> mọi contributionPercent = 0
  // -> tổng = 0 -> KHÔNG chia cho tổng này để vẽ stacked bar (khác phép chia
  // của costDragPercent, xem process/phase-5-plan-DRAFT.md dòng 175).
  const totalContribution = breakdown.reduce(
    (sum, row) => sum + row.contributionPercent,
    0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup>
        <div className="mb-4 flex items-start gap-2.75">
          <div className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-warning/16">
            <Droplet className="size-5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16.5px] font-bold text-foreground">
              Chi phí ăn mòn
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-faint">
              Tổng thuế + phí đã trừ · tính tới hôm nay
            </div>
          </div>
        </div>

        <div className="mb-3.5 rounded-2xl border border-warning/24 bg-linear-to-br from-warning/10 to-card p-4">
          <div className="font-mono text-2xl font-bold text-warning tabular-nums">
            {formatMoney(costDragAmount, { hidden })}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            ={" "}
            <span className="font-semibold text-warning">
              {formatCostDragPercent(costDragPercent)}
            </span>{" "}
            vốn đã bỏ ra mua (
            {formatMoney(grossInvested, { hidden, compact: true })})
          </div>
        </div>

        {totalContribution > 0 ? (
          <div className="mb-3.5 flex h-2.75 gap-0.5 overflow-hidden rounded-full">
            {breakdown.map((row) => (
              <div
                key={row.source}
                className={cn("h-full", SOURCE_DOT_CLASS[row.source])}
                style={{ flex: row.contributionPercent }}
              />
            ))}
          </div>
        ) : (
          <div className="mb-3.5 h-2.75 rounded-full bg-muted" />
        )}

        <div className="mb-3.5 overflow-hidden rounded-2xl border border-border bg-card">
          {breakdown.map((row) => (
            <div
              key={row.source}
              className="flex items-center gap-3 border-b border-white/5 px-3.75 py-3 last:border-b-0"
            >
              <span
                className={cn(
                  "size-2.25 shrink-0 rounded-sm",
                  SOURCE_DOT_CLASS[row.source],
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground">
                  {SOURCE_LABEL[row.source]}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-muted-faint">
                  {SOURCE_NOTE[row.source]} ·{" "}
                  {formatPercent(row.contributionPercent)}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
                {formatMoney(row.amount, { hidden, compact: true })}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-white/2 px-3.75 py-3.5">
            <span className="flex-1 text-[13.5px] font-bold text-foreground">
              Tổng chi phí ăn mòn
            </span>
            <span className="font-mono text-[15px] font-bold text-warning tabular-nums">
              {formatMoney(costDragAmount, { hidden, compact: true })}
            </span>
          </div>
        </div>

        <div className="mb-4 flex gap-2.5 rounded-2xl border border-primary/18 bg-primary/6 p-3.5">
          <Info className="mt-0.5 size-4.25 shrink-0 text-primary" />
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            Chia trên{" "}
            <b className="text-foreground-soft">vốn gộp đã bỏ ra mua</b>{" "}
            (Σ|BUY.amount|), <b className="text-foreground-soft">không</b> phải
            vốn ròng — vốn ròng bị phần đã bán rút bớt nên khi bán nhiều sẽ làm
            % phình vô lý.
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          Đóng
        </Button>
      </SheetPopup>
    </Sheet>
  );
}

export { CostDragSheet };
export type { CostDragSheetProps };
