"use client";

import { useState } from "react";

import {
  AllocationScreen,
  type AllocationDonutSlice,
} from "@/features/dashboard/components/AllocationScreen";

// Sample data 130a (đầy đủ dữ liệu) — khớp số trong
// process/UI_allocation-group-pnl.md mục "Sample data".
const SLICES_FULL: AllocationDonutSlice[] = [
  {
    type: "STOCK",
    percent: 52.2,
    navAmount: "60000000",
    pnlAmount: "8000000",
    pnlPercent: 15.4,
    navIsPartial: false,
  },
  {
    type: "FUND",
    percent: 21.7,
    note: "· gồm CCQ",
    navAmount: "25000000",
    pnlAmount: "-2500000",
    pnlPercent: -9.1,
    navIsPartial: false,
  },
  {
    type: "BOND",
    percent: 17.4,
    navAmount: "20000000",
    pnlAmount: "0",
    pnlPercent: 0,
    navIsPartial: false,
  },
  {
    type: "GOLD",
    percent: 8.7,
    navAmount: "10000000",
    pnlAmount: "1800000",
    pnlPercent: 22,
    navIsPartial: false,
  },
];

// 130b — nhóm Cổ phiếu NAV chưa đầy đủ (1 mã MWG thiếu giá), 3 nhóm còn lại
// giữ nguyên như 130a.
const SLICES_PARTIAL: AllocationDonutSlice[] = [
  {
    ...SLICES_FULL[0]!,
    navIsPartial: true,
    pricedCount: 2,
    totalCount: 3,
    missingSymbolsLabel: "MWG",
  },
  SLICES_FULL[1]!,
  SLICES_FULL[2]!,
  SLICES_FULL[3]!,
];

export default function AllocationScreenPreview() {
  const [hiddenFull, setHiddenFull] = useState(false);
  const [hiddenPartial, setHiddenPartial] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          130a — đầy đủ dữ liệu (bấm icon mắt ở góc trên để test toggle ẩn số
          tiền)
        </div>
        <AllocationScreen
          backHref="#"
          slices={SLICES_FULL}
          concentrationWarningCount={2}
          hidden={hiddenFull}
          onToggleHidden={() => setHiddenFull((prev) => !prev)}
          totalNavAmount="115000000"
          totalNavIsPartial={false}
          totalPnlAmount="7300000"
          totalPnlPercent={6.8}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          130b — NAV nhóm Cổ phiếu chưa đầy đủ (1 mã MWG thiếu giá, viền amber +
          ghi chú + badge &quot;Chưa đầy đủ&quot; ở thẻ tổng)
        </div>
        <AllocationScreen
          backHref="#"
          slices={SLICES_PARTIAL}
          concentrationWarningCount={2}
          hidden={hiddenPartial}
          onToggleHidden={() => setHiddenPartial((prev) => !prev)}
          totalNavAmount="115000000"
          totalNavIsPartial={true}
          totalPnlAmount="7300000"
          totalPnlPercent={6.8}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          1 nhóm chiếm 100%, không nút mắt (mirror bản gốc trước issue #130)
        </div>
        <AllocationScreen
          backHref="#"
          slices={[
            {
              type: "STOCK",
              percent: 100,
              navAmount: "60000000",
              pnlAmount: "8000000",
              pnlPercent: 15.4,
              navIsPartial: false,
            },
          ]}
          concentrationWarningCount={0}
          totalNavAmount="60000000"
          totalNavIsPartial={false}
          totalPnlAmount="8000000"
          totalPnlPercent={15.4}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          Rỗng — chưa có vị thế nào có giá
        </div>
        <AllocationScreen
          backHref="#"
          slices={[]}
          concentrationWarningCount={0}
          totalNavAmount="0"
          totalNavIsPartial={false}
          totalPnlAmount="0"
          totalPnlPercent={0}
        />
      </div>
    </div>
  );
}
