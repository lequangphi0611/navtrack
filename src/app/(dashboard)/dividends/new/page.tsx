import { redirect } from "next/navigation";

import { recordDividend } from "@/features/dividends/actions";
import { DividendForm } from "@/features/dividends/components/DividendForm";
import { getOpenHoldingsForDividendSwitcher } from "@/features/dividends/queries";
import { ROUTES } from "@/lib/routes";
import { resolveDecimalSetting, SETTING_KEYS } from "@/lib/settings";

// Entry độc lập từ Dashboard (pill "Cổ tức") — chưa có ngữ cảnh Holding, mặc
// định chọn Holding đang mở đầu tiên trong danh sách; switcher cho đổi ngay.
// Chưa có vị thế nào đang mở -> không còn gì để ghi cổ tức, điều hướng sang
// khai báo vị thế mới.
export default async function NewDividendStandalonePage() {
  const holdings = await getOpenHoldingsForDividendSwitcher();
  if (holdings.length === 0) redirect(ROUTES.newHolding);

  const current = holdings[0]!;
  const today = new Date();
  const [parValue, taxRatePercent] = await Promise.all([
    resolveDecimalSetting(SETTING_KEYS.DIVIDEND_PAR_VALUE, today),
    resolveDecimalSetting(SETTING_KEYS.DIVIDEND_TAX_RATE, today),
  ]);

  return (
    <DividendForm
      holding={current}
      switcher={{
        current,
        options: holdings.map((holding) => ({
          ...holding,
          href: ROUTES.newDividend(holding.id),
          isCurrent: holding.id === current.id,
        })),
      }}
      faceValuePerShare={parValue.toString()}
      taxRatePercent={taxRatePercent.toString()}
      defaultDateInputValue={today.toISOString().slice(0, 10)}
      historyHref={ROUTES.dividendHistory(current.id)}
      closeHref={ROUTES.dashboard}
      action={recordDividend}
    />
  );
}
