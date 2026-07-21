import { type AssetType, AssetTypeBadge } from "@/components/AssetTypeBadge";
import type { XirrResult } from "@/components/ReturnMetrics";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatSignedPercent, signColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";

// Dòng vị thế ĐÃ ĐÓNG (mockup 6g) — khác HoldingListItem/HoldingsGroupCard (vị
// thế đang mở): avatar tô theo DẤU lãi/lỗ (KHÔNG hash-theo-mã), badge trung
// tính "Đã bán hết", dòng phụ nêu thời gian giữ thay vì số lượng đang nắm.
// KHÔNG BAO GIỜ nhận badge cảnh báo tập trung (docs/domain/04 "Vị thế đóng").
type ClosedHoldingRowData = {
  id: string;
  symbol: string;
  name: string | null;
  type: AssetType;
  // "{N} tháng {M} ngày" — UI tự ghép câu "nắm {label}" (lib/holding-period.ts
  // chỉ trả số liệu thô, không kèm tiền tố).
  holdingPeriodLabel: string;
  realizedPnl: string;
  realizedPnlPercent: number;
  xirrRealized: XirrResult;
};

type ClosedHoldingRowProps = {
  holding: ClosedHoldingRowData;
  hidden?: boolean;
  onSelect: () => void;
  className?: string;
};

function ClosedHoldingRow({
  holding,
  hidden = false,
  onSelect,
  className,
}: ClosedHoldingRowProps) {
  const pnlNumber = Number(holding.realizedPnl);
  const isGain = pnlNumber >= 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted",
        className,
      )}
    >
      <SymbolAvatar
        symbol={holding.symbol}
        colorClassName={
          isGain ? "bg-gain/16 text-gain" : "bg-destructive/16 text-destructive"
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {holding.name ?? holding.symbol}
          </span>
          <Badge variant="neutral" className="shrink-0">
            Đã bán hết
          </Badge>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <AssetTypeBadge
            assetType={holding.type}
            className="bg-transparent px-0 py-0"
          />
          <span>·</span>
          <span>nắm {holding.holdingPeriodLabel}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            signColorClass(pnlNumber),
          )}
        >
          {formatMoney(holding.realizedPnl, { hidden })}
        </span>
        <span
          className={cn(
            "font-mono text-xs font-medium tabular-nums",
            signColorClass(pnlNumber),
          )}
        >
          {formatSignedPercent(holding.realizedPnlPercent)}
          {holding.xirrRealized.status === "OK"
            ? ` · XIRR ${formatSignedPercent(holding.xirrRealized.percentPerYear)}`
            : " · XIRR chưa tính được"}
        </span>
      </div>
    </button>
  );
}

export { ClosedHoldingRow };
export type { ClosedHoldingRowData, ClosedHoldingRowProps };
