import { ASSET_TYPE_TINT_CLASS } from "@/components/AssetTypeBadge";
import { ConcentrationBadge } from "@/components/ConcentrationBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import type { ConcentrationBadgeState } from "@/lib/concentration";
import { formatPercent } from "@/lib/format";

type StockAllocationRowData = {
  holdingId: string;
  symbol: string;
  name: string;
  // Đã format qua formatMoney(), tôn trọng cờ hidden (process/UI_stock-allocation-detail.md).
  navLabel: string;
  // 0-100, mẫu số = NAV nhóm cổ phiếu (KHÔNG bị ẩn theo cờ ẩn tiền — chỉ VND
  // tuyệt đối mới ẩn, xem component-architecture.md "Đặc thù Navtrack").
  percent: number;
  // Badge amber CŨ (lib/concentration.ts) — mẫu số KHÁC (NAV toàn danh mục),
  // undefined = dưới ngưỡng, không hiện badge.
  concentrationBadge?: ConcentrationBadgeState;
};

type StockAllocationRowProps = StockAllocationRowData;

// Dòng danh sách của StockAllocationDetail (mockup 131a-c) — khác HoldingListItem:
// số % lớn cột phải luôn màu asset-stock (mẫu số CỐ ĐỊNH là NAV nhóm cổ phiếu,
// không đổi theo loại tài sản của dòng), kèm thanh tỉ lệ ngang riêng (khác
// AllocationBar nhiều-segment ở AllocationScreen).
function StockAllocationRow({
  symbol,
  name,
  navLabel,
  percent,
  concentrationBadge,
}: StockAllocationRowProps) {
  const barWidth = Math.min(100, Math.max(0, percent));

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-3">
        <SymbolAvatar
          symbol={symbol}
          colorClassName={ASSET_TYPE_TINT_CLASS.STOCK}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {symbol}
            </span>
            <span className="truncate text-xs text-muted-faint">{name}</span>
            {concentrationBadge ? (
              <ConcentrationBadge state={concentrationBadge} showNote={false} />
            ) : null}
          </div>
          <div className="mt-0.75 font-mono text-xs text-muted-foreground tabular-nums">
            {navLabel}
          </div>
        </div>
        <div className="pl-1.5 text-right">
          <div className="font-mono text-lg font-semibold text-asset-stock tabular-nums">
            {formatPercent(percent)}
          </div>
          <div className="mt-0.25 text-[9.5px] font-semibold text-muted-faint">
            trong nhóm CP
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-linear-to-r from-asset-stock to-asset-stock/70"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

export { StockAllocationRow };
export type { StockAllocationRowData, StockAllocationRowProps };
