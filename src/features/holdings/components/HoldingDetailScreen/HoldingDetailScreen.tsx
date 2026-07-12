import { Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { type AssetType, AssetTypeBadge } from "@/components/AssetTypeBadge";
import { MoneyValue } from "@/components/MoneyValue";
import { PageHeader } from "@/components/PageHeader";
import {
  type PriceSource,
  PriceSourceBadge,
} from "@/components/PriceSourceBadge";
import { ReturnMetrics, type XirrResult } from "@/components/ReturnMetrics";
import { buttonVariants } from "@/components/ui/button";
import {
  CashflowTimeline,
  type CashflowTimelineRow,
} from "@/features/holdings/components/CashflowTimeline";
import { TransactionHistoryList } from "@/features/holdings/components/TransactionHistoryList";
import type { CashflowRow } from "@/features/holdings/types";
import { formatQuantity, formatMoney } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type HoldingDetailScreenHolding = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  unit: string;
  quantity: string;
  avgCost: string;
  totalCostBasis: string;
};

// Khối NAV + XIRR/PnL + timeline dòng tiền (mockup 2c) — optional vì
// getHoldingDetail() (Phase 1) chưa trả các field này (chưa có PriceQuote/
// NavOverride/lib/xirr.ts). Khi vắng mặt, màn hình giữ nguyên hành vi Phase 1
// (chỉ vốn đã bỏ vào + lịch sử giao dịch có thể sửa/xoá).
type HoldingValuation = {
  navValue: string;
  priceSource: PriceSource;
  // "Tự động · vnstock" / "Nhập tay".
  priceSourceLabel: string;
  // "Giá EOD 10/07: 178.900 · vốn TB 163.100".
  priceNote: string;
  xirr: XirrResult;
  absolutePnl: string;
  // Gồm cả dòng "NAV tại mốc chốt" giả định (kind: "CUTOFF_NAV") — Container tự
  // ghép, xem CashflowTimeline.
  timeline: CashflowTimelineRow[];
  timelineFootnote?: string;
};

type HoldingDetailScreenProps = {
  holding: HoldingDetailScreenHolding;
  cashflows: CashflowRow[];
  valuation?: HoldingValuation;
  hidden?: boolean;
};

// Organism cho /holdings/[id] — extract từ page.tsx (Phase 1 nhồi JSX trực tiếp,
// đã > 40 dòng) + mở rộng khối định giá Phase 2 (mockup 2c). page.tsx (Container)
// hiện CHƯA truyền `valuation` (getHoldingDetail chưa cấp đủ field), xem
// process/UI_phase_2.md — component tự rơi về hiển thị Phase 1 khi thiếu.
function HoldingDetailScreen({
  holding,
  cashflows,
  valuation,
  hidden = false,
}: HoldingDetailScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title={holding.symbol} backHref={ROUTES.holdings} />

      <div className="flex items-center gap-2">
        <AssetTypeBadge assetType={holding.type} />
        {holding.name ? (
          <span className="truncate text-sm text-muted-foreground">
            {holding.name}
          </span>
        ) : null}
        <span className="flex-1" />
        <Link
          href={ROUTES.navOverrideNew(holding.id)}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "gap-1 font-semibold",
          )}
        >
          <Pencil className="size-3.5" />
          Nhập giá tay
        </Link>
      </div>

      {valuation ? (
        <>
          <div className="rounded-2xl border border-primary/24 bg-linear-to-br from-primary/14 to-card p-4.25">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Giá trị hiện tại
              </div>
              <PriceSourceBadge source={valuation.priceSource} />
            </div>
            <MoneyValue
              value={valuation.navValue}
              hidden={hidden}
              className="text-[25px]"
            />
            <div className="mt-1.25 font-mono text-[11.5px] text-muted-faint">
              {valuation.priceNote}
            </div>
          </div>

          <ReturnMetrics
            xirr={valuation.xirr}
            pnlValue={valuation.absolutePnl}
            pnlLabel="Lãi/lỗ"
            hidden={hidden}
          />

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[12.5px] font-semibold text-muted-foreground">
                Dòng tiền
              </h2>
              <span className="text-[11px] text-muted-faint">
                {cashflows.length} giao dịch + NAV mốc chốt
              </span>
            </div>
            <CashflowTimeline
              rows={valuation.timeline}
              footnote={valuation.timelineFootnote}
              hidden={hidden}
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Tổng vốn đã bỏ vào
          </div>
          <MoneyValue value={holding.totalCostBasis} hidden={hidden} />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Số lượng</div>
              <div className="font-mono font-medium text-foreground tabular-nums">
                {formatQuantity(holding.quantity, holding.unit)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Giá vốn bình quân
              </div>
              <div className="font-mono font-medium text-foreground tabular-nums">
                {formatMoney(holding.avgCost)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Lịch sử giao dịch
        </h2>
        <Link
          href={ROUTES.newTransaction(holding.id)}
          className={cn(buttonVariants({ size: "sm" }), "gap-1 font-semibold")}
        >
          <Plus className="size-3.5" />
          Thêm giao dịch
        </Link>
      </div>

      <TransactionHistoryList
        holdingId={holding.id}
        unit={holding.unit}
        cashflows={cashflows}
      />
    </div>
  );
}

export { HoldingDetailScreen };
export type {
  HoldingDetailScreenHolding,
  HoldingDetailScreenProps,
  HoldingValuation,
};
