"use client";

import type { LucideIcon } from "lucide-react";
import { Coins, Layers, ReceiptText } from "lucide-react";
import { useState } from "react";

import type { DividendType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { assertNever } from "@/lib/assert-never";
import { dividendTypeName } from "@/lib/dividend-label";
import { DIVIDEND_TYPES } from "@/lib/enums";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DividendHistoryRow } from "./DividendHistoryList";

type DividendFilterValue = "ALL" | DividendType;

const DIVIDEND_TYPE_ICON: Record<DividendType, LucideIcon> = {
  CASH: Coins,
  STOCK: Layers,
  BOND_COUPON: ReceiptText,
};

const DIVIDEND_TYPE_ICON_CLASS: Record<DividendType, string> = {
  CASH: "bg-gain/14 text-gain",
  STOCK: "bg-accent/14 text-accent",
  // Tông asset-bond (mockup 7d) — khác CASH (gain) dù cùng cấu trúc dữ liệu
  // gross/tax/net, để ba loại xếp chung một danh sách vẫn phân biệt được ngay.
  BOND_COUPON: "bg-asset-bond/24 text-asset-bond",
};

const FILTER_OPTIONS: { value: DividendFilterValue; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  ...DIVIDEND_TYPES.map((type) => ({
    value: type,
    label: dividendTypeName(type),
  })),
];

type DividendRowsFilterProps = {
  rows: DividendHistoryRow[];
  hidden: boolean;
};

function grossMinusTaxLine(row: DividendHistoryRow): string {
  return `gộp ${row.grossAmount ? formatMoney(row.grossAmount, { compact: true }) : "—"} − thuế ${row.taxAmount ? formatMoney(row.taxAmount, { compact: true }) : "—"}`;
}

// Dòng phụ khác cấu trúc thật sự theo loại — CASH hiện gộp/thuế, STOCK hiện SL
// trước → sau, BOND_COUPON cần HAI dòng (điều khoản đã áp dụng, rồi gộp/thuế)
// nên hàm trả về mảng. switch exhaustive (KHÔNG ternary nhị phân, xem
// docs/rules/typescript-style.md mục "Enum").
function dividendDetailLines(row: DividendHistoryRow): string[] {
  switch (row.type) {
    case "CASH":
      return [`${row.date} · ${grossMinusTaxLine(row)}`];
    case "BOND_COUPON": {
      // Điều khoản ĐÃ ĐÓNG BĂNG lúc ghi (mockup 7d: "9%/năm · kỳ 6 tháng") —
      // đọc từ field của chính dòng đó, không phải BondTerms hiện tại.
      const terms = [
        row.couponRatePercentApplied
          ? `${row.couponRatePercentApplied}%/năm`
          : null,
        row.couponFrequencyMonths
          ? `kỳ ${row.couponFrequencyMonths} tháng`
          : null,
      ].filter((part) => part !== null);
      return [
        [row.date, ...terms].join(" · "),
        row.isTaxExempt
          ? `gộp ${row.grossAmount ? formatMoney(row.grossAmount, { compact: true }) : "—"} − miễn thuế`
          : grossMinusTaxLine(row),
      ];
    }
    case "STOCK":
      return [
        `${row.date} · ${row.quantityBefore && row.unit ? formatQuantity(row.quantityBefore, row.unit) : "—"} → ${row.quantityAfter && row.unit ? formatQuantity(row.quantityAfter, row.unit) : "—"}`,
      ];
    default:
      return assertNever(row.type);
  }
}

// Cột số tiền/số lượng bên phải — khác hẳn cấu trúc JSX theo loại (CASH hiện
// netAmount, STOCK hiện addedQuantity), không chỉ khác label/màu.
function DividendRowAmount({
  row,
  hidden,
}: {
  row: DividendHistoryRow;
  hidden: boolean;
}) {
  switch (row.type) {
    case "CASH":
    case "BOND_COUPON":
      // Cùng cấu trúc field (netAmount) với CASH — không phải placeholder.
      return (
        <>
          <div className="font-mono text-[13px] font-bold text-gain">
            {row.netAmount
              ? `+${formatMoney(row.netAmount, { hidden, compact: true })}`
              : "—"}
          </div>
          <div className="font-mono text-[10px] text-muted-faint">net</div>
        </>
      );
    case "STOCK":
      return (
        <>
          <div className="font-mono text-[13px] font-bold text-accent">
            {row.addedQuantity && row.unit
              ? `+${formatQuantity(row.addedQuantity, row.unit)}`
              : "—"}
          </div>
          <div className="font-mono text-[10px] text-muted-faint">SL</div>
        </>
      );
    default:
      return assertNever(row.type);
  }
}

// Chip lọc CASH/STOCK (mockup Phase 4 Screens 4e) — client leaf tách riêng
// (đẩy ranh giới client xuống lá, xem docs/rules/component-architecture.md):
// chỉ lọc lại MẢNG rows đã fetch sẵn từ props (không fetch/route mới), khác
// case "2 route con" của rule tab điều hướng (ở đây vẫn 1 fetch duy nhất, chỉ
// đổi view hiển thị của cùng 1 tập dữ liệu nhỏ đã có sẵn).
function DividendRowsFilter({ rows, hidden }: DividendRowsFilterProps) {
  const [filter, setFilter] = useState<DividendFilterValue>("ALL");
  const filteredRows =
    filter === "ALL" ? rows : rows.filter((row) => row.type === filter);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1.75">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-full px-3 py-1.25 text-[11.5px] font-semibold transition-colors",
              filter === option.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.25">
        {filteredRows.map((row) => {
          const Icon = DIVIDEND_TYPE_ICON[row.type];
          return (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.25"
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[30%]",
                  DIVIDEND_TYPE_ICON_CLASS[row.type],
                )}
              >
                <Icon className="size-4.75" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">
                    {dividendTypeName(row.type)} {row.percentLabel}%
                  </span>
                  {row.isTaxExempt ? (
                    <Badge variant="accent" className="px-1.5 py-0 text-[9px]">
                      MIỄN THUẾ
                    </Badge>
                  ) : null}
                  {row.isNew ? (
                    <Badge variant="gain" className="px-1.5 py-0 text-[9px]">
                      MỚI
                    </Badge>
                  ) : null}
                </div>
                {dividendDetailLines(row).map((line) => (
                  <div
                    key={line}
                    className="mt-0.5 font-mono text-[11px] text-muted-faint"
                  >
                    {line}
                  </div>
                ))}
              </div>
              <div className="text-right">
                <DividendRowAmount row={row} hidden={hidden} />
              </div>
            </div>
          );
        })}
        {filteredRows.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-muted-faint">
            Không có cổ tức nào khớp bộ lọc.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { DividendRowsFilter };
