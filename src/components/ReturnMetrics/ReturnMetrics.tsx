import { Ban } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Kết quả XIRR — union tường minh khớp docs/domain/05-returns-xirr-and-pnl.md:
// "không tính được" LÀ một kết quả nghiệp vụ (NO_POSITIVE_FLOW/NO_CONVERGE), không
// phải lỗi/NaN/-100%. Dùng chung cho Dashboard (2a/2f) và chi tiết vị thế (2c).
type XirrResult =
  | { status: "OK"; percentPerYear: number }
  | { status: "NO_POSITIVE_FLOW" | "NO_CONVERGE" };

type ReturnMetricsProps = {
  xirr: XirrResult;
  // Ghi chú mờ dưới giá trị XIRR — copy khác nhau theo màn (2a: "Tỷ suất nội hoàn
  // theo dòng tiền thực", 2f: "Thiếu giá cho N mã"); không có = không hiện dòng ghi chú.
  xirrNote?: string;
  // Decimal đã serialize thành string — có thể âm (lỗ).
  pnlValue: string;
  pnlLabel?: string;
  pnlNote?: string;
  hidden?: boolean;
  className?: string;
};

function signColorClass(value: number): string {
  if (value === 0) return "text-foreground";
  return value > 0 ? "text-gain" : "text-destructive";
}

// Trùng cách format ở PercentChange (TODO(format) chung đã ghi ở đó) — giữ nhất
// quán 1 chữ số thập phân, dấu +/− tường minh.
function formatSignedPercent(value: number): string {
  const magnitude = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${magnitude}%`;
}

// Cặp thẻ XIRR (theo năm) + Lãi/lỗ tuyệt đối, luôn hiển thị song song (bất biến
// domain: "Hai chỉ số song song" — docs/domain/README.md). Thẻ XIRR tự chuyển
// sang trạng thái "Chưa tính được" khi status khác "OK", không bao giờ render số.
function ReturnMetrics({
  xirr,
  xirrNote,
  pnlValue,
  pnlLabel = "Lãi/lỗ",
  pnlNote,
  hidden = false,
  className,
}: ReturnMetricsProps) {
  const pnlNumber = Number(pnlValue);
  const xirrUnavailable = xirr.status !== "OK";

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div
        className={cn(
          "rounded-2xl border p-3.75",
          xirrUnavailable
            ? "border-warning/24 bg-warning/7"
            : "border-border bg-card",
        )}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            XIRR
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold",
              xirrUnavailable
                ? "bg-warning/16 text-warning"
                : "bg-primary/14 text-primary",
            )}
          >
            theo năm
          </span>
        </div>
        {xirr.status === "OK" ? (
          <div
            className={cn(
              "font-mono text-[22px] leading-none font-semibold tabular-nums",
              signColorClass(xirr.percentPerYear),
            )}
          >
            {formatSignedPercent(xirr.percentPerYear)}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-warning">
            <Ban className="size-4.5" />
            <span className="text-[15px] font-bold">Chưa tính được</span>
          </div>
        )}
        {xirrNote ? (
          <div className="mt-2 text-[10.5px] leading-snug text-muted-faint">
            {xirrNote}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.75">
        <div className="mb-2 text-[11.5px] font-semibold text-muted-foreground">
          {pnlLabel}
        </div>
        <div
          className={cn(
            "font-mono text-[22px] leading-none font-semibold tabular-nums",
            signColorClass(pnlNumber),
          )}
        >
          {formatMoney(pnlValue, { hidden })}
        </div>
        {pnlNote ? (
          <div className="mt-2 text-[10.5px] leading-snug text-muted-faint">
            {pnlNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ReturnMetrics };
export type { ReturnMetricsProps, XirrResult };
