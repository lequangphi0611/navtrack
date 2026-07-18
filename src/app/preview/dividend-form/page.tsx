import { DividendForm } from "@/features/dividends/components/DividendForm";
import type { DividendHolding } from "@/features/dividends/types";

import { fakeDividendAction } from "./actions";

// Preview tạm để soi bug overflow ngang ở field ngày — xoá sau khi verify xong.
const holding: DividendHolding = {
  id: "h1",
  symbol: "FPT",
  name: "FPT Corp",
  type: "STOCK",
  quantity: "750",
  unit: "cổ phần",
  avgCost: "45000",
  marketValue: "112500000",
};

export default function DividendFormPreview() {
  return (
    <DividendForm
      holding={holding}
      switcher={{
        current: holding,
        options: [{ ...holding, href: "#", isCurrent: true }],
      }}
      faceValuePerShare="10000"
      taxRatePercent="5"
      defaultDateInputValue="2026-07-17"
      historyHref="#"
      closeHref="#"
      action={fakeDividendAction}
    />
  );
}
