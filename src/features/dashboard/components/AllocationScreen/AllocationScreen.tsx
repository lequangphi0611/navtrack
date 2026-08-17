import { ChevronRight, PieChart as PieChartIcon } from "lucide-react";
import Link from "next/link";

import {
  type AssetType,
  ASSET_TYPE_DOT_CLASS,
  ASSET_TYPE_LABEL,
} from "@/components/AssetTypeBadge";
import { MoneyValueToggleButton } from "@/components/MoneyValue";
import { PageHeader } from "@/components/PageHeader";
import { PercentChange } from "@/components/PercentChange";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, signColorClass } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { AllocationDonutChart } from "./AllocationDonutChart";

type AllocationDonutSlice = {
  type: AssetType;
  // 0-100, KHÔNG bị ẩn bởi chế độ ẩn số tiền (chỉ ẩn VND tuyệt đối, giữ %).
  percent: number;
  note?: string; // "· gồm CCQ" cho FUND

  // MỚI (issue #130, process/UI_allocation-group-pnl.md) — NAV ròng + lãi/lỗ
  // theo vốn CỦA RIÊNG NHÓM. navAmount/pnlAmount là Decimal đã serialize, ẨN
  // theo `hidden`; pnlPercent KHÔNG bao giờ bị ẩn (cùng quy tắc `percent`).
  navAmount: string;
  pnlAmount: string;
  pnlPercent: number;
  // true khi nhóm có >= 1 mã MISSING_PRICE — navAmount/pnlAmount/pnlPercent
  // khi đó chỉ tính trên các mã ĐÃ định giá (loại mã thiếu giá, không mặc
  // định 0), pricedCount/totalCount/missingSymbolsLabel chỉ có mặt lúc này.
  navIsPartial: boolean;
  pricedCount?: number;
  totalCount?: number;
  missingSymbolsLabel?: string;
};

type AllocationScreenProps = {
  backHref: string;
  slices: AllocationDonutSlice[];
  // N mã đang vượt ngưỡng cảnh báo tập trung — 0 = ẩn hẳn callout liên kết.
  concentrationWarningCount: number;

  // MỚI (issue #130) — cờ ẩn số tiền + nút mắt header, mirror
  // StockAllocationDetail (hidden mặc định false khi không truyền, nút mắt chỉ
  // hiện khi có onToggleHidden — client wrapper AllocationScreenClient truyền
  // cả hai, preview/route khác có thể bỏ qua để giữ layout cũ không đổi).
  hidden?: boolean;
  onToggleHidden?: () => void;
  // Thẻ tổng NAV/lãi-lỗ đầu trang — Σ navAmount/pnlAmount các nhóm, VND đã
  // serialize (ẨN theo `hidden`). totalPnlPercent KHÔNG bị ẩn.
  totalNavAmount: string;
  totalNavIsPartial: boolean;
  totalPnlAmount: string;
  totalPnlPercent: number;
};

