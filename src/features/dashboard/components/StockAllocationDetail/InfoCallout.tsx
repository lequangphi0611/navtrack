import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type InfoCalloutProps = {
  icon: LucideIcon;
  iconClassName?: string;
  // Toàn bộ class khung ngoài (border/nền) — các ngữ cảnh dùng lại (131b/131c)
  // khác tông màu (amber/indigo/trung tính), caller tự quyết định thay vì
  // đoán chung một tổ hợp. Cùng shape với InfoNote (features/dividends/
  // components/DividendForm/InfoNote.tsx) nhưng viết riêng — giữ ranh giới
  // feature, không promote thành shared component ở task này (issue #131).
  containerClassName?: string;
  children: React.ReactNode;
};

// Icon + đoạn văn, không tiêu đề — dùng cho ghi chú giải thích trong
// StockAllocationDetail (mockup 131b/131c).
function InfoCallout({
  icon: Icon,
  iconClassName,
  containerClassName,
  children,
}: InfoCalloutProps) {
  return (
    <div
      className={cn(
        "flex gap-2.25 rounded-2xl border p-3.5",
        containerClassName,
      )}
    >
      <Icon className={cn("mt-0.5 size-4.25 shrink-0", iconClassName)} />
      <div className="text-[11.5px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export { InfoCallout };
export type { InfoCalloutProps };
