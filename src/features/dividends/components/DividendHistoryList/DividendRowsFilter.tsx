"use client";

import { Coins, Layers } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { DividendHistoryRow } from "./DividendHistoryList";

type DividendFilterValue = "ALL" | "CASH" | "STOCK";

const FILTER_OPTIONS: { value: DividendFilterValue; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "CASH", label: "Tiền mặt" },
  { value: "STOCK", label: "Cổ phiếu" },
];

type DividendRowsFilterProps = {
  rows: DividendHistoryRow[];
  hidden: boolean;
};

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
        {filteredRows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.25"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[30%]",
                row.type === "CASH"
                  ? "bg-gain/14 text-gain"
                  : "bg-accent/14 text-accent",
              )}
            >
              {row.type === "CASH" ? (
                <Coins className="size-4.75" />
              ) : (
                <Layers className="size-4.75" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold text-foreground">
                  {row.type === "CASH" ? "Tiền mặt" : "Cổ phiếu"}{" "}
                  {row.percentLabel}%
                </span>
                {row.isNew ? (
                  <Badge variant="gain" className="px-1.5 py-0 text-[9px]">
                    MỚI
                  </Badge>
                ) : null}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-faint">
                {row.type === "CASH"
                  ? `${row.date} · gộp ${row.grossAmount ? formatMoney(row.grossAmount, { compact: true }) : "—"} − thuế ${row.taxAmount ? formatMoney(row.taxAmount, { compact: true }) : "—"}`
                  : `${row.date} · ${row.quantityBefore && row.unit ? formatQuantity(row.quantityBefore, row.unit) : "—"} → ${row.quantityAfter && row.unit ? formatQuantity(row.quantityAfter, row.unit) : "—"}`}
              </div>
            </div>
            <div className="text-right">
              {row.type === "CASH" ? (
                <>
                  <div className="font-mono text-[13px] font-bold text-gain">
                    {row.netAmount
                      ? `+${formatMoney(row.netAmount, { hidden, compact: true })}`
                      : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-faint">
                    net
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[13px] font-bold text-accent">
                    {row.addedQuantity && row.unit
                      ? `+${formatQuantity(row.addedQuantity, row.unit)}`
                      : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-faint">
                    SL
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
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
