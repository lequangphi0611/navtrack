"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  type AssetType,
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
  ASSET_TYPE_TINT_CLASS,
} from "@/components/AssetTypeBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { HoldingSummary } from "../../types";

// Số dòng luôn hiện trước khi cần bấm "Xem thêm" (mockup 2d).
const VISIBLE_COUNT = 2;

type HoldingsGroupCardProps = {
  type: AssetType;
  holdings: HoldingSummary[];
  totalCostBasis: string;
  className?: string;
};

function HoldingsGroupCard({
  type,
  holdings,
  totalCostBasis,
  className,
}: HoldingsGroupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = holdings.length > VISIBLE_COUNT;
  const visible = expanded ? holdings : holdings.slice(0, VISIBLE_COUNT);
  const hiddenCount = holdings.length - VISIBLE_COUNT;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 p-3.5">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-sm",
            ASSET_TYPE_DOT_CLASS[type],
          )}
        />
        <span className="text-[13.5px] font-bold whitespace-nowrap text-foreground">
          {ASSET_TYPE_LABEL[type]}
        </span>
        <span className="font-mono text-[11.5px] font-semibold whitespace-nowrap text-muted-faint">
          {holdings.length} mã
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
          {formatMoney(totalCostBasis)}
        </span>
      </div>

      {visible.map((holding) => (
        <Link
          key={holding.id}
          href={ROUTES.holdingDetail(holding.id)}
          className="flex items-center gap-3 border-t border-white/5 p-3.5 transition-colors hover:bg-muted"
        >
          <SymbolAvatar
            symbol={holding.symbol}
            size="sm"
            colorClassName={ASSET_TYPE_TINT_CLASS[type]}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-foreground">
              {holding.name ?? holding.symbol}
            </div>
            <div className="mt-0.5 font-mono text-[11.5px] text-muted-faint">
              {formatQuantity(holding.quantity, holding.unit)} · TB{" "}
              {formatMoney(holding.avgCost)}
            </div>
          </div>
          <div className="font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
            {formatMoney(holding.totalCostBasis)}
          </div>
        </Link>
      ))}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-white/5 p-2.5 text-[12.5px] font-semibold text-accent"
        >
          <span>
            {expanded ? (
              "Thu gọn"
            ) : (
              <>
                Xem thêm{" "}
                <span className="font-mono tabular-nums">{hiddenCount}</span> mã
              </>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

export { HoldingsGroupCard };
export type { HoldingsGroupCardProps };
