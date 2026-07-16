import { DividendForm } from "@/features/dividends/components/DividendForm";
import type { DividendFormState } from "@/features/dividends/types";
import { ROUTES } from "@/lib/routes";

// TODO(business-implementer, issue #52): thay bằng
// getOpenHoldingsForDividendSwitcher() thật, mặc định chọn Holding đang mở đầu
// tiên (thứ tự do Container quyết định) — xem process/UI_phase_4.md.
const SAMPLE_OPEN_HOLDINGS = [
  {
    id: "hld-fpt",
    symbol: "FPT",
    name: "FPT Corp",
    type: "STOCK" as const,
    quantity: "8000",
    unit: "CP",
    avgCost: "92400",
    marketValue: "739200000",
  },
  {
    id: "hld-hpg",
    symbol: "HPG",
    name: "Hòa Phát",
    type: "STOCK" as const,
    quantity: "13000",
    unit: "CP",
    avgCost: "34269",
    marketValue: "445500000",
  },
  {
    id: "hld-vnm",
    symbol: "VNM",
    name: "Vinamilk",
    type: "STOCK" as const,
    quantity: "4500",
    unit: "CP",
    avgCost: "68000",
    marketValue: "306000000",
  },
  {
    id: "hld-mwg",
    symbol: "MWG",
    name: "Thế Giới Di Động",
    type: "STOCK" as const,
    quantity: "3200",
    unit: "CP",
    avgCost: "62000",
    marketValue: "198400000",
  },
  {
    id: "hld-acb",
    symbol: "ACB",
    name: "Á Châu Bank",
    type: "STOCK" as const,
    quantity: "6000",
    unit: "CP",
    avgCost: "25500",
    marketValue: "153000000",
  },
];

async function recordDividendSample(
  _prevState: DividendFormState,
  formData: FormData,
): Promise<DividendFormState> {
  "use server";
  // TODO(business-implementer, issue #52): gọi createDividend() Server Action thật.
  const holdingId = String(formData.get("holdingId") ?? "hld-fpt");
  const type = String(formData.get("type") ?? "CASH") as "CASH" | "STOCK";
  const percent = String(formData.get("percent") ?? "0");
  const holding =
    SAMPLE_OPEN_HOLDINGS.find((item) => item.id === holdingId) ??
    SAMPLE_OPEN_HOLDINGS[0]!;

  return {
    ok: true,
    result:
      type === "CASH"
        ? {
            symbol: holding.symbol,
            type: "CASH",
            percentLabel: percent,
            dateLabel: "14/07/2026",
            grossAmount: "16000000",
            taxAmount: "800000",
            netAmount: "15200000",
            historyHref: ROUTES.dividendHistory(holding.id),
            holdingHref: ROUTES.holdingDetail(holding.id),
          }
        : {
            symbol: holding.symbol,
            type: "STOCK",
            percentLabel: percent,
            dateLabel: "14/07/2026",
            addedQuantity: "1200",
            afterQuantity: "9200",
            unit: holding.unit,
            historyHref: ROUTES.dividendHistory(holding.id),
            holdingHref: ROUTES.holdingDetail(holding.id),
          },
  };
}

// Entry độc lập từ Dashboard (pill "Cổ tức") — chưa có ngữ cảnh Holding, mặc
// định chọn Holding đang mở đầu tiên trong danh sách; switcher cho đổi ngay.
export default function NewDividendStandalonePage() {
  const current = SAMPLE_OPEN_HOLDINGS[0]!;

  return (
    <DividendForm
      holding={current}
      switcher={{
        current,
        options: SAMPLE_OPEN_HOLDINGS.map((holding) => ({
          ...holding,
          href: ROUTES.newDividend(holding.id),
          isCurrent: holding.id === current.id,
        })),
      }}
      faceValuePerShare="10000"
      taxRatePercent="5"
      defaultDateInputValue={new Date().toISOString().slice(0, 10)}
      historyHref={ROUTES.dividendHistory(current.id)}
      closeHref={ROUTES.dashboard}
      action={recordDividendSample}
    />
  );
}