// Màn chi tiết phân bổ tài sản (mockup 6d, route riêng /allocation — mục 10
// phase-6.md) — donut Recharts (PieChart + innerRadius thay conic-gradient CSS
// trong mockup). % KHÔNG bị ẩn bởi chế độ ẩn số tiền (chỉ tiền VND tuyệt đối
// cần ẩn). Mở rộng (issue #130, process/UI_allocation-group-pnl.md): thêm thẻ
// tổng NAV/lãi-lỗ theo vốn cạnh donut + mỗi dòng nhóm thêm dòng NAV ròng/
// lãi-lỗ theo vốn riêng của nhóm đó — donut center GIỮ NGUYÊN (quyết định đã
// chốt trong plan, không đổi AllocationDonutChart.tsx).
function AllocationScreen({
  backHref,
  slices,
  concentrationWarningCount,
  hidden = false,
  onToggleHidden,
  totalNavAmount,
  totalNavIsPartial,
  totalPnlAmount,
  totalPnlPercent,
}: AllocationScreenProps) {
  // Số mã thiếu giá GỘP các nhóm — tính thẳng từ slices (props thuần, không
  // cần field business layer mới) để ghép câu badge "Chưa đầy đủ · N mã thiếu
  // giá" ở thẻ tổng đầu trang.
  const missingSymbolsCount = slices.reduce(
    (sum, slice) =>
      sum +
      ((slice.totalCount ?? slice.pricedCount ?? 0) - (slice.pricedCount ?? 0)),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 p-5 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader
        title="Phân bổ tài sản"
        subtitle={`NAV ròng & lãi/lỗ theo vốn · ${slices.length} nhóm`}
        backHref={backHref}
        trailing={
          onToggleHidden ? (
            <MoneyValueToggleButton
              hidden={hidden}
              onToggleHidden={onToggleHidden}
            />
          ) : undefined
        }
      />

      {slices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-card p-6 text-center text-sm text-muted-foreground">
          Chưa có vị thế nào có giá để tính phân bổ.
        </div>
      ) : (
        <>
          <AllocationDonutChart slices={slices} />

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-muted-foreground">
                Tổng NAV ròng
              </span>
              {totalNavIsPartial ? (
                <Badge variant="warning">
                  Chưa đầy đủ
                  {missingSymbolsCount > 0
                    ? ` · ${missingSymbolsCount} mã thiếu giá`
                    : ""}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 font-mono text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
              {formatMoney(totalNavAmount, { hidden })}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  signColorClass(Number(totalPnlAmount)),
                )}
              >
                {formatMoney(totalPnlAmount, { hidden })}
              </span>
              <PercentChange value={totalPnlPercent} />
              <span className="text-xs text-muted-faint">lãi/lỗ theo vốn</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            {slices.map((slice) => {
              // Chỉ nhóm cổ phiếu có drill-down "% theo mã" (issue #131/#132,
              // process/DECISION.md 2026-08-16) — dòng legend nhóm khác vẫn
              // tĩnh, chưa có view chi tiết theo mã tương ứng.
              const isDrillable = slice.type === "STOCK";
              const navLabel = slice.navIsPartial
                ? `NAV ròng · ${slice.pricedCount}/${slice.totalCount} mã có giá`
                : "NAV ròng";
              const missingCount =
                slice.navIsPartial &&
                slice.totalCount !== undefined &&
                slice.pricedCount !== undefined
                  ? slice.totalCount - slice.pricedCount
                  : 0;

              const rowInner = (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2.5 shrink-0 rounded-sm ${ASSET_TYPE_DOT_CLASS[slice.type]}`}
                    />
                    <span className="text-[13px] text-foreground">
                      {ASSET_TYPE_LABEL[slice.type]}
                      {slice.note ? (
                        <span className="text-muted-faint"> {slice.note}</span>
                      ) : null}
                    </span>
                    <span className="flex-1" />
                    <span className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
                      {formatPercent(slice.percent)}
                    </span>
                    {isDrillable ? (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-faint" />
                    ) : null}
                  </div>

                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-muted-faint">
                        {navLabel}
                      </div>
                      <div className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
                        {formatMoney(slice.navAmount, { hidden })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-faint">
                        Lãi/lỗ theo vốn
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "font-mono text-[12.5px] font-semibold tabular-nums",
                            signColorClass(Number(slice.pnlAmount)),
                          )}
                        >
                          {formatMoney(slice.pnlAmount, { hidden })}
                        </span>
                        <PercentChange value={slice.pnlPercent} />
                      </div>
                    </div>
                  </div>

                  {slice.navIsPartial ? (
                    <div className="mt-2 text-[10.5px] leading-relaxed text-warning">
                      {missingCount} mã thiếu giá ({slice.missingSymbolsLabel})
                      — NAV nhóm {ASSET_TYPE_LABEL[slice.type].toLowerCase()}{" "}
                      chưa đầy đủ. Số trên là NAV và lãi/lỗ của{" "}
                      {slice.pricedCount} mã đã có giá;{" "}
                      {slice.missingSymbolsLabel} chưa được tính vào (không mặc
                      định 0 ₫).
                    </div>
                  ) : null}
                </>
              );

              const rowContent = slice.navIsPartial ? (
                <div className="rounded-xl border border-warning/28 bg-warning/8 p-2.5">
                  {rowInner}
                </div>
              ) : (
                rowInner
              );

              return isDrillable ? (
                <Link
                  key={slice.type}
                  href={ROUTES.allocationStock}
                  className="flex flex-col rounded-lg p-1 transition-colors hover:bg-white/5"
                >
                  {rowContent}
                </Link>
              ) : (
                <div key={slice.type} className="flex flex-col p-1">
                  {rowContent}
                </div>
              );
            })}
          </div>

          {concentrationWarningCount > 0 ? (
            <Link
              href={ROUTES.holdings}
              className="flex items-start gap-2.5 rounded-2xl border border-warning/28 bg-warning/8 p-3.75 transition-colors hover:bg-warning/12"
            >
              <PieChartIcon className="mt-0.5 size-4.5 shrink-0 text-warning" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-warning">
                  {concentrationWarningCount} mã đang vượt ngưỡng tập trung
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Xem bảng vị thế bên dưới.
                </div>
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-warning" />
            </Link>
          ) : null}

          <div className="text-center text-[10.5px] leading-relaxed text-muted-faint">
            % phân bổ luôn hiển thị đầy đủ dù bạn đang bật chế độ ẩn số tiền —
            chỉ số tiền VND tuyệt đối mới bị ẩn.
          </div>
        </>
      )}
    </div>
  );
}

export { AllocationScreen };
export type { AllocationDonutSlice, AllocationScreenProps };
