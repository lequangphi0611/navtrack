import { MaturityCouponReminder } from "@/features/holdings/components/MaturityCouponReminder";
import { MaturitySettlementForm } from "@/features/holdings/components/MaturitySettlementForm";

// Hai biến thể của cùng một màn (mockup Phase 7 Screens 7e/7f) — khác nhau
// DUY NHẤT ở giá vốn, biến thể thuế do component tự suy (xem docstring
// MaturitySettlementForm). Kèm toast gợi ý ghi trái tức kỳ cuối của 7e.
const VARIANTS = [
  {
    key: "7e",
    title: "7e · Mua đúng mệnh giá (thuế 0)",
    holding: {
      id: "b1",
      symbol: "TCB2528",
      quantity: "2",
      unit: "trái phiếu",
      avgCost: "100000000",
    },
  },
  {
    key: "7f",
    title: "7f · Mua chiết khấu (thuế lợi tức 5%)",
    holding: {
      id: "b4",
      symbol: "VIC2429",
      quantity: "2",
      unit: "trái phiếu",
      avgCost: "92000000",
    },
  },
];

export default function MaturitySettlementFormPreview() {
  return (
    <div className="flex flex-wrap items-start gap-8">
      {VARIANTS.map((variant) => (
        <div key={variant.key} className="w-full max-w-md">
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-faint uppercase">
            {variant.title}
          </div>
          <MaturitySettlementForm
            holding={variant.holding}
            parValue="100000000"
            maturityDateLabel="15/01/2029"
            defaultDateInputValue="2029-01-15"
            interestTaxRatePercent="5"
            closeHref="#"
          />
        </div>
      ))}

      <div className="w-full max-w-md">
        <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-faint uppercase">
          7e · Toast gợi ý sau khi ghi thành công
        </div>
        <MaturityCouponReminder
          finalCouponDateLabel="15/01/2029"
          recordCouponHref="#"
        />
      </div>
    </div>
  );
}
