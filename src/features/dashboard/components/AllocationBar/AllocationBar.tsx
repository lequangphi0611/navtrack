import {
  type AssetType,
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
} from "@/components/AssetTypeBadge";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type AllocationSlice = {
  type: AssetType;
  // 0-100, tổng các slice không bắt buộc = 100 (làm tròn hiển thị — Container tự tính từ NAV thật).
  percent: number;
};

type AllocationBarProps = {
  slices: AllocationSlice[];
  className?: string;
};

// Thanh phân bổ NAV theo loại tài sản (mockup 2a) — chỉ dùng ở Dashboard nên đặt
// trong feature/dashboard, không đưa lên components/ chung (chưa có nơi khác dùng lại).
function AllocationBar({ slices, className }: AllocationBarProps) {
  if (slices.length === 0) return null;

  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <div className="mb-2.75 flex items-center justify-between">
        <div className="text-[12.5px] font-semibold text-muted-foreground">
          Phân bổ theo loại
        </div>
        <div className="font-mono text-[11px] text-muted-faint tabular-nums">
          {slices.length} loại
        </div>
      </div>
      <div className="flex h-2.25 gap-0.5 overflow-hidden rounded-full">
        {slices.map((slice) => (
          <div
            key={slice.type}
            className={cn(ASSET_TYPE_DOT_CLASS[slice.type])}
            style={{ width: `${slice.percent}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {slices.map((slice) => (
          <div key={slice.type} className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-sm",
                ASSET_TYPE_DOT_CLASS[slice.type],
              )}
            />
            <span className="text-[11.5px] text-muted-foreground">
              {ASSET_TYPE_LABEL[slice.type]}{" "}
              <span className="font-mono tabular-nums">
                {formatPercent(slice.percent)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { AllocationBar };
export type { AllocationBarProps, AllocationSlice };
