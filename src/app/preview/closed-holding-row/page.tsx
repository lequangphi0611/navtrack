import {
  ClosedHoldingsList,
  type ClosedHoldingWithSheetData,
} from "@/features/holdings/components/ClosedHoldingsSection";

const ROWS: ClosedHoldingWithSheetData[] = [
  {
    id: "1",
    symbol: "FPT",
    name: "FPT Corporation",
    type: "STOCK",
    holdingPeriodLabel: "14 tháng 6 ngày",
    realizedPnl: "48250000",
    realizedPnlPercent: 22.4,
    xirrRealized: { status: "OK", percentPerYear: 19.8 },
    startMonthLabel: "05/2024",
    endMonthLabel: "07/2025",
    totalInvested: "215000000",
    totalProceeds: "263250000",
    totalDividends: "0",
    orders: [
      {
        id: "o1",
        kind: "BUY",
        label: "Mua 8.000 CP",
        dateNote: "12/05/2024 · giá 18.100",
        amount: "-144800000",
      },
      {
        id: "o2",
        kind: "BUY",
        label: "Mua 3.500 CP",
        dateNote: "02/09/2024 · giá 20.400",
        amount: "-71400000",
      },
      {
        id: "o3",
        kind: "SELL",
        label: "Bán hết 11.500 CP",
        dateNote: "18/07/2025 · giá 22.900",
        amount: "263250000",
      },
    ],
    reopenHref: "#",
    detailHref: "#",
  },
  {
    // Có cổ tức tiền mặt lúc còn mở (code review #3, PR #81) — Tổng mua/Tổng
    // bán/Cổ tức/Chênh lệch phải khớp phép cộng trừ: 132.400.000 + 3.200.000
    // − 141.000.000 = −5.400.000.
    id: "2",
    symbol: "VNM",
    name: "Vinamilk",
    type: "STOCK",
    holdingPeriodLabel: "6 tháng 12 ngày",
    realizedPnl: "-5400000",
    realizedPnlPercent: -3.8,
    xirrRealized: { status: "NO_CONVERGE" },
    startMonthLabel: "01/2026",
    endMonthLabel: "07/2026",
    totalInvested: "141000000",
    totalProceeds: "132400000",
    totalDividends: "3200000",
    orders: [
      {
        id: "o4",
        kind: "BUY",
        label: "Mua 2.000 CP",
        dateNote: "09/01/2026 · giá 70.500",
        amount: "-141000000",
      },
      {
        id: "o4d",
        kind: "DIVIDEND",
        label: "Cổ tức tiền mặt",
        dateNote: "15/04/2026 · cổ tức tiền mặt",
        amount: "3200000",
      },
      {
        id: "o5",
        kind: "SELL",
        label: "Bán hết 2.000 CP",
        dateNote: "21/07/2026 · giá 66.200",
        amount: "132400000",
      },
    ],
    reopenHref: "#",
    detailHref: "#",
  },
];

// Bấm 1 dòng để soi ClosedPositionSheet (state mở/đóng quản lý ngay trong
// ClosedHoldingsList — mirror TransactionHoldingPicker).
export default function ClosedHoldingRowPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-5">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          Mặc định
        </div>
        <ClosedHoldingsList rows={ROWS} />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          hidden=true (ẩn số tiền)
        </div>
        <ClosedHoldingsList rows={ROWS} hidden />
      </div>
    </div>
  );
}
