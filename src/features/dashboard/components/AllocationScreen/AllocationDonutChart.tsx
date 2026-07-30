"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { AssetType } from "@/components/AssetTypeBadge";

import type { AllocationDonutSlice } from "./AllocationScreen";

// Màu slice donut — lấy trực tiếp giá trị CSS variable token asset-* (Recharts
// cần màu cụ thể cho fill, không nhận Tailwind class như JSX thường) — vẫn qua
// token (var(--color-asset-*)), KHÔNG hardcode hex (docs/rules/ui-ux-design.md).
const ASSET_TYPE_FILL: Record<AssetType, string> = {
  STOCK: "var(--color-asset-stock)",
  FUND: "var(--color-asset-fund)",
  BOND: "var(--color-asset-bond)",
  GOLD: "var(--color-asset-gold)",
};

type AllocationDonutChartProps = {
  slices: AllocationDonutSlice[];
};

// Donut Recharts (mockup 6d) — tách riêng khỏi AllocationScreen (issue #110
// mục Phần C, docs/rules/component-architecture.md "Cấm 'use client' ở
// *Screen") thành client leaf, mirror pattern NavTrendChart: Recharts cần
// "use client" nhưng AllocationScreen (Server Component) chỉ cần import +
// truyền props, không tự phải là client. Markup/className giữ NGUYÊN VĂN so
// với bản gộp cũ trong AllocationScreen.tsx.
function AllocationDonutChart({ slices }: AllocationDonutChartProps) {
  return (
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
  );
}

export { AllocationDonutChart };
export type { AllocationDonutChartProps };
