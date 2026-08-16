"use client";

import { useState } from "react";

import {
  StockAllocationDetail,
  type MissingPricedStockRow,
  type StockAllocationRowData,
} from "@/features/dashboard/components/StockAllocationDetail";
import { formatMoney, formatQuantity } from "@/lib/format";

const FPT_NAV = "180000000";
const HPG_NAV = "95000000";
const VNM_NAV = "74000000";
const MWG_NAV = "55000000";
const GROUP_NAV_131A = "404000000";
const GROUP_NAV_131C = "180000000";

// rows FPT/HPG/VNM/MWG (131a/131b) — bám đúng số liệu digest
// process/UI_stock-allocation-detail.md mục "Sample data".
function buildRows(hidden: boolean): StockAllocationRowData[] {
  return [
    {
      holdingId: "fpt",
      symbol: "FPT",
      name: "FPT Corp",
      navLabel: formatMoney(FPT_NAV, { hidden }),
      percent: 44.6,
      concentrationBadge: { kind: "NORMAL", percent: 27.3 },
    },
    {
      holdingId: "hpg",
      symbol: "HPG",
      name: "Hoà Phát",
      navLabel: formatMoney(HPG_NAV, { hidden }),
      percent: 23.5,
    },
    {
      holdingId: "vnm",
      symbol: "VNM",
      name: "Vinamilk",
      navLabel: formatMoney(VNM_NAV, { hidden }),
      percent: 18.3,
    },
    {
      holdingId: "mwg",
      symbol: "MWG",
      name: "Thế Giới Di Động",
      navLabel: formatMoney(MWG_NAV, { hidden }),
      percent: 13.6,
    },
  ];
}

const MISSING_VIC: MissingPricedStockRow = {
  holdingId: "vic",
  symbol: "VIC",
  name: "Vingroup",
  quantityLabel: formatQuantity("1200", "CP"),
  updatePriceHref: "#",
};

const MISSING_SSI: MissingPricedStockRow = {
  holdingId: "ssi",
  symbol: "SSI",
  name: "SSI",
  quantityLabel: formatQuantity("800", "CP"),
  updatePriceHref: "#",
};

function nextSortLabel(current: string): string {
  return current === "% giảm dần" ? "Theo mã A→Z" : "% giảm dần";
}

export default function StockAllocationDetailPreview() {
  const [hiddenA, setHiddenA] = useState(false);
  const [sortLabelA, setSortLabelA] = useState("% giảm dần");

  const [hiddenB, setHiddenB] = useState(false);
  const [sortLabelB, setSortLabelB] = useState("% giảm dần");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          131a — bình thường (bấm mắt/chip đổi thứ tự để test toggle)
        </div>
        <StockAllocationDetail
          backHref="#"
          groupNavLabel={formatMoney(GROUP_NAV_131A, { hidden: hiddenA })}
          hidden={hiddenA}
          onToggleHidden={() => setHiddenA((prev) => !prev)}
          sortLabel={sortLabelA}
          onToggleSort={() => setSortLabelA((prev) => nextSortLabel(prev))}
          rows={buildRows(hiddenA)}
          missingPricedRows={[]}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          131b — có mã thiếu giá (VIC)
        </div>
        <StockAllocationDetail
          backHref="#"
          groupNavLabel={formatMoney(GROUP_NAV_131A, { hidden: hiddenB })}
          hidden={hiddenB}
          onToggleHidden={() => setHiddenB((prev) => !prev)}
          sortLabel={sortLabelB}
          onToggleSort={() => setSortLabelB((prev) => nextSortLabel(prev))}
          rows={buildRows(hiddenB)}
          missingPricedRows={[MISSING_VIC]}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          131c — chỉ 1 mã · 100%
        </div>
        <StockAllocationDetail
          backHref="#"
          groupNavLabel={formatMoney(GROUP_NAV_131C, { hidden: false })}
          sortLabel="% giảm dần"
          rows={[
            {
              holdingId: "fpt-solo",
              symbol: "FPT",
              name: "FPT Corp",
              navLabel: formatMoney(GROUP_NAV_131C, { hidden: false }),
              percent: 100,
              concentrationBadge: { kind: "NORMAL", percent: 27.3 },
            },
          ]}
          missingPricedRows={[]}
        />
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          131d — rỗng, không mã nào có giá
        </div>
        <StockAllocationDetail
          backHref="#"
          groupNavLabel="chưa tính được"
          sortLabel="% giảm dần"
          rows={[]}
          missingPricedRows={[MISSING_VIC, MISSING_SSI]}
        />
      </div>
    </div>
  );
}
