"use client";

import {
  ChevronsUpDown,
  CircleSlash,
  Info,
  LineChart as LineChartIcon,
  ListFilter,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import {
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
} from "@/components/AssetTypeBadge";
import { EmptyState } from "@/components/EmptyState";
import { PercentChange } from "@/components/PercentChange";
import { SegmentedControl } from "@/components/SegmentedControl";
import { buttonVariants } from "@/components/ui/button";
import { PERIOD_OPTIONS } from "@/features/dashboard/components/NavTrendChart";
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  signColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { AssetTypeFilterChips } from "./AssetTypeFilterChips";
import type {
  AssetType,
  AssetTypeFilter,
  AssetTypeFilterOption,
  NavTrendByAssetTypeChartProps,
  NavTrendPeriod,
  NavTrendPoint,
} from "./types";

// Màu đường/gradient theo loại đang lọc (mockup: "Một đường · một trục Y tại
// một thời điểm") — asset-* cho từng loại, primary khi xem "Tất cả". KHÔNG
// tái dùng thẳng NavTrendChart.tsx (component-architecture: tách hẳn component
// mới, chấp nhận trùng lặp logic Area/gradient/Tooltip, tránh đổi hành vi
// NavTrendChart gốc đang chạy thật trên Dashboard — orchestrator đã chốt).
const ASSET_TYPE_STROKE_VAR: Record<AssetTypeFilter, string> = {
  ALL: "var(--color-primary)",
  STOCK: "var(--color-asset-stock)",
  FUND: "var(--color-asset-fund)",
  BOND: "var(--color-asset-bond)",
  GOLD: "var(--color-asset-gold)",
};

// "+24.000.000 ₫" — depositedInPeriod digest ghi "CÓ dấu" (mockup luôn hiện +
// tường minh cho số dương, giống cách formatSignedPercent tự thêm +/-).
// formatMoney() không tự thêm "+" cho số dương (chỉ Intl currency format bình
// thường) nên bọc thêm ở đây thay vì sửa formatMoney dùng chung nhiều nơi khác
// (chỉ card insight này cần hành vi "luôn có dấu").
function formatSignedMoney(value: string, hidden: boolean): string {
  if (hidden) return "••••••";
  const amount = Number(value);
  return `${amount >= 0 ? "+" : ""}${formatMoney(value)}`;
}

function ChartTooltip({
  active,
  payload,
  hidden,
}: TooltipContentProps & { hidden: boolean }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as NavTrendPoint;

  return (
    <div className="rounded-xl border border-border bg-card-elevated p-2.75 shadow-lg">
      <div className="font-mono text-[10.5px] text-muted-faint tabular-nums">
        {formatDate(point.date)}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-semibold text-foreground tabular-nums">
        {formatMoney(point.value, { hidden })}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[11px] font-semibold tabular-nums",
          signColorClass(point.changePercentFromStart),
        )}
      >
        {formatSignedPercent(point.changePercentFromStart)} từ đầu kỳ
      </div>
    </div>
  );
}

