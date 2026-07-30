"use client";

import type { BondIssuerType } from "@prisma/client";
import { useState } from "react";

import { BondTermsFields } from "@/features/holdings/components/BondTermsFields";

// Sample data = bộ số TCB2528 của mockup Phase 7 Screens 7a (xem
// process/UI_phase_7.md mục "Sample data dùng trong preview").
export default function BondTermsFieldsPreview() {
  const [issuerType, setIssuerType] = useState<BondIssuerType>("CORPORATE");
  const [parValue, setParValue] = useState("100000000");
  const [couponRatePercent, setCouponRatePercent] = useState("9");
  const [couponFrequencyMonths, setCouponFrequencyMonths] = useState("6");
  const [firstCouponDate, setFirstCouponDate] = useState("2026-01-15");
  const [maturityDate, setMaturityDate] = useState("2029-01-15");

  return (
    <div className="mx-auto w-full max-w-md">
      <BondTermsFields
        issuerType={issuerType}
        onIssuerTypeChange={setIssuerType}
        parValue={parValue}
        onParValueChange={setParValue}
        couponRatePercent={couponRatePercent}
        onCouponRatePercentChange={setCouponRatePercent}
        couponFrequencyMonths={couponFrequencyMonths}
        onCouponFrequencyMonthsChange={setCouponFrequencyMonths}
        firstCouponDate={firstCouponDate}
        onFirstCouponDateChange={setFirstCouponDate}
        maturityDate={maturityDate}
        onMaturityDateChange={setMaturityDate}
      />
    </div>
  );
}
