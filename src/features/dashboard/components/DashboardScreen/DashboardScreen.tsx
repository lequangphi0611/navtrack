import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  Coins,
  History,
  Sigma,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { BottomNav } from "@/components/BottomNav";
import { ReturnMetrics, type XirrResult } from "@/components/ReturnMetrics";
import { UserAvatar } from "@/components/UserAvatar";
import {
  AllocationBar,
  type AllocationSlice,
} from "@/features/dashboard/components/AllocationBar";
import {
  MissingPriceList,
  type MissingPriceHolding,
} from "@/features/dashboard/components/MissingPriceList";
import {
  SnapshotTodayCard,
  type SnapshotTodayCardProps,
} from "@/features/dashboard/components/SnapshotTodayCard";
import { formatMoney, formatSignedPercent, signColorClass } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type DashboardScreenProps = {
  displayName: string;
  // Mốc chốt định giá đang chọn (docs/domain/05: hôm nay/cuối tháng/cuối năm/tùy
  // chỉnh) — lựa chọn thật diễn ra ở Cài đặt (mockup 2e); chip này chỉ hiển thị +
  // điều hướng sang đó (Link thật, không giữ state riêng).
  cutoffLabel: string;
  cutoffDate: string;
  cutoffHref: string;
  // NAV toàn danh mục tại mốc chốt — Decimal đã serialize thành string.
  navValue: string;
  // true khi NAV trên chưa gồm các mã thiếu giá (docs/domain/04 "Thiếu giá" — không
  // được mặc định 0) — ẩn dòng delta, hiện dấu * + ghi chú (mockup 2f).
  navValueIsPartial: boolean;
  navDeltaAmount: string;
  navDeltaPercent: number;
  xirr: XirrResult;
  absolutePnl: string;
  // true khi lãi/lỗ chỉ tính trên phần đã có giá (mockup 2f "Lãi/lỗ (tạm)").
  absolutePnlIsPartial: boolean;
  allocation: AllocationSlice[];
  // "Giá tự động cập nhật EOD hôm nay 15:05 · 2 mã dùng giá nhập tay".
  priceFreshnessNote: string;
  // Rỗng = happy path (2a); có phần tử = biến thể "không tính được XIRR" (2f).
  missingPriceHoldings: MissingPriceHolding[];
  hidden?: boolean;
  // Vắng mặt = ẩn card CTA "Chốt số liệu hôm nay" (issue #35 — Container chưa
  // cấp, xem process/UI_phase_3.md).
  snapshotToday?: SnapshotTodayCardProps;
};

