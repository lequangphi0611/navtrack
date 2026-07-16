import { notFound } from "next/navigation";

import { DividendHistoryScreen } from "@/features/dividends/components/DividendHistoryScreen";
import type { DividendHistoryRow } from "@/features/dividends/components/DividendHistoryList";
import { ROUTES } from "@/lib/routes";

// TODO(business-implementer, issue #52): thay bằng getHoldingDetail(id) (chỉ
// symbol/name) + getDividendHistory(holdingId) thật — xem process/UI_phase_4.md.
const SAMPLE_HOLDINGS: Record<string, { symbol: string; name: string | null }> =
  {
    "hld-fpt": { symbol: "FPT", name: "FPT Corp" },
    "hld-hpg": { symbol: "HPG", name: "Hòa Phát" },
    "hld-vnm": { symbol: "VNM", name: "Vinamilk" },
    "hld-mwg": { symbol: "MWG", name: "Thế Giới Di Động" },
    "hld-acb": { symbol: "ACB", name: "Á Châu Bank" },
  };

const SAMPLE_ROWS: DividendHistoryRow[] = [
  {
    id: "div-1",
    type: "CASH",
    percentLabel: "20",
    date: "14/07/2026",
    isNew: true,
    grossAmount: "16000000",
    taxAmount: "800000",
    netAmount: "15200000",
  },
  {
    id: "div-2",
    type: "STOCK",
    percentLabel: "15",
    date: "20/06/2025",
    unit: "CP",
    quantityBefore: "6957",
    quantityAfter: "8000",
    addedQuantity: "1043",
  },
  {
    id: "div-3",
    type: "CASH",
    percentLabel: "10",
    date: "15/12/2025",
    grossAmount: "6960000",
    taxAmount: "348000",
    netAmount: "6612000",
  },
  {
    id: "div-4",
    type: "STOCK",
    percentLabel: "20",
    date: "18/06/2024",
    unit: "CP",
    quantityBefore: "5797",
    quantityAfter: "6957",
    addedQuantity: "1200",
  },
  {
    id: "div-5",
    type: "CASH",
    percentLabel: "15",
    date: "12/12/2024",
    grossAmount: "8700000",
    taxAmount: "435000",
    netAmount: "8265000",
  },
];

type DividendHistoryPageProps = {
  params: Promise<{ id: string }>;
};

// Lịch sử cổ tức của MỘT Holding (mockup Phase 4 Screens, 4e) — entry từ
// HoldingDetailScreen ("Lịch sử cổ tức") hoặc icon history trong DividendForm.
export default async function DividendHistoryPage({
  params,
}: DividendHistoryPageProps) {
  const { id } = await params;
  const holding = SAMPLE_HOLDINGS[id];
  if (!holding) notFound();

  return (
    <DividendHistoryScreen
      backHref={ROUTES.holdingDetail(id)}
      holding={holding}
      summary={{
        cashNetTotal: "49400000",
        cashCount: 3,
        stockAddedQuantityTotal: "2243",
        stockCount: 2,
        unit: "CP",
      }}
      rows={SAMPLE_ROWS}
      newDividendHref={ROUTES.newDividend(id)}
    />
  );
}