// Chú thích "gồm cả tiền nạp/rút" (Kiểu 2 đã chốt, xem digest mục "Quyết định
// đã chốt") — dựng RIÊNG, KHÔNG qua <Alert> dùng chung: nội dung mockup là MỘT
// đoạn văn liền có đúng 1-2 cụm bold XEN GIỮA câu (không phải cấu trúc
// title/description 2 tầng cỡ chữ khác nhau như Alert), và Alert.description
// hiện chỉ nhận `string`. Nới kiểu Alert sang ReactNode sẽ không ảnh hưởng các
// call site khác (string vẫn gán được), nhưng đổi type của một component dùng
// chung ở ~14 nơi là rủi ro không cần thiết cho một note box chỉ dùng ở đúng 1
// màn — viết riêng tại đây AN TOÀN hơn (component-architecture.md: bọc lại
// thay vì sửa atom dùng chung khi không thật cần).
function NoteBox({
  assetType,
  changePercent,
  className,
}: {
  assetType: AssetTypeFilter;
  changePercent: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.25 rounded-xl border border-primary/22 bg-primary/8 p-2.75",
        className,
      )}
    >
      <Info className="mt-0.5 size-4.25 shrink-0 text-primary" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {assetType === "ALL" ? (
          <>
            <b className="text-primary">
              Đường này gồm cả tiền nạp/rút, không chỉ lãi/lỗ.
            </b>{" "}
            NAV tăng có thể vì bạn nạp thêm tiền mua. Muốn xem hiệu quả thật,
            hãy xem <b className="text-foreground-soft">XIRR</b>.
          </>
        ) : (
          <>
            <b className="text-primary">
              {formatSignedPercent(changePercent)} này gồm cả tiền bạn nạp thêm
              để mua, không chỉ lãi/lỗ.
            </b>{" "}
            Đường NAV lên/xuống vì hai lý do độc lập: giá thị trường và tiền
            nạp/rút. Hiệu quả thật xem ở{" "}
            <b className="text-foreground-soft">
              XIRR nhóm {ASSET_TYPE_LABEL[assetType]}
            </b>
            .
          </>
        )}
      </p>
    </div>
  );
}

// Banner trung tính khi xem "Tất cả" (139a) — KHÔNG có atom khớp sẵn (không
// phải Alert info/error, không phải warning), dựng inline vì chỉ dùng đúng 1
// chỗ (digest mục "Atom/molecule dùng lại").
function AllTypeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-2.25 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      <ListFilter className="mt-0.5 size-4.25 shrink-0 text-muted-faint" />
      <p className="text-[11px] leading-relaxed text-muted-faint">
        Đang xem <b className="text-muted-foreground">gộp toàn bộ 4 loại</b> —
        đường màu thương hiệu. Chọn một loại ở bộ lọc trên để xem riêng loại đó
        với thang trục Y phù hợp quy mô của nó.
      </p>
    </div>
  );
}

// Card insight biến thể 1 (139b) — XIRR nhóm + Nạp thêm trong kỳ.
function XirrDepositedCard({
  assetType,
  groupXirrPercent,
  depositedInPeriod,
  hidden,
  className,
}: {
  assetType: AssetType;
  groupXirrPercent: number;
  depositedInPeriod: string;
  hidden: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5 rounded-[14px] border border-border bg-card p-3.25">
        <div className="flex-1">
          <div className="text-[10px] font-semibold tracking-wide text-muted-faint uppercase">
            XIRR nhóm {ASSET_TYPE_LABEL[assetType]}
          </div>
          <div
            className={cn(
              "mt-0.75 font-mono text-[15px] font-semibold",
              signColorClass(groupXirrPercent),
            )}
          >
            {formatSignedPercent(groupXirrPercent, { suffix: "/năm" })}
          </div>
        </div>
        <div className="h-8.5 w-px bg-white/7" />
        <div className="flex-1">
          <div className="text-[10px] font-semibold tracking-wide text-muted-faint uppercase">
            Nạp thêm trong kỳ
          </div>
          <div className="mt-0.75 font-mono text-[15px] font-semibold text-foreground-soft">
            {formatSignedMoney(depositedInPeriod, hidden)}
          </div>
        </div>
      </div>
      <p className="mt-2.25 px-1 text-[10.5px] leading-relaxed text-muted-faint">
        Hai con số trên là cách tách bạch hai nguyên nhân:{" "}
        <b className="text-muted-foreground">XIRR</b> = hiệu quả,{" "}
        <b className="text-muted-foreground">nạp thêm</b> = phần NAV tăng do
        dòng tiền.
      </p>
    </div>
  );
}

