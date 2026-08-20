import { CalendarClock, Sigma, SlidersHorizontal, Zap } from "lucide-react";
import Link from "next/link";

import { MoneyValueToggleButton } from "@/components/MoneyValue";
import type { XirrResult } from "@/components/ReturnMetrics";
import { UserAvatar } from "@/components/UserAvatar";
import {
  AllocationBar,
  type AllocationSlice,
} from "@/features/dashboard/components/AllocationBar";
import { ManualPriceList } from "@/features/dashboard/components/ManualPriceList";
import {
  MissingPriceList,
  type MissingPriceHolding,
} from "@/features/dashboard/components/MissingPriceList";
import {
  NavHeroCard,
  type NavHeroCardProps,
} from "@/features/dashboard/components/NavHeroCard";
import {
  NavTrendChart,
  type NavTrendPeriod,
  type NavTrendPeriodData,
} from "@/features/dashboard/components/NavTrendChart";
import { PnlCostDragCard } from "@/features/dashboard/components/PnlCostDragCard";
import { PortfolioStatsRow } from "@/features/dashboard/components/PortfolioStatsRow";
import {
  SnapshotTodayCard,
  type SnapshotTodayCardProps,
} from "@/features/dashboard/components/SnapshotTodayCard";
import type {
  CostDragBreakdownEntry,
  ManualPriceHolding,
} from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

// Nhóm "Mốc chốt" (mockup 2e/chip điều hướng, docs/domain/05) — chip chỉ hiển
// thị + điều hướng, lựa chọn thật diễn ra ở Cài đặt.
type CutoffGroup = {
  cutoffLabel: string;
  cutoffDate: string;
  cutoffHref: string;
};

// Nhóm dữ liệu cho PnlCostDragCard (mockup 5d) — giữ dạng RAW (không phải
// pnlNote/splitNote đã ghép câu) để khớp NGUYÊN VĂN shape của
// PortfolioValuation (lib/portfolio-valuation.ts): PortfolioOverviewSection
// truyền thẳng `pnl={valuation}` nhờ structural typing, không cần liệt kê tay
// từng field. Thân DashboardScreen tự ghép pnlNote/splitNote từ 2 cờ `*IsPartial`
// (issue #110 — xem lịch sử ghép câu ở bản DashboardScreenProps 25-field cũ).
type PnlGroup = {
  // Decimal đã serialize — lãi/lỗ thực nhận (đã trừ thuế + phí), có thể âm.
  absolutePnl: string;
  // true khi lãi/lỗ chỉ tính trên phần đã có giá (mockup 2f "Lãi/lỗ (tạm)").
  absolutePnlIsPartial: boolean;
  // Bất biến (issue #67): realizedPnl + unrealizedPnl ≈ absolutePnl.
  realizedPnl: string;
  unrealizedPnl: string;
  // true khi mốc chốt đang chọn khác "hôm nay" — phần tách realized/unrealized
  // ở trên chỉ là ước tính (docs/domain giới hạn cutoff-accuracy đã chốt).
  pnlSplitIsApproximate: boolean;
  // Chi phí ăn mòn (Phase 5, docs/domain/07-tax.md mục "Chi phí ăn mòn").
  costDragAmount: string;
  costDragPercent: number;
  // Vốn GỘP đã triển khai (Σ|BUY.amount|) — KHÁC totalCostBasis (vốn ròng),
  // hiển thị trực tiếp thành chỉ số "Vốn đã bỏ ra mua" (mockup 5d) VÀ dùng lại
  // ở PortfolioStatsRow bên dưới (cùng một nguồn, không lặp field ở nhóm khác).
  grossInvested: string;
  costDragBreakdown: CostDragBreakdownEntry[];
};

// Nhóm "Thiếu giá thị trường" (mockup 2f) — dùng cho note nguồn giá,
// MissingPriceList, VÀ số đếm truyền vào NavHeroCard (navValueIsPartial note).
type PriceStatusGroup = {
  // "Giá tự động cập nhật EOD hôm nay 15:05 · 2 mã dùng giá nhập tay".
  priceFreshnessNote: string;
  // Rỗng = happy path (2a); có phần tử = biến thể "không tính được XIRR" (2f).
  missingPriceHoldings: MissingPriceHolding[];
  // Holding đang mở, ĐANG dùng giá nhập tay (NavOverride) tại mốc chốt — khối
  // mới "Đang dùng giá nhập tay" (khác missingPriceHoldings ở trên, vốn CHƯA
  // có giá nào). design-implementer wiring <ManualPriceList /> từ field này.
  manualPriceHoldings: ManualPriceHolding[];
};

type DashboardScreenProps = {
  displayName: string;
  cutoff: CutoffGroup;
  // Omit hidden/missingCount — DashboardScreen tự tính missingCount từ
  // priceStatus.missingPriceHoldings.length và tự truyền hidden xuống (mirror
  // cách PnlCostDragCard nhận `hidden` riêng, không nhét vào nhóm dữ liệu).
  hero: Omit<NavHeroCardProps, "hidden" | "missingCount">;
  pnl: PnlGroup;
  xirr: XirrResult;
  allocation: AllocationSlice[];
  priceStatus: PriceStatusGroup;
  hidden?: boolean;
  // Có mặt = header hiện nút mắt bật/tắt (mockup 6e) — vắng mặt = ẩn nút (vd
  // preview không cần tương tác). Do DashboardScreenClient truyền xuống.
  onToggleHidden?: () => void;
  // Vắng mặt = ẩn card CTA "Chốt số liệu hôm nay" (issue #35 — Container chưa
  // cấp, xem process/UI_phase_3.md).
  snapshotToday?: SnapshotTodayCardProps;
  // Chuỗi NAV theo thời gian (mục 9 phase-6.md, mockup 6a/6b/6c) — cả 3 kỳ đã
  // tải sẵn (xem NavTrendChart). Vắng mặt = ẩn hẳn card biểu đồ (Container chưa
  // cấp — không nên xảy ra ở route "/" thật, chỉ để backward-compat).
  navTrend?: Record<NavTrendPeriod, NavTrendPeriodData>;
  // MỚI (issue #139/#141) — href header "Giá trị tài sản" của NavTrendChart
  // dẫn tới /nav-chart (biến động NAV theo loại tài sản). Vắng mặt = NavTrendChart
  // giữ header dạng text tĩnh (xem NavTrendChartProps.navTrendHref).
  navTrendHref?: string;
};

