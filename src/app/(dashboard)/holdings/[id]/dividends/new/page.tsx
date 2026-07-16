import { notFound } from "next/navigation";

import { recordDividend } from "@/features/dividends/actions";
import { DividendForm } from "@/features/dividends/components/DividendForm";
import { getOpenHoldingsForDividendSwitcher } from "@/features/dividends/queries";
import { ROUTES } from "@/lib/routes";
import { resolveDecimalSetting, SETTING_KEYS } from "@/lib/settings";

type NewDividendPageProps = {
  params: Promise<{ id: string }>;
};

// Entry từ HoldingDetailScreen ("Ghi cổ tức") — holding hiện tại xác định qua
// params.id. Switcher (luôn hiện, xem DividendForm) vẫn cho đổi sang mã khác.
// id không khớp Holding đang mở nào của user hiện tại (không tồn tại, không
// thuộc user, hoặc đã đóng) -> notFound (getOpenHoldingsForDividendSwitcher đã
// filter theo userId + quantity > 0 nên không lộ dữ liệu người khác).
export default async function NewDividendPage({
  params,
}: NewDividendPageProps) {
  const { id } = await params;
  const holdings = await getOpenHoldingsForDividendSwitcher();
  const current = holdings.find((holding) => holding.id === id);
  if (!current) notFound();

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
      closeHref={ROUTES.holdingDetail(current.id)}
      action={recordDividend}
    />
  );
}
