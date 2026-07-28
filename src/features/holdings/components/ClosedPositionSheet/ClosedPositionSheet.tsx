"use client";

import { Pencil, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { type AssetType, AssetTypeBadge } from "@/components/AssetTypeBadge";
import type { XirrResult } from "@/components/ReturnMetrics";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetPopup } from "@/components/ui/sheet";
import {
  CashflowTimeline,
  type CashflowTimelineRow,
} from "@/features/holdings/components/CashflowTimeline";
import {
  formatMoney,
  formatSignedPercent,
  formatXirrLabel,
  signColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// Nhóm định danh vị thế đã đóng — dùng ở avatar/header (mockup 6i).
type ClosedPositionIdentity = {
  symbol: string;
  name: string | null;
  type: AssetType;
};

// Nhóm lãi/lỗ đã chốt — realizedPnl dùng lại ở NHIỀU nơi trong JSX (tô màu
// header lẫn dòng "Chênh lệch (đã chốt)" trong breakdown bên dưới), không
// tách riêng field lặp giữa 2 nhóm.
type ClosedPositionPnl = {
  realizedPnl: string;
  realizedPnlPercent: number;
  xirrRealized: XirrResult;
};

type ClosedPositionHoldingPeriod = {
  holdingPeriodLabel: string; // "14 tháng 6 ngày" (không kèm "nắm")
  startMonthLabel: string; // "05/2024"
  endMonthLabel: string; // "12/2025"
};

type ClosedPositionBreakdown = {
  totalInvested: string; // gồm phí mua
  totalProceeds: string; // thực nhận (đã trừ phí/thuế bán)
  // Cổ tức tiền mặt nhận được lúc vị thế còn mở — "0" khi không có. Đã gộp
  // sẵn trong `pnl.realizedPnl` (Chênh lệch), hiện thành dòng riêng để "Tổng
  // mua/Tổng bán/Cổ tức/Chênh lệch" khớp phép cộng trừ hiển thị (code review #3).
  totalDividends: string;
};

type ClosedPositionActions = {
  reopenHref: string; // ROUTES.newTransaction(holdingId)
  detailHref: string; // ROUTES.holdingDetail(holdingId) — sửa/xoá giao dịch đã ghi
};

// Bottom sheet chi tiết vị thế ĐÃ ĐÓNG (mockup 6i) — mirror atom Sheet (tiền
// lệ HoldingSwitcher), mở khi bấm 1 dòng ClosedHoldingRow (state client ở
// ClosedHoldingsList, KHÔNG phải route riêng — cùng lý do TransactionHoldingPicker).
//
// Props gộp theo vùng UI (issue #110, thay vì 18 field phẳng) — KHÔNG có ràng
// buộc RSC-freezing như DashboardScreen (không có toggle sống trong cây, cha
// ClosedHoldingsList.tsx đã là client component), nhưng vẫn nhóm data thuần
// (không JSX slot) để đồng nhất cách nhóm props trong toàn bộ codebase.
type ClosedPositionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: ClosedPositionIdentity;
  pnl: ClosedPositionPnl;
  holdingPeriod: ClosedPositionHoldingPeriod;
  breakdown: ClosedPositionBreakdown;
  orders: CashflowTimelineRow[];
  actions: ClosedPositionActions;
  hidden?: boolean;
};

