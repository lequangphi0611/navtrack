import { ArrowDown, ArrowUp, ChevronRight, History } from "lucide-react";
import Link from "next/link";

import { formatMoney, formatSignedPercent, signColorClass } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type NavHeroCardProps = {
  // NAV toàn danh mục tại mốc chốt — Decimal đã serialize thành string.
  navValue: string;
  // true khi NAV trên chưa gồm các mã thiếu giá (docs/domain/04 "Thiếu giá" —
  // không được mặc định 0) — ẩn dòng delta, hiện dấu * + ghi chú (mockup 2f).
  navValueIsPartial: boolean;
  navDeltaAmount: string;
  navDeltaPercent: number;
  // Số mã thiếu giá — chỉ dùng khi navValueIsPartial để ghép câu ghi chú "*
  // Chưa gồm N mã thiếu giá bên dưới." (DashboardScreen truyền
  // missingPriceHoldings.length xuống).
  missingCount: number;
  hidden?: boolean;
};

// Card NAV hero của Dashboard (mockup 2a/2f) — tách khỏi DashboardScreen
// (issue #110) để Props của DashboardScreen gọn hơn, JSX/className giữ
// NGUYÊN VĂN so với bản gộp cũ (thuần refactor cấu trúc, không đổi UI).
function NavHeroCard({
  navValue,
  navValueIsPartial,
  navDeltaAmount,
  navDeltaPercent,
  missingCount,
  hidden = false,
}: NavHeroCardProps) {
  const navDeltaNumber = Number(navDeltaAmount);
  const NavDeltaIcon = navDeltaNumber < 0 ? ArrowDown : ArrowUp;

  return (
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
          * Chưa gồm {missingCount} mã thiếu giá bên dưới.
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
          <span className="text-xs text-muted-faint">so với vốn đã bỏ vào</span>
        </div>
      )}
    </div>
  );
}

export { NavHeroCard };
export type { NavHeroCardProps };
