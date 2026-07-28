import { MaturitySettlementForm } from "@/features/holdings/components/MaturitySettlementForm";
import { getMaturitySettlementData } from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";

type MaturitySettlementPageProps = {
  params: Promise<{ id: string }>;
};

// Tất toán đáo hạn trái phiếu (mockup Phase 7 Screens 7e đúng mệnh giá / 7f mua
// chiết khấu). Ghi `Cashflow{type: MATURITY}` — KHÔNG phải một dòng SELL, vì
// đáo hạn không chịu thuế chuyển nhượng 0,1% (docs/domain/07-tax.md).
//
// getMaturitySettlementData() tự verify userId, `holding.type === "BOND"` và sự
// tồn tại của BondTerms, gọi notFound() khi không khớp — app không đoán mệnh
// giá hay loại tổ chức phát hành.
export default async function MaturitySettlementPage({
  params,
}: MaturitySettlementPageProps) {
  const { id } = await params;
  const data = await getMaturitySettlementData(id);

  return (
    <MaturitySettlementForm
      holding={data.holding}
      parValue={data.parValue}
      maturityDateLabel={data.maturityDateLabel}
      defaultDateInputValue={data.defaultDateInputValue}
      interestTaxRatePercent={data.interestTaxRatePercent}
      closeHref={ROUTES.holdingDetail(id)}
    />
  );
}
