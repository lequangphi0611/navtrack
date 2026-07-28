import { redirect } from "next/navigation";

import { recordDividend } from "@/features/dividends/actions";
import { DividendForm } from "@/features/dividends/components/DividendForm";
import { getOpenHoldingsForDividendSwitcher } from "@/features/dividends/queries";
import { getBondCouponFormData } from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";
import {
  requireDecimalSetting,
  resolveSettings,
  SETTING_KEYS,
} from "@/lib/settings";

// Entry độc lập từ Dashboard (pill "Cổ tức") — chưa có ngữ cảnh Holding, mặc
// định chọn Holding đang mở đầu tiên trong danh sách; switcher cho đổi ngay.
// Chưa có vị thế nào đang mở -> không còn gì để ghi cổ tức, điều hướng sang
// khai báo vị thế mới.
export default async function NewDividendStandalonePage() {
  const holdings = await getOpenHoldingsForDividendSwitcher();
  if (holdings.length === 0) redirect(ROUTES.newHolding);

  const current = holdings[0]!;
  // Cùng wiring với route theo-holding (/holdings/[id]/dividends/new): vị thế
  // mặc định có thể là trái phiếu, và cùng một vị thế không được lúc có lúc
  // không có tab "Trái tức" tuỳ lối vào.
  const bondData =
    current.type === "BOND" ? await getBondCouponFormData(current.id) : null;

  const today = new Date();
  const settings = await resolveSettings(
    [SETTING_KEYS.DIVIDEND_PAR_VALUE, SETTING_KEYS.DIVIDEND_TAX_RATE],
    today,
  );
  const parValue = requireDecimalSetting(
    settings,
    SETTING_KEYS.DIVIDEND_PAR_VALUE,
  );
  const taxRatePercent = requireDecimalSetting(
    settings,
    SETTING_KEYS.DIVIDEND_TAX_RATE,
  );

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
      {...(bondData
        ? {
            bond: {
              terms: bondData.terms,
              taxRatePercent: bondData.taxRatePercent,
              ...(bondData.couponPeriodLabel
                ? { couponPeriodLabel: bondData.couponPeriodLabel }
                : {}),
              bondTermsHref: ROUTES.bondTerms(current.id),
            },
          }
        : {})}
      defaultDateInputValue={
        bondData?.nextCouponDateInputValue ?? today.toISOString().slice(0, 10)
      }
      historyHref={ROUTES.dividendHistory(current.id)}
      closeHref={ROUTES.dashboard}
      action={recordDividend}
    />
  );
}
