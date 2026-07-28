import { DividendForm } from "@/features/dividends/components/DividendForm";
import type {
  BondCouponContext,
  DividendHolding,
} from "@/features/dividends/types";

import { fakeDividendAction } from "../dividend-form/actions";

// Bộ số mockup Phase 7 Screens 7b/7c/7g (process/UI_phase_7.md mục "Sample
// data") — 3 biến thể của cùng một form: doanh nghiệp chịu thuế 5%, chính phủ
// miễn thuế, và vị thế chưa nhập điều khoản (bị chặn).
const corporateHolding: DividendHolding = {
  id: "b1",
  symbol: "TCB2528",
  name: "Techcombank",
  type: "BOND",
  quantity: "2",
  unit: "trái phiếu",
  avgCost: "100000000",
  marketValue: "200000000",
};

const governmentHolding: DividendHolding = {
  ...corporateHolding,
  id: "b2",
  symbol: "TPCP 2029",
  name: "Kho bạc Nhà nước",
};

const noTermsHolding: DividendHolding = {
  ...corporateHolding,
  id: "b3",
  symbol: "VIC2429",
  name: "Vingroup",
};

const corporateBond: BondCouponContext = {
  terms: {
    issuerType: "CORPORATE",
    parValue: "100000000",
    couponRatePercent: "9",
    couponFrequencyMonths: 6,
  },
  taxRatePercent: "5",
  couponPeriodLabel: "KỲ 2 · TỰ ĐIỀN",
  bondTermsHref: "#",
};

const governmentBond: BondCouponContext = {
  ...corporateBond,
  terms: {
    issuerType: "GOVERNMENT",
    parValue: "100000000",
    couponRatePercent: "9",
    couponFrequencyMonths: 6,
  },
  taxRatePercent: "0",
};

const missingTermsBond: BondCouponContext = {
  terms: null,
  taxRatePercent: "5",
  bondTermsHref: "#",
};

const VARIANTS = [
  {
    key: "7b",
    title: "7b · Trái tức doanh nghiệp (thuế 5%)",
    holding: corporateHolding,
    bond: corporateBond,
  },
  {
    key: "7c",
    title: "7c · Trái tức Chính phủ (miễn thuế)",
    holding: governmentHolding,
    bond: governmentBond,
  },
  {
    key: "7g",
    title: "7g · Chưa nhập điều khoản (bị chặn)",
    holding: noTermsHolding,
    bond: missingTermsBond,
  },
];

export default function BondCouponFormPreview() {
  return (
    <div className="flex flex-wrap items-start gap-8">
      {VARIANTS.map((variant) => (
        <div key={variant.key} className="w-full max-w-md">
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-faint uppercase">
            {variant.title}
          </div>
          <DividendForm
            holding={variant.holding}
            switcher={{
              current: variant.holding,
              options: [{ ...variant.holding, href: "#", isCurrent: true }],
            }}
            faceValuePerShare="10000"
            taxRatePercent="5"
            defaultDateInputValue="2026-07-15"
            historyHref="#"
            closeHref="#"
            bond={variant.bond}
            action={fakeDividendAction}
          />
        </div>
      ))}
    </div>
  );
}
