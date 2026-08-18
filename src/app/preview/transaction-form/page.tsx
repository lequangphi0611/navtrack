import type { HoldingSwitcherHolding } from "@/components/HoldingSwitcher";
import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import type { TransactionSettingRows } from "@/features/holdings/types";

// Preview form ghi giao dịch mua/bán (mode "create") kèm HoldingSwitcher đổi
// mã ngay trong màn (issue #138) — soi pill trigger + bottom sheet với 3 mã
// đang mở, cùng lúc soi field số lượng/giá/thuế/phí phía dưới.
const SETTING_ROWS: TransactionSettingRows = {
  saleTaxRows: [
    {
      value: "0.1",
      valueType: "DECIMAL",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
  ],
  feeBuyRows: [
    {
      value: "0.15",
      valueType: "DECIMAL",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
  ],
  feeSellRows: [
    {
      value: "0.3",
      valueType: "DECIMAL",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const HOLDINGS: HoldingSwitcherHolding[] = [
  {
    id: "h1",
    symbol: "FPT",
    name: "FPT Corp",
    type: "STOCK",
    quantity: "750",
    unit: "cổ phần",
    avgCost: "45000",
    marketValue: "112500000",
  },
  {
    id: "h2",
    symbol: "VESAF",
    name: "Quỹ VESAF",
    type: "FUND",
    quantity: "3200",
    unit: "ccq",
    avgCost: "18500",
    marketValue: "62400000",
  },
  {
    id: "h3",
    symbol: "SJC",
    name: null,
    type: "GOLD",
    quantity: "5",
    unit: "chỉ",
    avgCost: "7150000",
    marketValue: "36500000",
  },
];

const CURRENT = HOLDINGS[0]!;

export default function TransactionFormPreview() {
  return (
    <div className="mx-auto w-full max-w-md p-5">
      <TransactionForm
        mode="create"
        holdingId={CURRENT.id}
        holding={CURRENT}
        settingRows={SETTING_ROWS}
        switcher={{
          current: CURRENT,
          options: HOLDINGS.map((holding) => ({
            ...holding,
            href: "#",
            isCurrent: holding.id === CURRENT.id,
          })),
          sheetTitle: "Chọn mã ghi giao dịch",
          sheetSubtitlePrefix: "Tất cả vị thế đang mở",
        }}
      />
    </div>
  );
}
