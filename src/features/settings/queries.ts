import type { XirrResult } from "@/components/ReturnMetrics";
import type { CutoffOption } from "@/features/settings/components/CutoffPicker";
import { CUTOFF_LABELS, type CutoffKey, resolveCutoffDate } from "@/lib/cutoff";
import { formatDate } from "@/lib/format";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";
import { ROUTES } from "@/lib/routes";

// Trùng cách format ở ReturnMetrics/PercentChange (TODO(format) chung đã ghi
// ở đó) — local riêng cho CutoffPicker, không refactor gộp (ngoài phạm vi
// task wiring mốc chốt).
function formatXirrLabel(xirr: XirrResult): string {
  if (xirr.status !== "OK") return "Chưa tính được";
  const magnitude = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(xirr.percentPerYear));
  const sign =
    xirr.percentPerYear > 0 ? "+" : xirr.percentPerYear < 0 ? "−" : "";
  return `${sign}${magnitude}%/năm`;
}

// 3 lựa chọn mốc chốt cố định cho CutoffPicker (mockup 2e) — mỗi option tự
// tính ngày + XIRR preview của chính nó, không cần biết đang chọn gì
// ("selected" để tô đậm là trách nhiệm riêng của settings/page.tsx đọc từ
// getCutoffSelection()). "Tuỳ chỉnh" (CUSTOM) chưa wiring, không có ở đây.
export async function getCutoffOptions(): Promise<CutoffOption[]> {
  const keys: CutoffKey[] = ["TODAY", "END_OF_MONTH", "END_OF_YEAR"];
  return Promise.all(
    keys.map(async (key) => {
      const cutoffDate = resolveCutoffDate({ key });
      const valuation = await getPortfolioValuation({ key });
      return {
        key,
        label: CUTOFF_LABELS[key],
        date: formatDate(cutoffDate),
        xirrLabel: formatXirrLabel(valuation.xirr),
        href: ROUTES.cutoffAction(key),
      };
    }),
  );
}
