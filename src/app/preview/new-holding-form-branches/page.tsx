"use client";

import { Percent } from "lucide-react";
import { useState } from "react";

import { AutoFilledAmountCard } from "@/components/AutoFilledAmountCard";
import { DuplicateHoldingAlert } from "@/features/holdings/components/NewHoldingForm/DuplicateHoldingAlert";
import { ExistingPositionFields } from "@/features/holdings/components/NewHoldingForm/ExistingPositionFields";
import {
  NewHoldingSourceToggle,
  type PositionSource,
} from "@/features/holdings/components/NewHoldingForm/NewHoldingSourceToggle";
import { NewPurchaseFields } from "@/features/holdings/components/NewHoldingForm/NewPurchaseFields";
import { TotalCostBreakdownCard } from "@/features/holdings/components/NewHoldingForm/TotalCostBreakdownCard";
import { ROUTES } from "@/lib/routes";

// Soi 2 nhánh NewHoldingForm tách ra ở issue #140 (mockup vta-vte,
// process/UI_new-holding-form-branches.md):
// - Khối 1: bộ chọn nhánh + field tương ứng, tương tác thật bằng useState cục
//   bộ (mã mẫu FPT cho "Đã có từ trước", MWG cho "Vừa mua hôm nay").
// - Khối 2: 3 trạng thái AutoFilledAmountCard (idle/computed/loading) đứng
//   cạnh nhau.
// - Khối 3: TotalCostBreakdownCard với số liệu mockup vtc2.
// - Khối 4: DuplicateHoldingAlert (chưa wiring vào NewHoldingForm — chờ
//   business-implementer thêm cơ chế kiểm tra trùng mã, xem digest mục
//   "Điểm cần xác nhận" #3).
//
// "use client" ở cả page: khối 1 cần useState quản lý state tương tác, khối 2
// truyền `icon` (component reference, không serialize được qua ranh giới
// Server→Client) cho AutoFilledAmountCard — cùng lý do
// src/app/preview/auto-filled-amount-card/page.tsx đã "use client".
function SourceToggleDemo() {
  const [source, setSource] = useState<PositionSource>("EXISTING");

  // Sample EXISTING = FPT, sample NEW_PURCHASE = MWG (đúng số mockup vtb2/vtc2).
  const [existingQuantity, setExistingQuantity] = useState("4200");
  const [existingUnit, setExistingUnit] = useState("cổ phần");
  const [existingAvgCost, setExistingAvgCost] = useState("163100");
  const [existingDate, setExistingDate] = useState("2026-07-09");

  const [purchaseQuantity, setPurchaseQuantity] = useState("100");
  const [purchaseUnit, setPurchaseUnit] = useState("cổ phần");
  const [purchasePrice, setPurchasePrice] = useState("100000");
  const [purchaseDate, setPurchaseDate] = useState("2026-08-19");
  const [feeAmount, setFeeAmount] = useState("0");

  return (
    <div className="flex flex-col gap-4.5 rounded-2xl border border-border bg-card p-4">
      <NewHoldingSourceToggle value={source} onChange={setSource} />

      {source === "EXISTING" ? (
        <ExistingPositionFields
          quantity={existingQuantity}
          onQuantityChange={setExistingQuantity}
          unit={existingUnit}
          onUnitChange={setExistingUnit}
          unitOptions={["cổ phần"]}
          avgCostPerUnit={existingAvgCost}
          onAvgCostPerUnitChange={setExistingAvgCost}
          date={existingDate}
          onDateChange={setExistingDate}
        />
      ) : (
        <NewPurchaseFields
          quantity={purchaseQuantity}
          onQuantityChange={setPurchaseQuantity}
          unit={purchaseUnit}
          onUnitChange={setPurchaseUnit}
          unitOptions={["cổ phần"]}
          matchedPricePerUnit={purchasePrice}
          onMatchedPricePerUnitChange={setPurchasePrice}
          date={purchaseDate}
          onDateChange={setPurchaseDate}
          feeCard={
            <AutoFilledAmountCard
              icon={Percent}
              label="Phí giao dịch"
              fieldName="feeAmount"
              computedAmount="0"
              note="Tự động tính phí sẽ có ở bản cập nhật sau — tạm thời nhập tay theo phí thực trên sao kê."
              onValueChange={setFeeAmount}
            />
          }
          totalBreakdown={
            purchaseQuantity && purchasePrice ? (
              <TotalCostBreakdownCard
                orderValue={String(
                  Number(purchaseQuantity) * Number(purchasePrice),
                )}
                orderValueFormula={`${purchaseQuantity} × ${purchasePrice}`}
                feeAmount={feeAmount}
                feePercentLabel=""
                total={String(
                  Number(purchaseQuantity) * Number(purchasePrice) +
                    Number(feeAmount),
                )}
                avgCostPerUnit={String(
                  (Number(purchaseQuantity) * Number(purchasePrice) +
                    Number(feeAmount)) /
                    Number(purchaseQuantity),
                )}
              />
            ) : null
          }
        />
      )}
    </div>
  );
}

export default function NewHoldingFormBranchesPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 p-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Khối 1 — Bộ chọn nhánh + field tương ứng
        </h2>
        <SourceToggleDemo />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Khối 2 — Card Phí giao dịch: idle / computed / loading
        </h2>
        <div className="flex flex-col gap-3">
          <AutoFilledAmountCard
            icon={Percent}
            label="Phí giao dịch · idle"
            fieldName="feeAmount"
            computedAmount="0"
            status="idle"
          />
          <AutoFilledAmountCard
            icon={Percent}
            label="Phí giao dịch · computed"
            fieldName="feeAmount"
            computedAmount="30000"
            formulaLabel="10.000.000 × 0,3% — TRANSACTION_FEE_BUY_STOCK @ 19/08/2026"
          />
          <AutoFilledAmountCard
            icon={Percent}
            label="Phí giao dịch · loading"
            fieldName="feeAmount"
            computedAmount="0"
            status="loading"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Khối 3 — TotalCostBreakdownCard
        </h2>
        <TotalCostBreakdownCard
          orderValue="10000000"
          orderValueFormula="100 × 100.000"
          feeAmount="30000"
          feePercentLabel="0,3%"
          total="10030000"
          avgCostPerUnit="100300"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Khối 4 — DuplicateHoldingAlert
        </h2>
        <DuplicateHoldingAlert
          symbol="FPT"
          existingQuantity="8.000"
          existingUnit="CP"
          existingAvgCost="92.400"
          addTransactionHref={ROUTES.newTransaction("sample-holding-id")}
          onSwitchToExisting={() => {}}
        />
      </section>
    </div>
  );
}