function ClosedPositionSheet({
  open,
  onOpenChange,
  identity,
  pnl,
  holdingPeriod,
  breakdown,
  orders,
  actions,
  hidden = false,
}: ClosedPositionSheetProps) {
  const pnlNumber = Number(pnl.realizedPnl);
  const isGain = pnlNumber >= 0;
  const hasDividends = Number(breakdown.totalDividends) !== 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup>
        <div className="mb-4 flex items-center gap-3">
          <SymbolAvatar
            symbol={identity.symbol}
            colorClassName={
              isGain
                ? "bg-gain/16 text-gain"
                : "bg-destructive/16 text-destructive"
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-foreground">
                {identity.name ?? identity.symbol}
              </span>
              <Badge variant="neutral" className="shrink-0">
                Đã bán hết
              </Badge>
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-muted-faint">
              <AssetTypeBadge
                assetType={identity.type}
                className="bg-transparent px-0 py-0"
              />{" "}
              · {identity.symbol}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mb-3.5 rounded-2xl border p-4",
            isGain
              ? "border-gain/28 bg-linear-to-br from-gain/14 to-card"
              : "border-destructive/28 bg-linear-to-br from-destructive/14 to-card",
          )}
        >
          <div className="text-[12.5px] font-semibold text-muted-foreground">
            Lãi/lỗ đã chốt
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums",
              signColorClass(pnlNumber),
            )}
          >
            {formatMoney(pnl.realizedPnl, { hidden })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "font-mono text-[13px] font-semibold tabular-nums",
                signColorClass(pnlNumber),
              )}
            >
              {formatSignedPercent(pnl.realizedPnlPercent)}
            </span>
            {pnl.xirrRealized.status === "OK" ? (
              <span className="rounded-full bg-primary/14 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                XIRR chốt {formatSignedPercent(pnl.xirrRealized.percentPerYear)}
                /năm
              </span>
            ) : (
              <span className="rounded-full bg-warning/14 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                XIRR {formatXirrLabel(pnl.xirrRealized)}
              </span>
            )}
          </div>
        </div>

        <div className="mb-3.5 flex items-center justify-between rounded-2xl border border-border bg-card p-3.5">
          <div>
            <div className="text-[11.5px] font-semibold text-muted-foreground">
              Thời gian nắm giữ
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-foreground">
              {holdingPeriod.holdingPeriodLabel}
            </div>
          </div>
          <div className="font-mono text-[12px] text-muted-faint tabular-nums">
            {holdingPeriod.startMonthLabel} → {holdingPeriod.endMonthLabel}
          </div>
        </div>

        <div className="mb-3.5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-white/5 p-3">
            <span className="text-[12px] text-muted-foreground">
              Tổng vốn mua vào · gồm phí mua
            </span>
            <span className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
              {formatMoney(breakdown.totalInvested, { hidden })}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 p-3">
            <span className="text-[12px] text-muted-foreground">
              Tổng tiền bán ra · thực nhận
            </span>
            <span className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
              {formatMoney(breakdown.totalProceeds, { hidden })}
            </span>
          </div>
          {hasDividends ? (
            <div className="flex items-center justify-between border-b border-white/5 p-3">
              <span className="text-[12px] text-muted-foreground">
                Cổ tức tiền mặt đã nhận
              </span>
              <span className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
                {formatMoney(breakdown.totalDividends, { hidden })}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between bg-white/3 p-3">
            <span className="text-[12px] font-semibold text-foreground">
              Chênh lệch (đã chốt)
            </span>
            <span
              className={cn(
                "font-mono text-[13px] font-semibold tabular-nums",
                signColorClass(pnlNumber),
              )}
            >
              {formatMoney(pnl.realizedPnl, { hidden })}
            </span>
          </div>
        </div>

        <div className="mb-1.5 text-[12.5px] font-semibold text-foreground">
          Dòng lệnh của mã
        </div>
        <CashflowTimeline rows={orders} hidden={hidden} className="mb-4" />

        <div className="flex flex-col gap-2">
          <Link href={actions.reopenHref} className={cn(buttonVariants())}>
            <ShoppingCart className="size-4" />
            Mở lại vị thế
          </Link>
          <Link
            href={actions.detailHref}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Pencil className="size-4" />
            Sửa / xoá giao dịch đã ghi
          </Link>
          <div className="text-center text-[10.5px] leading-relaxed text-muted-faint">
            Mở lại vị thế chỉ mở form Mua điền sẵn mã này — không đụng tới lịch
            sử đã chốt. Cần sửa/xoá giao dịch cũ (vd ghi nhầm) thì vào chi tiết
            vị thế.
          </div>
        </div>
      </SheetPopup>
    </Sheet>
  );
}

export { ClosedPositionSheet };
export type { ClosedPositionSheetProps };
