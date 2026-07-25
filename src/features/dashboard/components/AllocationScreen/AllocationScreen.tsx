"use client";

import { ChevronRight, PieChart as PieChartIcon } from "lucide-react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import {
  type AssetType,
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
} from "@/components/AssetTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatPercent } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

// Màu slice donut — lấy trực tiếp giá trị CSS variable token asset-* (Recharts
// cần màu cụ thể cho fill, không nhận Tailwind class như JSX thường) — vẫn qua
// token (var(--color-asset-*)), KHÔNG hardcode hex (docs/rules/ui-ux-design.md).
const ASSET_TYPE_FILL: Record<AssetType, string> = {
  STOCK: "var(--color-asset-stock)",
  FUND: "var(--color-asset-fund)",
  BOND: "var(--color-asset-bond)",
  GOLD: "var(--color-asset-gold)",
};

type AllocationDonutSlice = {
  type: AssetType;
  // 0-100, KHÔNG bị ẩn bởi chế độ ẩn số tiền (chỉ ẩn VND tuyệt đối, giữ %).
  percent: number;
  note?: string; // "· gồm CCQ" cho FUND
};

type AllocationScreenProps = {
  backHref: string;
  slices: AllocationDonutSlice[];
  // N mã đang vượt ngưỡng cảnh báo tập trung — 0 = ẩn hẳn callout liên kết.
  concentrationWarningCount: number;
};

// Màn chi tiết phân bổ tài sản (mockup 6d, route riêng /allocation — mục 10
// phase-6.md) — donut Recharts (PieChart + innerRadius thay conic-gradient CSS
// trong mockup). % KHÔNG bị ẩn bởi chế độ ẩn số tiền (chỉ tiền VND tuyệt đối
// cần ẩn — component này không hiển thị VND nào cả).
function AllocationScreen({
  backHref,
  slices,
  concentrationWarningCount,
}: AllocationScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Phân bổ tài sản"
        subtitle="Theo nhóm · % giá trị thị trường"
        backHref={backHref}
      />

      {slices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có vị thế nào có giá để tính phân bổ.
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-56 w-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="percent"
                  nameKey="type"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((slice) => (
                    <Cell key={slice.type} fill={ASSET_TYPE_FILL[slice.type]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
                {slices.length}
              </div>
              <div className="text-[11px] text-muted-foreground">nhóm</div>
              <div className="mt-0.5 text-[10px] text-muted-faint">
                dù đang ẩn tiền
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            {slices.map((slice) => (
              <div key={slice.type} className="flex items-center gap-2">
                <span
                  className={`size-2.5 shrink-0 rounded-sm ${ASSET_TYPE_DOT_CLASS[slice.type]}`}
                />
                <span className="text-[13px] text-foreground">
                  {ASSET_TYPE_LABEL[slice.type]}
                  {slice.note ? (
                    <span className="text-muted-faint"> {slice.note}</span>
                  ) : null}
                </span>
                <span className="flex-1" />
                <span className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
                  {formatPercent(slice.percent)}
                </span>
              </div>
            ))}
          </div>

          {concentrationWarningCount > 0 ? (
            <Link
              href={ROUTES.holdings}
              className="flex items-start gap-2.5 rounded-2xl border border-warning/28 bg-warning/8 p-3.75 transition-colors hover:bg-warning/12"
            >
              <PieChartIcon className="mt-0.5 size-4.5 shrink-0 text-warning" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-warning">
                  {concentrationWarningCount} mã đang vượt ngưỡng tập trung
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Xem bảng vị thế bên dưới.
                </div>
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-warning" />
            </Link>
          ) : null}

          <div className="text-center text-[10.5px] leading-relaxed text-muted-faint">
            % phân bổ luôn hiển thị đầy đủ dù bạn đang bật chế độ ẩn số tiền —
            chỉ số tiền VND tuyệt đối mới bị ẩn.
          </div>
        </>
      )}
    </div>
  );
}

export { AllocationScreen };
export type { AllocationDonutSlice, AllocationScreenProps };
