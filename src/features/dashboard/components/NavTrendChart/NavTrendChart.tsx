"use client";

import { EyeOff, LineChart as LineChartIcon, Pointer } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type TooltipContentProps,
} from "recharts";

import { SegmentedControl } from "@/components/SegmentedControl";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatSignedPercent,
  signColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// Chuỗi NAV theo thời gian (mockup 6a/6b/6c) — data ĐÃ tải sẵn CẢ 3 kỳ
// (Tháng/Năm/Tất cả) từ Container (NavTrendChartSection), SegmentedControl chỉ
// đổi state client để CHỌN lại tập đã có, KHÔNG tách route/query param (giống
// ô tìm kiếm HoldingSwitcher) — tránh vấn đề "Suspense con không phản ứng lại
// state ẩn số tiền" (xem ghi chú kiến trúc trong PortfolioOverviewSection).
type NavTrendPeriod = "MONTH" | "YEAR" | "ALL";

type NavTrendPoint = {
  date: string; // ISO
  value: string; // NAV Decimal đã serialize
  changePercentFromStart: number; // % so với điểm đầu kỳ đang chọn
};

type NavTrendPeriodData = {
  points: NavTrendPoint[]; // rỗng/1 phần tử = biến thể 6b (chưa vẽ được đường)
  changePercent: number; // % header, theo kỳ tương ứng
};

type NavTrendChartProps = {
  data: Record<NavTrendPeriod, NavTrendPeriodData>;
  hidden?: boolean;
  // href SnapshotTodayCard trên cùng Dashboard — CTA ở biến thể rỗng cuộn mượt
  // tới đó thay vì dựng nút hành động trùng lặp (mockup 6b, digest mục 1).
  snapshotCardId?: string;
  className?: string;
};

const PERIOD_OPTIONS = [
  { value: "MONTH" as const, label: "Tháng" },
  { value: "YEAR" as const, label: "Năm" },
  { value: "ALL" as const, label: "Tất cả" },
];

function ChartTooltip({
  active,
  payload,
  hidden,
}: TooltipContentProps & { hidden: boolean }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as NavTrendPoint;

  return (
    <div className="rounded-xl border border-border bg-card-elevated p-2.75 shadow-lg">
      <div className="font-mono text-[10.5px] text-muted-faint tabular-nums">
        {formatDate(point.date)}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-semibold text-foreground tabular-nums">
        {formatMoney(point.value, { hidden })}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[11px] font-semibold tabular-nums",
          signColorClass(point.changePercentFromStart),
        )}
      >
        {formatSignedPercent(point.changePercentFromStart)} từ đầu kỳ
      </div>
    </div>
  );
}

function NavTrendChart({
  data,
  hidden = false,
  snapshotCardId = "snapshot-today-card",
  className,
}: NavTrendChartProps) {
  const [period, setPeriod] = useState<NavTrendPeriod>("YEAR");
  const { points, changePercent } = data[period];

  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-muted-foreground">
          Giá trị tài sản
        </div>
        <span
          className={cn(
            "rounded-full px-2.25 py-0.75 font-mono text-[11px] font-semibold tabular-nums",
            changePercent >= 0
              ? "bg-gain/14 text-gain"
              : "bg-destructive/14 text-destructive",
          )}
        >
          {formatSignedPercent(changePercent)}
        </span>
      </div>

      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={setPeriod}
        className="mb-3.5"
      />

      {points.length < 2 ? (
        <div className="rounded-xl border border-dashed border-white/14 p-5 text-center">
          <LineChartIcon className="mx-auto mb-2.5 size-7 text-muted-faint" />
          <div className="text-[13px] font-semibold text-foreground">
            Chưa vẽ được đường NAV
          </div>
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-faint">
            Cần ít nhất 2 mốc snapshot để nối thành đường. Hiện mới có{" "}
            {points.length} mốc (hôm nay).
          </div>
          {points[0] ? (
            <div className="mt-2.5 font-mono text-[11.5px] text-muted-foreground tabular-nums">
              {formatDate(points[0].date)} ·{" "}
              {formatMoney(points[0].value, { hidden })}
            </div>
          ) : null}
          <a
            href={`#${snapshotCardId}`}
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById(snapshotCardId)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="mt-3.5 inline-block rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground"
          >
            Chốt số liệu hôm nay
          </a>
        </div>
      ) : (
        <>
          <div className="relative">
            {hidden ? (
              <span className="absolute top-0 right-0 z-10 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <EyeOff className="size-2.75" />
                trục ẩn
              </span>
            ) : (
              <span className="absolute top-0 right-0 z-10 font-mono text-[10px] text-muted-faint tabular-nums">
                {formatMoney(points[points.length - 1]?.value ?? "0", {
                  compact: true,
                })}
              </span>
            )}
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart
                data={points}
                margin={{ top: 14, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="navTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0.32}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDayMonth(value)}
                  tick={{ fontSize: 10, fill: "var(--color-muted-faint)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                />
                <Tooltip
                  content={(props: TooltipContentProps) => (
                    <ChartTooltip {...props} hidden={hidden} />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#navTrendFill)"
                  dot={false}
                  activeDot={{ r: 4.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-faint">
            <Pointer className="size-3 shrink-0" />
            {hidden
              ? "Số tiền tạm ẩn — chạm giữ vẫn xem được xu hướng, không xem được số."
              : "Chạm giữ vào đường để xem NAV tại từng ngày."}
          </div>
        </>
      )}
    </div>
  );
}

export { NavTrendChart };
export type {
  NavTrendChartProps,
  NavTrendPeriod,
  NavTrendPeriodData,
  NavTrendPoint,
};
