import { CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

import type { BondTermsSummary } from "@/features/dividends/types";
import { formatMoney } from "@/lib/format";

type BondTermsSummaryCardProps = {
  terms: BondTermsSummary;
  // "2 trái phiếu" — đã format ở caller qua formatQuantity(holding.quantity, unit).
  quantityLabel: string;
  editHref: string;
  // Câu chốt dưới thẻ ("Không phải nhập lại mệnh giá hay % mỗi kỳ...") — mockup
  // 7b có, 7c bỏ đi cho gọn vì đã có note pháp lý riêng bên dưới.
  footnote?: string;
};

// Thẻ "Điều khoản đã lưu · chỉ đọc" (mockup Phase 7 Screens 7b/7c) — 4 ô thông
// tin lấy thẳng từ BondTerms + link sửa. KHÔNG biết DividendType (nhận terms
// thuần), nên dùng lại được ở bất kỳ màn nào cần hiện điều khoản chỉ-đọc.
function BondTermsSummaryCard({
  terms,
  quantityLabel,
  editHref,
  footnote,
}: BondTermsSummaryCardProps) {
  const cells = [
    { label: "Mệnh giá", value: formatMoney(terms.parValue) },
    {
      label: "Lãi suất",
      value: terms.couponRatePercent
        ? `${terms.couponRatePercent} %/năm`
        : "Không trả định kỳ",
    },
    {
      label: "Kỳ trả lãi",
      value: terms.couponFrequencyMonths
        ? `${terms.couponFrequencyMonths} tháng/lần`
        : "—",
    },
    { label: "Đang giữ", value: quantityLabel },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-white/5 px-3.75 py-2.75">
        <Lock className="size-4 shrink-0 text-asset-bond" />
        <span className="flex-1 text-[11.5px] font-semibold text-muted-foreground">
          Điều khoản đã lưu · chỉ đọc
        </span>
        <Link
          href={editHref}
          className="text-[11px] font-bold text-primary hover:underline"
        >
          Sửa điều khoản
        </Link>
      </div>
      <div className="grid grid-cols-2 py-1">
        {cells.map((cell) => (
          <div key={cell.label} className="px-3.75 py-2.25">
            <div className="text-[10.5px] text-muted-faint">{cell.label}</div>
            <div className="mt-0.5 font-mono text-[13.5px] font-semibold text-foreground">
              {cell.value}
            </div>
          </div>
        ))}
      </div>
      {footnote ? (
        <div className="flex gap-2 border-t border-white/5 bg-white/2 px-3.75 py-2.5">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-faint" />
          <span className="text-[10.5px] leading-relaxed text-muted-faint">
            {footnote}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export { BondTermsSummaryCard };
export type { BondTermsSummaryCardProps };
