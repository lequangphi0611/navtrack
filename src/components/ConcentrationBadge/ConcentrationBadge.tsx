import { EyeOff, HelpCircle, Info, PieChart } from "lucide-react";

import type { ConcentrationBadgeState } from "@/lib/concentration";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type ConcentrationBadgeProps = {
  state: ConcentrationBadgeState;
  // Ẩn hộp ghi chú phụ (biến thể 2/3/4) — dùng khi nhúng vào dòng danh sách
  // chật chội (HoldingsGroupCard), chỉ cần pill %. Mặc định hiện đủ (dùng ở
  // ngữ cảnh có nhiều chỗ hơn, vd panel tham khảo/preview).
  showNote?: boolean;
  className?: string;
};

// 4 biến thể badge cảnh báo tập trung (docs/domain/04-pricing-and-valuation.md
// mục "Cảnh báo tập trung", process/UI_phase_6.md mục 6, 6j) — ngôn ngữ trung
// tính (không đỏ gắt/khuyến nghị), chỉ nêu tỷ trọng thực tế. Icon `warning`
// (biến thể SUPPRESSED) là ngoại lệ DUY NHẤT dùng tông đỏ nhạt (banner "thiếu
// dữ liệu", không phải "cảnh báo rủi ro đầu tư"). Hysteresis KHÔNG có biến thể
// UI riêng — chỉ đổi THỜI ĐIỂM bật/tắt, không đổi giao diện.
function ConcentrationBadge({
  state,
  showNote = true,
  className,
}: ConcentrationBadgeProps) {
  if (state.kind === "SUPPRESSED") {
    return (
      <div className={cn("flex flex-col items-end gap-1.5", className)}>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
          <EyeOff className="size-3" />
          Tạm ẩn
        </span>
        {showNote ? (
          <div className="flex max-w-56 items-start gap-1.5 rounded-lg border border-destructive/24 bg-destructive/8 p-2 text-left text-[10.5px] leading-snug text-destructive">
            <Info className="mt-0.25 size-3.25 shrink-0" />
            <span>
              <span className="font-semibold">Tạm ẩn cảnh báo tập trung.</span>{" "}
              {formatPercent(state.missingPriceSharePercent)} NAV chưa có giá —
              tỷ trọng có thể sai lệch, nên tạm không hiển thị %. Cập nhật giá
              để tính lại.
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  const isPartial = state.kind === "PARTIAL_NAV";
  const percentLabel = `${isPartial ? "~" : ""}${formatPercent(state.percent)} danh mục`;

  return (
    <div className={cn("flex flex-col items-end gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/14 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-warning">
        <PieChart className="size-3" />
        {percentLabel}
      </span>

      {showNote && state.kind === "NATURAL_CONCENTRATION" ? (
        <div className="flex max-w-56 items-start gap-1.5 rounded-lg border border-border bg-card p-2 text-left text-[10.5px] leading-snug text-muted-foreground">
          <Info className="mt-0.25 size-3.25 shrink-0 text-muted-faint" />
          <span>
            Tập trung tự nhiên do bạn chỉ giữ{" "}
            <span className="font-semibold text-foreground">
              {state.holdingCount}
            </span>{" "}
            mã — tỷ trọng cao là bình thường với danh mục nhỏ.
          </span>
        </div>
      ) : null}

      {showNote && state.kind === "PARTIAL_NAV" ? (
        <div className="flex max-w-56 items-start gap-1.5 rounded-lg border border-border bg-card p-2 text-left text-[10.5px] leading-snug text-muted-foreground">
          <HelpCircle className="mt-0.25 size-3.25 shrink-0 text-muted-faint" />
          <span>
            NAV đang thiếu một phần —{" "}
            <span className="font-semibold text-foreground">
              {formatPercent(state.missingPriceSharePercent)}
            </span>{" "}
            tài sản chưa có giá. Tỷ trọng là ước tính (dấu ~).
          </span>
        </div>
      ) : null}
    </div>
  );
}

export { ConcentrationBadge };
export type { ConcentrationBadgeProps };
