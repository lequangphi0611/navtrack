import { formatMoney, formatSignedPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavHistoryChartPoint = {
  label: string; // "T12" .. "T6" | "nay"
  heightPercent: number; // 0-100, Container tự tính từ value/max(values)
  isLive?: boolean; // true = cột cuối, pattern sọc "trực tiếp chưa lưu"
};

type NavHistoryChartProps = {
  navToday: string;
  changePercent: number;
  points: NavHistoryChartPoint[]; // 8 điểm, phần tử cuối isLive=true
  hidden?: boolean;
};

// Cột cuối (hôm nay, chưa lưu) tô sọc chéo thay vì màu đặc — dùng color-mix
// tham chiếu token --accent thay vì hardcode hex (khớp pattern button.tsx
// secondary hover), cùng class cho cả cột chart và ô chú thích bên dưới.
const LIVE_BAR_CLASS =
  "bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--accent)_55%,transparent)_0_4px,color-mix(in_oklch,var(--accent)_20%,transparent)_4px_8px)]";

// Mini bar chart 8 cột cho NAV theo mốc snapshot (mockup 3a) — Server Component
// thuần (CSS bar via inline style %, cùng pattern AllocationBar), không dùng
// Recharts vì chỉ minh hoạ xu hướng tĩnh, không cần tương tác/tooltip.
function NavHistoryChart({
  navToday,
  changePercent,
  points,
  hidden = false,
}: NavHistoryChartProps) {
  return (
    <div className="rounded-2xl border border-primary/24 bg-linear-to-br from-primary/14 to-card p-4">
      <div className="mb-3.5 flex items-baseline justify-between">
        <div>
          <div className="text-[11.5px] font-semibold text-muted-foreground">
            NAV hôm nay (trực tiếp)
          </div>
          <div className="mt-0.75 font-mono text-[22px] font-semibold text-foreground tabular-nums">
            {formatMoney(navToday, { hidden })}
          </div>
        </div>
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            changePercent < 0 ? "text-destructive" : "text-gain",
          )}
        >
          {formatSignedPercent(changePercent)}
        </span>
      </div>

      <div className="flex h-18.5 items-end gap-1.75">
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="flex flex-1 flex-col items-center gap-1.25"
          >
            <div
              className={cn(
                "w-full rounded-t-sm rounded-b-[2px]",
                point.isLive ? LIVE_BAR_CLASS : "bg-primary/40",
              )}
              style={{ height: `${point.heightPercent}%` }}
            />
            <span
              className={cn(
                "font-mono text-[8.5px]",
                point.isLive ? "text-primary" : "text-muted-faint",
              )}
            >
              {point.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-white/6 pt-2.75">
        <div className="flex items-center gap-1.25">
          <span className="size-2.25 rounded-[2px] bg-primary" />
          <span className="text-[10.5px] text-muted-foreground">
            Đã đóng băng
          </span>
        </div>
        <div className="flex items-center gap-1.25">
          <span className={cn("size-2.25 rounded-[2px]", LIVE_BAR_CLASS)} />
          <span className="text-[10.5px] text-muted-foreground">
            Trực tiếp · chưa lưu
          </span>
        </div>
      </div>
    </div>
  );
}

export { NavHistoryChart };
export type { NavHistoryChartPoint, NavHistoryChartProps };
