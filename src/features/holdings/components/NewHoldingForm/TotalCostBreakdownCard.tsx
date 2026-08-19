import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type TotalCostBreakdownCardProps = {
  orderValue: string; // SL × giá, Decimal serialize
  orderValueFormula: string; // "100 × 100.000" — đã compose sẵn bởi caller
  feeAmount: string; // giá trị HIỆU LỰC của card phí (manualValue ?? computedAmount)
  feePercentLabel: string; // "0,3%" — đã compose sẵn (có thể rỗng nếu chưa biết %)
  total: string; // orderValue + feeAmount
  avgCostPerUnit: string; // total / quantity — hiển thị ở note cuối
  className?: string;
};

// Box tổng cho nhánh "Vừa mua hôm nay" (issue #140, mockup vtc) — thay cho
// box dashed đơn giản của nhánh "Đã có từ trước". Không sửa tay được (khác
// AutoFilledAmountCard), chỉ hiển thị tổng hợp 3 dòng đã tính sẵn bởi cha.
function TotalCostBreakdownCard({
  orderValue,
  orderValueFormula,
  feeAmount,
  feePercentLabel,
  total,
  avgCostPerUnit,
  className,
}: TotalCostBreakdownCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 px-3.75 py-3.25">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[12.5px] text-muted-foreground">
            Giá trị lệnh
          </span>
          <div className="text-right">
            <div className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
              {formatMoney(orderValue)}
            </div>
            <div className="font-mono text-[10.5px] text-muted-faint tabular-nums">
              {orderValueFormula}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-muted-foreground">
            Phí giao dịch{feePercentLabel ? ` (${feePercentLabel})` : ""}
          </span>
          <span className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
            +{formatMoney(feeAmount)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-white/2 px-3.75 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Tổng tiền đã chi
        </span>
        <span className="font-mono text-[17px] font-bold tabular-nums text-primary">
          {formatMoney(total)}
        </span>
      </div>

      <div className="border-t border-white/5 px-3.75 py-2.5 text-[10.5px] leading-relaxed text-muted-faint">
        Giá vốn bình quân lưu lại{" "}
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatMoney(avgCostPerUnit)}/CP
        </span>{" "}
        — đã gồm phí.
      </div>
    </div>
  );
}

export { TotalCostBreakdownCard };
export type { TotalCostBreakdownCardProps };
