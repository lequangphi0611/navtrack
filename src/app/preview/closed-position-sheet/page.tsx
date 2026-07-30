"use client";

import { useState } from "react";

import type { CashflowTimelineRow } from "@/features/holdings/components/CashflowTimeline";
import { ClosedPositionSheet } from "@/features/holdings/components/ClosedPositionSheet";

const GAIN_ORDERS: CashflowTimelineRow[] = [
  {
    id: "cf-1",
    kind: "BUY",
    label: "Mua 3.000 CP",
    dateNote: "09/05/2024 · giá 78.000",
    amount: "-234000000",
  },
  {
    id: "cf-2",
    kind: "DIVIDEND",
    label: "Cổ tức tiền mặt",
    dateNote: "20/08/2024 · cổ tức tiền mặt",
    amount: "4500000",
  },
  {
    id: "cf-3",
    kind: "SELL",
    label: "Bán hết 3.000 CP",
    dateNote: "15/12/2025 · giá 96.500",
    amount: "289500000",
  },
];

const LOSS_ORDERS: CashflowTimelineRow[] = [
  {
    id: "cf-4",
    kind: "BUY",
    label: "Mua 500 CP",
    dateNote: "02/03/2025 · giá 42.000",
    amount: "-21000000",
  },
  {
    id: "cf-5",
    kind: "SELL",
    label: "Bán hết 500 CP",
    dateNote: "10/06/2025 · giá 33.200",
    amount: "16600000",
  },
];

// `open=true` mặc định để soi ngay khi mở trang (yêu cầu Phần D) — dùng state
// local (thuần presentational, không Server Action/queries) chỉ để nút đóng/
// mở lại được (Sheet cần onOpenChange hợp lệ).
export default function ClosedPositionSheetPreview() {
  const [openGain, setOpenGain] = useState(true);
  const [openLoss, setOpenLoss] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-semibold text-muted-foreground">
        6i — vị thế lãi (mở sẵn) · bấm nút bên dưới để soi biến thể lỗ
      </div>
      <button
        type="button"
        onClick={() => {
          setOpenGain(false);
          setOpenLoss(true);
        }}
        className="w-fit rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
      >
        Soi biến thể lỗ (không cổ tức, XIRR chưa tính được)
      </button>

      <ClosedPositionSheet
        open={openGain}
        onOpenChange={setOpenGain}
        identity={{ symbol: "FPT", name: "FPT Corporation", type: "STOCK" }}
        pnl={{
          realizedPnl: "59000000",
          realizedPnlPercent: 25.2,
          xirrRealized: { status: "OK", percentPerYear: 21.8 },
        }}
        holdingPeriod={{
          holdingPeriodLabel: "19 tháng 6 ngày",
          startMonthLabel: "05/2024",
          endMonthLabel: "12/2025",
        }}
        breakdown={{
          totalInvested: "234000000",
          totalProceeds: "289500000",
          totalDividends: "4500000",
        }}
        orders={GAIN_ORDERS}
        actions={{ reopenHref: "#", detailHref: "#" }}
      />

      <ClosedPositionSheet
        open={openLoss}
        onOpenChange={setOpenLoss}
        identity={{ symbol: "SJC1L", name: "Vàng SJC 1 lượng", type: "GOLD" }}
        pnl={{
          realizedPnl: "-4400000",
          realizedPnlPercent: -20.95,
          xirrRealized: { status: "NO_CONVERGE" },
        }}
        holdingPeriod={{
          holdingPeriodLabel: "3 tháng 8 ngày",
          startMonthLabel: "03/2025",
          endMonthLabel: "06/2025",
        }}
        breakdown={{
          totalInvested: "21000000",
          totalProceeds: "16600000",
          totalDividends: "0",
        }}
        orders={LOSS_ORDERS}
        actions={{ reopenHref: "#", detailHref: "#" }}
        hidden
      />
    </div>
  );
}