// Organism Phase 2 cho "/" (Dashboard NAV + XIRR, mockup 2a) — cũng tái dùng cho
// biến thể "không tính được XIRR" (2f) khi missingPriceHoldings không rỗng, thay
// vì tách 2 component riêng (cùng một khung dữ liệu, chỉ khác nhánh hiển thị).
//
// Route "/" (`src/app/(dashboard)/page.tsx`) render component này trực tiếp,
// truyền props từ `getPortfolioValuation` + `getManualSnapshotToday`.
function DashboardScreen({
  displayName,
  cutoffLabel,
  cutoffDate,
  cutoffHref,
  navValue,
  navValueIsPartial,
  navDeltaAmount,
  navDeltaPercent,
  xirr,
  absolutePnl,
  absolutePnlIsPartial,
  allocation,
  priceFreshnessNote,
  missingPriceHoldings,
  hidden = false,
  snapshotToday,
}: DashboardScreenProps) {
  const hasMissingPrices = missingPriceHoldings.length > 0;
  const navDeltaNumber = Number(navDeltaAmount);
  const NavDeltaIcon = navDeltaNumber < 0 ? ArrowDown : ArrowUp;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-5 pb-28 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-muted-foreground">
            Tổng tài sản ròng
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground">
            Tổng quan
          </div>
        </div>
        <Link href={ROUTES.settings} aria-label="Cài đặt">
          <UserAvatar name={displayName} />
        </Link>
      </div>

      <Link
        href={cutoffHref}
        className="flex items-center gap-2.25 rounded-xl border border-border bg-card px-3.25 py-2.5"
      >
        <CalendarClock className="size-4.25 text-primary" />
        <span className="text-[12.5px] font-medium text-muted-foreground">
          Mốc chốt
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {cutoffLabel}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[11.5px] text-muted-faint tabular-nums">
          {cutoffDate}
        </span>
        <SlidersHorizontal className="size-4 text-muted-faint" />
      </Link>

      <div className="rounded-2xl border border-primary/28 bg-linear-to-br from-primary/16 to-card p-5">
        <div className="mb-1.75 flex items-center justify-between gap-2">
          <div className="text-[12.5px] font-semibold text-muted-foreground">
            Giá trị thị trường (NAV)
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={ROUTES.snapshots}
              className="flex items-center gap-1 rounded-full bg-primary/14 px-2.5 py-1 text-[11px] font-semibold text-primary"
            >
              <History className="size-3.25" />
              Lịch sử
              <ChevronRight className="size-3.25" />
            </Link>
            {/* Entry point "Cổ tức" (Phase 4, issue #51) — mirror cùng pattern
                pill "Lịch sử" (Phase 3): mở thẳng /dividends/new (mockup
                "Phase 4 Screens" 4f mở FAB quick-menu; đơn giản hoá thành 1
                pill thay vì FAB đầy đủ — xem process/UI_phase_4.md mục
                "Điểm lệch so với plan"). */}
            <Link
              href={ROUTES.newDividendStandalone}
              className="flex items-center gap-1 rounded-full bg-accent/14 px-2.5 py-1 text-[11px] font-semibold text-accent"
            >
              <Coins className="size-3.25" />
              Cổ tức
            </Link>
          </div>
        </div>
        <div className="font-mono text-[28px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
          {formatMoney(navValue, { hidden })}
          {navValueIsPartial ? (
            <span className="text-base font-medium text-muted-faint">*</span>
          ) : null}
        </div>
        {navValueIsPartial ? (
          <div className="mt-2.5 text-[11px] text-muted-faint">
            * Chưa gồm {missingPriceHoldings.length} mã thiếu giá bên dưới.
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <NavDeltaIcon
              className={cn("size-4", signColorClass(navDeltaNumber))}
            />
            <span
              className={cn(
                "font-mono text-sm font-semibold tabular-nums",
                signColorClass(navDeltaNumber),
              )}
            >
              {formatMoney(navDeltaAmount, { hidden })} (
              {formatSignedPercent(navDeltaPercent)})
            </span>
            <span className="text-xs text-muted-faint">
              so với vốn đã bỏ vào
            </span>
          </div>
        )}
      </div>

      {snapshotToday ? <SnapshotTodayCard {...snapshotToday} /> : null}

      <ReturnMetrics
        xirr={xirr}
        xirrNote={
          xirr.status === "OK"
            ? "Tỷ suất nội hoàn theo dòng tiền thực"
            : hasMissingPrices
              ? `Thiếu giá cho ${missingPriceHoldings.length} mã`
              : undefined
        }
        pnlValue={absolutePnl}
        pnlLabel={absolutePnlIsPartial ? "Lãi/lỗ (tạm)" : "Lãi/lỗ tuyệt đối"}
        pnlNote={
          absolutePnlIsPartial
            ? "Chỉ trên phần có giá"
            : "NAV − tổng vốn đã bỏ vào"
        }
        hidden={hidden}
      />

      <AllocationBar slices={allocation} />

      {priceFreshnessNote ? (
        <div className="flex items-center gap-2.25 rounded-xl border border-border bg-card px-3.25 py-2.75">
          <Zap className="size-4.25 text-gain" />
          <div className="flex-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {priceFreshnessNote}
          </div>
        </div>
      ) : null}

      <MissingPriceList holdings={missingPriceHoldings} />

      {xirr.status === "NO_CONVERGE" ? (
        <div className="flex gap-2.5 rounded-2xl border border-border bg-card p-3.75">
          <Sigma className="mt-0.5 size-4.75 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-[12.5px] font-semibold text-foreground">
              Về ca &quot;không hội tụ&quot;
            </div>
            <div className="mt-0.75 text-[11px] leading-relaxed text-muted-faint">
              Nếu dòng tiền không đổi dấu hoặc thuật toán không hội tụ, XIRR trả{" "}
              <span className="text-muted-foreground">
                &quot;Chưa tính được&quot;
              </span>{" "}
              kèm lý do — không bao giờ hiện −100% hay NaN.
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav active="dashboard" />
    </div>
  );
}

export { DashboardScreen };
export type { DashboardScreenProps };
