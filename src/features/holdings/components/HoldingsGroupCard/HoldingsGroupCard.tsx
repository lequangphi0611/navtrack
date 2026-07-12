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
import { PercentChange } from "@/components/PercentChange";
import {
  type PriceSource,
  PriceSourceBadge,
} from "@/components/PriceSourceBadge";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { formatMoney, formatQuantity } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { HoldingSummary } from "../../types";

// Số dòng luôn hiện trước khi cần bấm "Xem thêm" (mockup 2d).
const VISIBLE_COUNT = 2;

// Phase 2 (mockup 2b): NAV + nguồn giá + XIRR riêng từng vị thế. Mở rộng bằng
// composition (Partial) thay vì sửa HoldingSummary ở types.ts — business-implementer
// cần bổ sung các field này vào query khi wiring (xem process/UI_phase_2.md).
type HoldingValuationExtras = {
  // NAV hiện tại = quantity × currentPricePerUnit. Vắng mặt = chưa định giá được
  // (docs/domain/04-pricing-and-valuation.md "Thiếu giá") — hiện badge cảnh báo
  // thay vì mặc định 0.
  marketValue: string;
  currentPricePerUnit: string;
  // XIRR riêng holding (theo năm) — vắng mặt = "không tính được" (docs/domain/05).
  annualReturnPercent: number;
};

type HoldingWithValuation = HoldingSummary & Partial<HoldingValuationExtras>;

type GroupValuation = {
  priceSource: PriceSource;
  // % thay đổi của cả nhóm hiển thị ở header (mockup 2b, vd "+10,1%").
  changePercent: number;
};

type HoldingsGroupCardProps = {
  type: AssetType;
  holdings: HoldingWithValuation[];
  totalCostBasis: string;
  // Có giá trị = bật chế độ hiển thị Phase 2 (NAV/nguồn giá/XIRR); vắng mặt = giữ
  // nguyên hiển thị Phase 1 (chỉ vốn đã bỏ vào) — Container chưa cấp đủ dữ liệu.
  groupValuation?: GroupValuation;
  className?: string;
};

function HoldingsGroupCard({
  type,
  holdings,
  totalCostBasis,
  groupValuation,
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
        {groupValuation ? (
          <PriceSourceBadge source={groupValuation.priceSource} />
        ) : (
          <span className="font-mono text-[11.5px] font-semibold whitespace-nowrap text-muted-faint">
            {holdings.length} mã
          </span>
        )}
        <span className="flex-1" />
        {groupValuation ? (
          <PercentChange
            value={groupValuation.changePercent}
            className="bg-transparent px-0 py-0"
          />
        ) : (
          <span className="font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
            {formatMoney(totalCostBasis)}
          </span>
        )}
      </div>

      {visible.map((holding) => {
        const hasValuation = holding.marketValue !== undefined;
        return (
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
                {formatQuantity(holding.quantity, holding.unit)} ·{" "}
                {hasValuation && holding.currentPricePerUnit !== undefined
                  ? `giá ${formatMoney(holding.currentPricePerUnit)}`
                  : `TB ${formatMoney(holding.avgCost)}`}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {hasValuation && holding.marketValue !== undefined ? (
                <span className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
                  {formatMoney(holding.marketValue)}
                </span>
              ) : groupValuation ? (
                <span className="rounded-full bg-warning/14 px-2 py-0.5 text-[10.5px] font-semibold text-warning">
                  Thiếu giá
                </span>
              ) : (
                <span className="font-mono text-[13.5px] font-semibold text-foreground tabular-nums">
                  {formatMoney(holding.totalCostBasis)}
                </span>
              )}
              {holding.annualReturnPercent !== undefined ? (
                <PercentChange
                  value={holding.annualReturnPercent}
                  variant="xirr"
                  className="bg-transparent px-0 py-0 text-[11px]"
                />
              ) : null}
            </div>
          </Link>
        );
      })}

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
export type {
  GroupValuation,
  HoldingsGroupCardProps,
  HoldingValuationExtras,
  HoldingWithValuation,
};
