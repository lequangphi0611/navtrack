import { CheckCheck, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type OverdueMaturityCardProps = {
  symbol: string;
  // "15/01/2029" — ngày đáo hạn theo BondTerms.
  maturityDateLabel: string;
  // Số ngày đã trễ so với ngày đáo hạn — tính ở tầng server, component chỉ hiện.
  lateDays: number;
  // Giá trị vị thế đang tính vào NAV (SL × mệnh giá), Decimal đã serialize.
  positionValue: string;
  // "2 trái phiếu × mệnh giá" — dòng phụ dưới giá trị.
  valueNote: string;
  settleHref: string; // -> màn tất toán đáo hạn (7e)
  recordCouponHref: string; // -> ghi trái tức (7b)
  hidden?: boolean;
};

// Dòng vị thế trái phiếu QUÁ ĐÁO HẠN trong danh mục (mockup Phase 7 Screens
// 7h) — viền/nền amber + badge cảnh báo + hai lối đi tiếp. Tách riêng khỏi
// dòng vị thế thường vì nó có cấu trúc khác hẳn (2 nút hành động + note), không
// phải chỉ đổi màu.
function OverdueMaturityCard({
  symbol,
  maturityDateLabel,
  lateDays,
  positionValue,
  valueNote,
  settleHref,
  recordCouponHref,
  hidden = false,
}: OverdueMaturityCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-warning/34 bg-linear-to-br from-warning/7 to-card">
      <div className="flex items-center gap-3 p-3.5">
        {/* Tint theo loại tài sản (trái phiếu) thay vì màu hash-theo-symbol —
            cả card này chỉ dành cho BOND nên không có ca nào khác. */}
        <SymbolAvatar
          symbol={symbol}
          colorClassName="bg-asset-bond/24 text-asset-bond"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">
              {symbol}
            </span>
            <Badge variant="warning" className="px-1.75 py-0 text-[9px]">
              <TriangleAlert />
              QUÁ ĐÁO HẠN
            </Badge>
          </div>
          <div className="mt-0.75 font-mono text-[10.5px] text-muted-faint">
            Đáo hạn {maturityDateLabel} · trễ {lateDays} ngày
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[13.5px] font-bold text-foreground">
            {formatMoney(positionValue, { hidden, compact: true })}
          </div>
          <div className="font-mono text-[10px] text-muted-faint">
            {valueNote}
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-3.5 pb-3.25">
        <Link
          href={settleHref}
          className={cn(
            buttonVariants(),
            "h-10 flex-1 gap-1.5 rounded-xl bg-warning text-[12.5px] font-bold text-background hover:bg-warning/85",
          )}
        >
          <CheckCheck className="size-4" />
          Tất toán đáo hạn
        </Link>
        <Link
          href={recordCouponHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 rounded-xl px-3.5 text-[12.5px] font-semibold",
          )}
        >
          Ghi trái tức
        </Link>
      </div>

      <div className="flex gap-2 border-t border-white/5 bg-white/2 px-3.5 py-2.5">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-faint" />
        <span className="text-[10.5px] leading-relaxed text-muted-faint">
          App chỉ nêu sự thật dữ liệu — không tự ghi tất toán thay bạn, vì ngày
          tiền thực về có thể lệch.
        </span>
      </div>
    </div>
  );
}

export { OverdueMaturityCard };
export type { OverdueMaturityCardProps };
