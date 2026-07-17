"use client";

import { CheckCircle2, ChevronsUpDown, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetPopup, SheetTrigger } from "@/components/ui/sheet";
import type { DividendHolding } from "@/features/dividends/types";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type HoldingSwitcherOption = DividendHolding & {
  // Đổi mã = điều hướng route mới (ROUTES.newDividend), không giữ state client
  // (xem docs/rules/component-architecture.md — tab/lựa chọn đổi cả tập dữ liệu
  // phải là Link thật).
  href: string;
  isCurrent: boolean;
};

type HoldingSwitcherProps = {
  current: DividendHolding;
  // CHỈ Holding đang mở (quantity > 0), luôn gồm `current` (isCurrent true).
  options: HoldingSwitcherOption[];
  hidden?: boolean;
};

// Switcher pill (mockup Phase 4 Screens 4a) + bottom sheet chọn mã (4b) — LUÔN
// hiện trong DividendForm bất kể lối vào (HoldingDetailScreen hay Dashboard),
// khớp mockup (không có biến thể ẩn switcher — xem process/UI_phase_4.md).
function HoldingSwitcher({
  current,
  options,
  hidden = false,
}: HoldingSwitcherProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter(
        (option) =>
          option.symbol.toLowerCase().includes(normalizedQuery) ||
          (option.name ?? "").toLowerCase().includes(normalizedQuery),
      )
    : options;

  return (
    <Sheet>
      <SheetTrigger className="flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-linear-to-br from-accent/14 to-card p-3.25 text-left transition-colors hover:bg-accent/8">
        <SymbolAvatar
          symbol={current.symbol}
          colorClassName="bg-accent/16 text-accent"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-foreground">
              {current.name ?? current.symbol}
            </span>
            <AssetTypeBadge
              assetType={current.type}
              className="shrink-0 px-1.5 py-0 text-[9px]"
            />
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-faint">
            Đang giữ {formatQuantity(current.quantity, current.unit)} · giá vốn{" "}
            {formatMoney(current.avgCost, { hidden, compact: true })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-[10px] border border-border bg-white/5 px-2 py-1.25">
          <ChevronsUpDown className="size-4.5 text-accent" />
          <span className="text-[8.5px] font-semibold text-muted-faint">
            Đổi mã
          </span>
        </div>
      </SheetTrigger>

      <SheetPopup>
        <div className="mb-3.5">
          <div className="text-[16.5px] font-bold text-foreground">
            Chọn mã ghi cổ tức
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-faint">
            Chỉ cổ phiếu đang nắm giữ · {options.length} mã
          </div>
        </div>

        <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-1">
          <Search className="size-4.25 shrink-0 text-muted-faint" />
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã…"
            aria-label="Tìm mã"
            className="h-auto border-none bg-transparent px-0 py-1.75 text-[13px] shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {filtered.map((option) => (
            <Link
              key={option.id}
              href={option.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                option.isCurrent
                  ? "border-accent/45 bg-accent/12"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <SymbolAvatar
                symbol={option.symbol}
                colorClassName="bg-accent/14 text-accent"
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-foreground">
                  {option.name ?? option.symbol}
                </div>
                <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
                  {formatQuantity(option.quantity, option.unit)} ·{" "}
                  {formatMoney(option.marketValue, {
                    hidden,
                    compact: true,
                  })}
                </div>
              </div>
              {option.isCurrent ? (
                <CheckCircle2 className="size-5.5 shrink-0 text-accent" />
              ) : null}
            </Link>
          ))}
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-muted-faint">
              Không tìm thấy mã phù hợp.
            </div>
          ) : null}
        </div>
      </SheetPopup>
    </Sheet>
  );
}

export { HoldingSwitcher };
export type { HoldingSwitcherOption, HoldingSwitcherProps };