// Card insight biến thể 2 (139c) — callout "vì sao trục riêng" (amber) đi kèm
// Cao nhất/Thấp nhất kỳ. Ghép chung 1 unit vì mockup luôn hiện cùng nhau khi
// dùng biến thể cao/thấp nhất — xem digest mục "Điểm cần xác nhận" #1 (phần
// callout "có thể là copy tĩnh dùng chung mọi loại phi-ALL" — design-implementer
// tự chốt: gắn liền với biến thể periodHigh/periodLow, không tách điều kiện
// riêng vì không có field nào khác để quyết định độc lập).
function HighLowCard({
  assetType,
  periodHigh,
  periodLow,
  periodSpreadPercent,
  hidden,
  className,
}: {
  assetType: AssetTypeFilter;
  periodHigh: string;
  periodLow: string;
  periodSpreadPercent?: number;
  hidden: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {assetType !== "ALL" ? (
        <div className="flex items-start gap-2.25 rounded-xl border border-warning/25 bg-warning/8 p-3">
          <ChevronsUpDown className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-warning">Vì sao mỗi loại một trục riêng.</b> Nếu{" "}
            {ASSET_TYPE_LABEL[assetType]} dùng chung trục với loại có quy mô lớn
            hơn, đường sẽ dẹt sát đáy và khó thấy biến động. Thang riêng giữ mọi
            biến động đọc được.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-background p-2.75">
          <div className="text-[9.5px] font-semibold tracking-wide text-muted-faint uppercase">
            Cao nhất kỳ
          </div>
          <div className="mt-0.75 font-mono text-[13px] font-semibold text-foreground-soft">
            {formatMoney(periodHigh, { hidden })}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-2.75">
          <div className="text-[9.5px] font-semibold tracking-wide text-muted-faint uppercase">
            Thấp nhất kỳ
          </div>
          <div className="mt-0.75 font-mono text-[13px] font-semibold text-foreground-soft">
            {formatMoney(periodLow, { hidden })}
          </div>
        </div>
      </div>
      {periodSpreadPercent !== undefined ? (
        <>
          <div className="rounded-xl border border-border bg-background p-2.75">
            <div className="text-[9.5px] font-semibold tracking-wide text-muted-faint uppercase">
              Biên độ kỳ
            </div>
            <div className="mt-0.75 font-mono text-[13px] font-semibold text-foreground-soft">
              {formatPercent(periodSpreadPercent)}
            </div>
          </div>
          <p className="px-1 text-[10.5px] leading-relaxed text-muted-faint">
            Biên độ này gồm cả biến động giá thị trường lẫn tiền nạp/rút trong
            kỳ, không thuần là giá tăng giảm.
          </p>
        </>
      ) : null}
    </div>
  );
}

// Trạng thái rỗng (139e) — loại chưa từng có vị thế. Icon dùng CHUNG `Wallet`
// cho mọi loại (orchestrator đã chốt, tránh over-engineer bộ icon riêng từng
// loại khi mockup chỉ minh hoạ đúng 1 trường hợp).
function EmptyAssetTypeState({
  assetType,
  filters,
  newHoldingHref,
  onSelectType,
}: {
  assetType: AssetType;
  filters: AssetTypeFilterOption[];
  newHoldingHref: string;
  onSelectType: (type: AssetTypeFilter) => void;
}) {
  const label = ASSET_TYPE_LABEL[assetType];
  // "N loại còn lại đã có dữ liệu" — render ĐỘNG theo dữ liệu thật (KHÔNG
  // hardcode "3 loại", orchestrator đã chốt điểm #6 digest), loại trừ ALL và
  // chính loại đang xem.
  const remaining = filters.filter(
    (f): f is AssetTypeFilterOption & { type: AssetType } =>
      f.hasData && f.type !== "ALL" && f.type !== assetType,
  );

  return (
    <div className="flex flex-col">
      <AssetTypeFilterChips
        filters={filters}
        value={assetType}
        onChange={onSelectType}
        className="mb-3.5"
      />

      <EmptyState
        icon={Wallet}
        title={`Bạn chưa có vị thế ${label} nào`}
        description={`Chưa có giao dịch ${label.toLowerCase()} nào được ghi nhận, nên không có đường NAV để vẽ cho loại này.`}
        action={
          <div className="flex flex-col items-center gap-1.5">
            <Link
              href={newHoldingHref}
              className={cn(buttonVariants({ size: "lg" }), "rounded-xl px-5")}
            >
              + Thêm vị thế {label}
            </Link>
            <button
              type="button"
              onClick={() => onSelectType("ALL")}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Xem lại toàn danh mục
            </button>
          </div>
        }
      />

      <div className="mt-3 flex gap-2.25 rounded-xl border border-border bg-card p-3">
        <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-faint" />
        <p className="text-[11px] leading-relaxed text-muted-faint">
          Không vẽ biểu đồ trống hay đường phẳng ở 0 ₫ —{" "}
          <b className="text-muted-foreground">&quot;chưa mua bao giờ&quot;</b>{" "}
          khác hẳn{" "}
          <b className="text-muted-foreground">
            &quot;có vị thế nhưng giá không đổi&quot;
          </b>
          , đường phẳng sẽ bị đọc thành {label.toLowerCase()} không sinh lời.
        </p>
      </div>

      {remaining.length > 0 ? (
        <div className="mt-3 rounded-[14px] border border-border bg-background p-3.5">
          <div className="mb-2.25 text-[10px] font-semibold tracking-wide text-muted-faint uppercase">
            {remaining.length} loại còn lại đã có dữ liệu
          </div>
          <div className="flex flex-col gap-2">
            {remaining.map((filter) => (
              <div key={filter.type} className="flex items-center gap-2.25">
                <span
                  className={cn(
                    "size-1.75 rounded-sm",
                    ASSET_TYPE_DOT_CLASS[filter.type],
                  )}
                />
                <span className="flex-1 text-[12.5px] font-medium text-foreground-soft">
                  {ASSET_TYPE_LABEL[filter.type]}
                </span>
                <span
                  className={cn(
                    "font-mono text-[12px] font-semibold",
                    signColorClass(filter.latestChangePercent ?? 0),
                  )}
                >
                  {formatSignedPercent(filter.latestChangePercent ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Biểu đồ NAV theo loại tài sản (139a-e, issue #139) — TÁCH RIÊNG khỏi
// NavTrendChart.tsx (không phải biến thể dùng chung), giữ state client nội bộ
// CẢ `assetType` lẫn `period` vì dữ liệu đã tải sẵn hết tổ hợp từ container
// (xem digest mục "Điểm cần xác nhận" #2 — preload có hợp lý không NGOÀI PHẠM
// VI Presentational). Client leaf trực tiếp (KHÔNG hậu tố Screen/Section),
// giống tiền lệ NavTrendChart hiện tại.
function NavTrendByAssetTypeChart({
  filters,
  dataByFilter,
  hidden = false,
  newHoldingHrefByType,
}: NavTrendByAssetTypeChartProps) {
  const [assetType, setAssetType] = useState<AssetTypeFilter>("ALL");
  const [period, setPeriod] = useState<NavTrendPeriod>("YEAR");

  // Loại chưa từng có vị thế (139e) — chỉ áp dụng cho loại CỤ THỂ, không cho
  // "Tất cả" (portfolio hoàn toàn rỗng là ca ngoài phạm vi màn này, Dashboard
  // đã tự chặn ở tầng trước đó).
  if (
    assetType !== "ALL" &&
    filters.find((f) => f.type === assetType)?.hasData === false
  ) {
    return (
      <EmptyAssetTypeState
        assetType={assetType}
        filters={filters}
        newHoldingHref={newHoldingHrefByType[assetType]}
        onSelectType={setAssetType}
      />
    );
  }

  const periodData = dataByFilter[assetType][period];
  const chartPoints = periodData.points.map((p) => ({
    ...p,
    valueNumber: Number(p.value),
  }));
  const hasLine = chartPoints.length >= 2;
  const strokeColor = ASSET_TYPE_STROKE_VAR[assetType];
  const navLabel =
    assetType === "ALL" ? "toàn danh mục" : ASSET_TYPE_LABEL[assetType];

  return (
    <div className="flex flex-col">
      <AssetTypeFilterChips
        filters={filters}
        value={assetType}
        onChange={setAssetType}
        className="mb-3.5"
      />

      <div className="rounded-[18px] border border-border bg-card p-4 pt-4">
        <div className="flex items-end justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              {assetType !== "ALL" ? (
                <span
                  className={cn(
                    "size-1.75 rounded-sm",
                    ASSET_TYPE_DOT_CLASS[assetType],
                  )}
                />
              ) : null}
              <span className="text-[10px] font-semibold tracking-wide text-muted-faint uppercase">
                NAV cuối kỳ · {navLabel}
              </span>
            </div>
            <div className="mt-0.75 font-mono text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
              {formatMoney(periodData.navAmount, { hidden })}
            </div>
          </div>
          <PercentChange
            value={periodData.changePercent}
            className="shrink-0"
          />
        </div>

        {hasLine ? (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart
                data={chartPoints}
                margin={{ top: 14, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="navTrendByAssetTypeFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={strokeColor}
                      stopOpacity={0.32}
                    />
                    <stop
                      offset="100%"
                      stopColor={strokeColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <YAxis
                  domain={["dataMin", "dataMax"]}
                  tickCount={4}
                  tickFormatter={(value: number) =>
                    formatMoney(String(value), { compact: true, hidden })
                  }
                  tick={{ fontSize: 9.5, fill: "var(--color-muted-faint)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDayMonth(value)}
                  tick={{ fontSize: 9.5, fill: "var(--color-muted-faint)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={32}
                />
                <Tooltip
                  content={(props: TooltipContentProps) => (
                    <ChartTooltip {...props} hidden={hidden} />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="valueNumber"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill="url(#navTrendByAssetTypeFill)"
                  dot={false}
                  activeDot={{ r: 4.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/14 p-5 text-center">
            <LineChartIcon className="mx-auto mb-2.5 size-7 text-muted-faint" />
            <div className="text-[13px] font-semibold text-foreground">
              Chưa vẽ được đường NAV
            </div>
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-faint">
              Cần ít nhất 2 mốc snapshot để nối thành đường. Hiện mới có{" "}
              {chartPoints.length} mốc (hôm nay).
            </div>
          </div>
        )}

        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          stretch
          className="mt-3.5"
        />

        {hasLine ? (
          <NoteBox
            assetType={assetType}
            changePercent={periodData.changePercent}
            className="mt-3"
          />
        ) : null}
      </div>

      {assetType === "ALL" ? (
        <>
          <AllTypeBanner className="mt-3" />
          {hasLine &&
          periodData.periodHigh !== undefined &&
          periodData.periodLow !== undefined ? (
            <HighLowCard
              assetType={assetType}
              periodHigh={periodData.periodHigh}
              periodLow={periodData.periodLow}
              periodSpreadPercent={periodData.periodSpreadPercent}
              hidden={hidden}
              className="mt-3"
            />
          ) : null}
        </>
      ) : hasLine ? (
        periodData.groupXirrPercent !== undefined &&
        periodData.depositedInPeriod !== undefined ? (
          <XirrDepositedCard
            assetType={assetType}
            groupXirrPercent={periodData.groupXirrPercent}
            depositedInPeriod={periodData.depositedInPeriod}
            hidden={hidden}
            className="mt-3"
          />
        ) : periodData.periodHigh !== undefined &&
          periodData.periodLow !== undefined ? (
          <HighLowCard
            assetType={assetType}
            periodHigh={periodData.periodHigh}
            periodLow={periodData.periodLow}
            periodSpreadPercent={periodData.periodSpreadPercent}
            hidden={hidden}
            className="mt-3"
          />
        ) : null
      ) : null}
    </div>
  );
}

export { NavTrendByAssetTypeChart };
export type {
  AssetType,
  AssetTypeFilter,
  AssetTypeFilterOption,
  NavTrendByAssetTypeChartProps,
  NavTrendByAssetTypePeriodData,
} from "./types";
