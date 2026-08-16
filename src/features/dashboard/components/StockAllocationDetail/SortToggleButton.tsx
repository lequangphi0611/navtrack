"use client";

import { ArrowLeftRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SortToggleButtonProps = {
  sortLabel: string;
  onToggleSort?: () => void;
};

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground";

// Client leaf tách riêng (mirror MoneyValueToggleButton) — StockAllocationDetail
// là organism, KHÔNG được khai "use client" (component-architecture.md "Cấm
// 'use client' ở *Screen/*Section"), nên onClick của chip đổi sort phải sống ở
// một component client nhỏ như thế này thay vì gắn thẳng lên <button> trong
// organism. onToggleSort vắng mặt = hiện chip TĨNH (không bấm được) — dùng khi
// cha chưa cấp handler (mirror pattern onToggleHidden optional).
function SortToggleButton({ sortLabel, onToggleSort }: SortToggleButtonProps) {
  if (!onToggleSort) {
    return (
      <span className={CHIP_CLASS}>
        <ArrowLeftRight className="size-3.5" />
        {sortLabel}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleSort}
      className={cn(
        CHIP_CLASS,
        "cursor-pointer transition-colors hover:bg-white/10",
      )}
    >
      <ArrowLeftRight className="size-3.5" />
      {sortLabel}
    </button>
  );
}

export { SortToggleButton };
export type { SortToggleButtonProps };
