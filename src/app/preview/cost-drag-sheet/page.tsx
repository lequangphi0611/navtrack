"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CostDragSheet } from "@/features/dashboard/components/CostDragSheet";
import type { CostDragBreakdownEntry } from "@/lib/portfolio-valuation";

const BREAKDOWN: CostDragBreakdownEntry[] = [
  { source: "FEE", amount: "6180000", contributionPercent: 52 },
  { source: "SALE_TAX", amount: "3240000", contributionPercent: 28 },
  { source: "DIVIDEND_TAX", amount: "2360000", contributionPercent: 20 },
];

const EMPTY_BREAKDOWN: CostDragBreakdownEntry[] = [
  { source: "FEE", amount: "0", contributionPercent: 0 },
  { source: "SALE_TAX", amount: "0", contributionPercent: 0 },
  { source: "DIVIDEND_TAX", amount: "0", contributionPercent: 0 },
];

// Mở sẵn (open=true) để soi ngay khi vào trang — sheet vốn cần state
// open/onOpenChange controlled từ ngoài (process/phase-5-plan-DRAFT.md mục B4).
export default function CostDragSheetPreview() {
  const [open, setOpen] = useState(true);
  const [empty, setEmpty] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 p-5">
      <Button
        type="button"
        onClick={() => {
          setEmpty(false);
          setOpen(true);
        }}
      >
        Mở sheet (có dữ liệu)
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setEmpty(true);
          setOpen(true);
        }}
      >
        Mở sheet (costDragAmount = 0 — ca biên chia 0)
      </Button>

      <CostDragSheet
        open={open}
        onOpenChange={setOpen}
        costDragAmount={empty ? "0" : "11780000"}
        costDragPercent={empty ? 0 : 0.41}
        grossInvested="2850000000"
        breakdown={empty ? EMPTY_BREAKDOWN : BREAKDOWN}
      />
    </div>
  );
}