// Organism Phase 2 cho "/" (Dashboard NAV + XIRR, mockup 2a) — cũng tái dùng cho
// biến thể "không tính được XIRR" (2f) khi missingPriceHoldings không rỗng, thay
// vì tách 2 component riêng (cùng một khung dữ liệu, chỉ khác nhánh hiển thị).
//
// Props gộp theo VÙNG UI (issue #110, thay vì 25 field phẳng sao y
// PortfolioValuation) — CHỈ nhóm DATA thuần (string/number/object), KHÔNG dùng
// JSX slot: subtree này nằm trong DashboardScreenClient (giữ state `hidden`
// cho nút mắt) — nếu một vùng được truyền vào dưới dạng JSX Server Component
// đã render sẵn, vùng đó sẽ "đông cứng" tại giá trị `hidden` lúc stream, không
// re-render khi bấm nút mắt (xem ghi chú kiến trúc ở DashboardScreenClient.tsx
// và PortfolioOverviewSection.tsx). DashboardScreen vẫn tự render JSX của mọi
// vùng bên trong nó như cũ.
//
// Route "/" (`src/app/(dashboard)/page.tsx`) render component này trực tiếp,
// truyền props từ `getPortfolioValuation` + `getManualSnapshotToday`.
function DashboardScreen({
  displayName,
  cutoff,
  hero,
  pnl,
  xirr,
  allocation,
  priceStatus,
  hidden = false,
  onToggleHidden,
  snapshotToday,
  navTrend,
  navTrendHref,
}: DashboardScreenProps) {
  const pnlNote = pnl.absolutePnlIsPartial
    ? "Chỉ trên phần có giá — đã trừ thuế & phí."
    : "Đã trừ cả thuế lẫn phí — số thực nhận, không phải trên giấy.";
  const splitNote = pnl.pnlSplitIsApproximate
    ? "*Ước tính — có thể lệch khi xem theo mốc chốt khác hôm nay."
    : undefined;

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
        <div className="flex items-center gap-2">
          {onToggleHidden ? (
            <MoneyValueToggleButton
              hidden={hidden}
              onToggleHidden={onToggleHidden}
              className="bg-card"
            />
          ) : null}
          <Link href={ROUTES.settings} aria-label="Cài đặt">
            <UserAvatar name={displayName} />
          </Link>
        </div>
      </div>

      <Link
        href={cutoff.cutoffHref}
        className="flex items-center gap-2.25 rounded-xl border border-border bg-card px-3.25 py-2.5"
      >
        <CalendarClock className="size-4.25 text-primary" />
        <span className="text-[12.5px] font-medium text-muted-foreground">
          Mốc chốt
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {cutoff.cutoffLabel}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[11.5px] text-muted-faint tabular-nums">
          {cutoff.cutoffDate}
        </span>
        <SlidersHorizontal className="size-4 text-muted-faint" />
      </Link>

      <NavHeroCard
        {...hero}
        missingCount={priceStatus.missingPriceHoldings.length}
        hidden={hidden}
      />

      {snapshotToday ? (
        <SnapshotTodayCard id="snapshot-today-card" {...snapshotToday} />
      ) : null}

      {navTrend ? (
        <NavTrendChart
          data={navTrend}
          hidden={hidden}
          navTrendHref={navTrendHref}
        />
      ) : null}

      <PnlCostDragCard
        pnlValue={pnl.absolutePnl}
        pnlNote={pnlNote}
        realizedPnl={pnl.realizedPnl}
        unrealizedPnl={pnl.unrealizedPnl}
        splitNote={splitNote}
        costDragAmount={pnl.costDragAmount}
        costDragPercent={pnl.costDragPercent}
        grossInvested={pnl.grossInvested}
        costDragBreakdown={pnl.costDragBreakdown}
        hidden={hidden}
      />

      <PortfolioStatsRow
        xirr={xirr}
        grossInvested={pnl.grossInvested}
        hidden={hidden}
      />

      <Link href={ROUTES.allocation} aria-label="Xem phân bổ tài sản chi tiết">
        <AllocationBar slices={allocation} />
      </Link>

      {priceStatus.priceFreshnessNote ? (
        <div className="flex items-center gap-2.25 rounded-xl border border-border bg-card px-3.25 py-2.75">
          <Zap className="size-4.25 text-gain" />
          <div className="flex-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {priceStatus.priceFreshnessNote}
          </div>
        </div>
      ) : null}

      <MissingPriceList holdings={priceStatus.missingPriceHoldings} />

      <ManualPriceList holdings={priceStatus.manualPriceHoldings} />

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
    </div>
  );
}

export { DashboardScreen };
export type { DashboardScreenProps };
