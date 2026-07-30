"use client";

import { useState } from "react";

import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import type {
  NavTrendPeriod,
  NavTrendPeriodData,
} from "@/features/dashboard/components/NavTrendChart";
import type { CostDragBreakdownEntry } from "@/lib/portfolio-valuation";
import type { SnapshotTodayState } from "@/features/snapshots/types";

// Stub cho prop `action` của SnapshotTodayCard (useActionState) — page này đã
// là Client Component nên KHÔNG cần "use server" (component-architecture.md
// "Bề mặt preview": preview page cấm Server Action/queries.ts/Prisma thật).
async function fakeSnapshotAction(): Promise<SnapshotTodayState> {
  return { ok: true, snapshotAt: "15:42" };
}

// Sample chuỗi NAV (mirror preview/nav-trend-chart) — đủ 3 kỳ để soi
// SegmentedControl bên trong card biểu đồ.
const YEAR_DATES = [
  "2025-08-15",
  "2025-10-15",
  "2025-12-15",
  "2026-02-15",
  "2026-04-15",
  "2026-06-15",
  "2026-07-28",
];
const YEAR_VALUES = [
  "3200000000",
  "3350000000",
  "3610000000",
  "3720000000",
  "3760000000",
  "4120000000",
  "3723986000",
];

function buildNavTrend(): Record<NavTrendPeriod, NavTrendPeriodData> {
  const start = Number(YEAR_VALUES[0]);
  const points = YEAR_DATES.map((date, i) => {
    const value = Number(YEAR_VALUES[i]);
    return {
      date,
      value: String(value),
      changePercentFromStart: ((value - start) / start) * 100,
    };
  });
  const last = points[points.length - 1];
  const yearData: NavTrendPeriodData = {
    points,
    changePercent: last?.changePercentFromStart ?? 0,
  };
  const monthPoints = points.slice(-3);
  return {
    MONTH: {
      points: monthPoints,
      changePercent: monthPoints.at(-1)?.changePercentFromStart ?? 0,
    },
    YEAR: yearData,
    ALL: yearData,
  };
}

const COST_DRAG_BREAKDOWN: CostDragBreakdownEntry[] = [
  { source: "FEE", amount: "6180000", contributionPercent: 52 },
  { source: "SALE_TAX", amount: "3240000", contributionPercent: 28 },
  { source: "DIVIDEND_TAX", amount: "2360000", contributionPercent: 20 },
];

// Toggle "hidden" quản lý NGAY TRONG preview (local useState, KHÔNG gọi Server
// Action thật) — đủ để soi hành vi mà DashboardScreenClient.tsx cảnh báo
// (mọi vùng money-value trong cây phải re-render khi `hidden` đổi, không phải
// JSX slot đông cứng) mà không cần DB (component-architecture.md "Bề mặt
// preview" — cấm chạm dữ liệu thật).
export default function DashboardScreenPreview() {
  const [hidden, setHidden] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          2a — happy path (bấm icon mắt ở góc trên để test toggle ẩn số tiền)
        </div>
        <DashboardScreen
          displayName="Minh Quân"
          cutoff={{
            cutoffLabel: "Hôm nay",
            cutoffDate: "28/07/2026",
            cutoffHref: "#",
          }}
          hero={{
            navValue: "3723986000",
            navValueIsPartial: false,
            navDeltaAmount: "448486000",
            navDeltaPercent: 13.7,
          }}
          pnl={{
            absolutePnl: "448486000",
            absolutePnlIsPartial: false,
            realizedPnl: "180000000",
            unrealizedPnl: "268486000",
            pnlSplitIsApproximate: false,
            costDragAmount: "11780000",
            costDragPercent: 0.41,
            grossInvested: "2850000000",
            costDragBreakdown: COST_DRAG_BREAKDOWN,
          }}
          xirr={{ status: "OK", percentPerYear: 18.4 }}
          allocation={[
            { type: "STOCK", percent: 46 },
            { type: "FUND", percent: 22 },
            { type: "BOND", percent: 14 },
            { type: "GOLD", percent: 18 },
          ]}
          priceStatus={{
            priceFreshnessNote:
              "Giá tự động cập nhật EOD hôm nay 15:05 · 2 mã dùng giá nhập tay",
            missingPriceHoldings: [],
          }}
          hidden={hidden}
          onToggleHidden={() => setHidden((prev) => !prev)}
          snapshotToday={{
            alreadySnapshotToday: false,
            action: fakeSnapshotAction,
          }}
          navTrend={buildNavTrend()}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          2f — thiếu giá + XIRR không hội tụ (không có nút mắt, không CTA chốt
          số liệu — mirror preview không cần tương tác)
        </div>
        <DashboardScreen
          displayName="Minh Quân"
          cutoff={{
            cutoffLabel: "Cuối tháng trước",
            cutoffDate: "30/06/2026",
            cutoffHref: "#",
          }}
          hero={{
            navValue: "3200000000",
            navValueIsPartial: true,
            navDeltaAmount: "0",
            navDeltaPercent: 0,
          }}
          pnl={{
            absolutePnl: "-14630000",
            absolutePnlIsPartial: true,
            realizedPnl: "20000000",
            unrealizedPnl: "-34630000",
            pnlSplitIsApproximate: true,
            costDragAmount: "0",
            costDragPercent: 0,
            grossInvested: "0",
            costDragBreakdown: [
              { source: "FEE", amount: "0", contributionPercent: 0 },
              { source: "SALE_TAX", amount: "0", contributionPercent: 0 },
              { source: "DIVIDEND_TAX", amount: "0", contributionPercent: 0 },
            ],
          }}
          xirr={{ status: "NO_CONVERGE" }}
          allocation={[{ type: "STOCK", percent: 100 }]}
          priceStatus={{
            priceFreshnessNote: "2 mã dùng giá nhập tay · chưa có giá tự động",
            missingPriceHoldings: [
              {
                id: "holding-1",
                symbol: "VNM",
                name: "Vinamilk",
                type: "STOCK",
                reasonLabel: "Cổ phiếu · chưa có giá tự động",
                href: "#",
              },
              {
                id: "holding-2",
                symbol: "SJC1L",
                name: "Vàng SJC 1 lượng",
                type: "GOLD",
                reasonLabel: "Vàng · chưa có giá nhập tay",
                href: "#",
              },
            ],
          }}
        />
      </div>
    </div>
  );
}
