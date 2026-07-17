"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Input } from "@/components/ui/input";
import { Sheet, SheetPopup } from "@/components/ui/sheet";
import type { HoldingSummary } from "@/features/holdings/types";
import { formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

type TransactionHoldingPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Holding đang mở (quantity > 0) — Container (page.tsx) đã lọc sẵn, không lọc lại.
  holdings: HoldingSummary[];
  // CTA khi holdings rỗng — ROUTES.newHolding.
  newHoldingHref: string;
  hidden?: boolean;
};

// Sheet chọn mã để giao dịch, mở từ FAB "Mua / Bán" trên Dashboard (issue #54 —
// đảo ngược quyết định cũ trỏ thẳng ROUTES.holdings, xem process/UI_phase_4.md
// mục 5 và process/DECISION.md). Không có SheetTrigger bên trong: trigger là
// nút "Mua / Bán" của DashboardQuickMenu, đóng/mở điều khiển hoàn toàn bằng
// state ngoài (`open`/`onOpenChange`) — khác HoldingSwitcher (trigger là pill
// persistent trong DividendForm) vì ở đây chưa có holding nào "đang chọn" và
// chọn xong thì điều hướng đi luôn, không ở lại form.
function TransactionHoldingPicker({
  open,
  onOpenChange,
  holdings,
  newHoldingHref,
  hidden = false,
}: TransactionHoldingPickerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? holdings.filter(
        (holding) =>
          holding.symbol.toLowerCase().includes(normalizedQuery) ||
          (holding.name ?? "").toLowerCase().includes(normalizedQuery),
      )
    : holdings;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup>
        <div className="mb-3.5">
          <div className="text-[16.5px] font-bold text-foreground">
            Chọn mã giao dịch
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-faint">
            {holdings.length} mã đang nắm giữ
          </div>
        </div>

        {holdings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="text-[12.5px] text-muted-faint">
              Chưa có vị thế nào đang mở.
            </div>
            <Link
              href={newHoldingHref}
              className="flex items-center gap-1.5 rounded-full bg-accent/14 px-3.5 py-1.75 text-[12.5px] font-semibold text-accent"
            >
              <Plus className="size-3.75" />
              Thêm vị thế
            </Link>
          </div>
        ) : (
          <>
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
              {filtered.map((holding) => (
                <Link
                  key={holding.id}
                  href={ROUTES.newTransaction(holding.id)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  <SymbolAvatar symbol={holding.symbol} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-foreground">
                        {holding.name ?? holding.symbol}
                      </span>
                      <AssetTypeBadge
                        assetType={holding.type}
                        className="shrink-0 px-1.5 py-0 text-[9px]"
                      />
                    </div>
                    <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
                      {formatQuantity(holding.quantity, holding.unit)} · giá vốn{" "}
                      {formatMoney(holding.avgCost, { hidden, compact: true })}
                    </div>
                  </div>
                </Link>
              ))}
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-[12.5px] text-muted-faint">
                  Không tìm thấy mã phù hợp.
                </div>
              ) : null}
            </div>
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}

export { TransactionHoldingPicker };
export type { TransactionHoldingPickerProps };
