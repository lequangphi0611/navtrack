import { notFound } from "next/navigation";

import { recordDividend } from "@/features/dividends/actions";
import { DividendForm } from "@/features/dividends/components/DividendForm";
import {
  getBondCouponFormData,
  getOpenHoldingsForSwitcher,
} from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";
import {
  requireDecimalSetting,
  resolveSettings,
  SETTING_KEYS,
} from "@/lib/settings";

type NewDividendPageProps = {
  params: Promise<{ id: string }>;
};

// Entry từ HoldingDetailScreen ("Ghi cổ tức") — holding hiện tại xác định qua
// params.id. Switcher (luôn hiện, xem DividendForm) vẫn cho đổi sang mã khác.
// id không khớp Holding đang mở nào của user hiện tại (không tồn tại, không
// thuộc user, hoặc đã đóng) -> notFound (getOpenHoldingsForSwitcher đã filter
// theo userId + quantity > 0 nên không lộ dữ liệu người khác).
export default async function NewDividendPage({
  params,
}: NewDividendPageProps) {
  const { id } = await params;
  const holdings = await getOpenHoldingsForSwitcher();
  const current = holdings.find((holding) => holding.id === id);
  if (!current) notFound();

  // Phase 7 — vị thế trái phiếu có thêm tab "Trái tức". `null` = không phải
  // trái phiếu -> DividendForm giữ nguyên hai loại của Phase 4, không hiện tab.
  // Trái phiếu CHƯA nhập điều khoản vẫn trả về ngữ cảnh (terms: null) để form
  // render màn chặn 7g dẫn sang màn nhập, thay vì giấu tab đi không lời giải
  // thích.
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
      // Vị thế trái phiếu mở thẳng tab "Trái tức" nên ngày mặc định phải là KỲ
      // TRẢ LÃI TỚI suy từ hợp đồng (badge "KỲ n · TỰ ĐIỀN"), không phải hôm
      // nay — coupon gần như không bao giờ rơi đúng ngày user mở form.
      defaultDateInputValue={
        bondData?.nextCouponDateInputValue ?? today.toISOString().slice(0, 10)
      }
      historyHref={ROUTES.dividendHistory(current.id)}
      closeHref={ROUTES.holdingDetail(current.id)}
      action={recordDividend}
    />
  );
}
